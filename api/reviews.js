// 가게 이름 + 좌표를 받아 Google Places API (New)에서 별점/리뷰를 찾아 정리된 형태로 반환한다.
// 참고: https://developers.google.com/maps/documentation/places/web-service/text-search
//       https://developers.google.com/maps/documentation/places/web-service/place-details
// GOOGLE_PLACES_API_KEY는 반드시 서버(이 함수) 안에서만 사용하고, 클라이언트로 절대 전달하지 않는다.

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/";

const LOCATION_BIAS_RADIUS = 500; // meters — Text Search 후보를 넉넉히 받기 위한 가중치일 뿐, 강제 필터가 아님
const MATCH_RADIUS_METERS = 150; // 도보 2분 거리 — 서버에서 직접 계산해 엄격히 적용하는 실제 필터

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
    const placeId = await findNearbyPlaceId(apiKey, name, lat, lng);

    if (!placeId) {
      res.status(200).json({ found: false });
      return;
    }

    const details = await fetchPlaceDetails(apiKey, placeId);
    res.status(200).json(details);
  } catch (error) {
    console.error("Google Places API error:", error);
    res.status(502).json({ error: "upstream_error", message: "구글 리뷰 정보를 가져오지 못했습니다." });
  }
};

async function findNearbyPlaceId(apiKey, name, lat, lng) {
  const response = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location",
    },
    body: JSON.stringify({
      textQuery: name,
      languageCode: "ko",
      maxResultCount: 10,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: LOCATION_BIAS_RADIUS,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = new Error("Text Search request failed with status " + response.status);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const places = Array.isArray(data.places) ? data.places : [];

  for (const place of places) {
    if (!place.location) continue;
    const distance = haversineDistance(lat, lng, place.location.latitude, place.location.longitude);
    if (distance <= MATCH_RADIUS_METERS) {
      return place.id;
    }
  }

  return null;
}

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

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // meters
  const toRad = function (deg) {
    return (deg * Math.PI) / 180;
  };
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
