// 가게 이름 + 좌표를 받아 Google Places API (New)에서 별점/리뷰를 찾아 정리된 형태로 반환한다.
// 참고: https://developers.google.com/maps/documentation/places/web-service/text-search
//       https://developers.google.com/maps/documentation/places/web-service/place-details
// GOOGLE_PLACES_API_KEY는 반드시 서버(이 함수) 안에서만 사용하고, 클라이언트로 절대 전달하지 않는다.

const { findNearbyPlace } = require("./_lib/places");

const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed", message: "GET만 지원합니다." });
    return;
  }

  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).json({ error: "bad_request", message: "name, lat, lng가 필요합니다." });
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "upstream_error", message: "GOOGLE_PLACES_API_KEY가 설정되지 않았습니다." });
    return;
  }

  try {
    const place = await findNearbyPlace(apiKey, name, lat, lng, "places.id,places.displayName,places.location");

    if (!place) {
      res.status(200).json({ found: false });
      return;
    }

    const details = await fetchPlaceDetails(apiKey, place.id);
    res.status(200).json(details);
  } catch (error) {
    console.error("Google Places API error:", error);
    res.status(502).json({ error: "upstream_error", message: "구글 리뷰 정보를 가져오지 못했습니다." });
  }
};

async function fetchPlaceDetails(apiKey, placeId) {
  const response = await fetch(PLACE_DETAILS_URL + encodeURIComponent(placeId) + "?languageCode=ko", {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews,googleMapsUri",
    },
  });

  if (!response.ok) {
    const error = new Error("Place Details request failed with status " + response.status);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const reviews = Array.isArray(data.reviews)
    ? data.reviews.map(function (review) {
        return {
          author: (review.authorAttribution && review.authorAttribution.displayName) || "익명",
          rating: review.rating,
          relativeTime: review.relativePublishTimeDescription || "",
          text: (review.text && review.text.text) || (review.originalText && review.originalText.text) || "",
        };
      })
    : [];

  return {
    found: true,
    name: (data.displayName && data.displayName.text) || "",
    rating: typeof data.rating === "number" ? data.rating : null,
    userRatingCount: typeof data.userRatingCount === "number" ? data.userRatingCount : 0,
    reviews: reviews,
    mapsUri: data.googleMapsUri || "",
  };
}
