// 가게 이름 + 좌표를 받아 Google Places API (New)에서 대표 사진을 찾아 반환한다.
// 참고: https://developers.google.com/maps/documentation/places/web-service/place-photos
// GOOGLE_PLACES_API_KEY는 반드시 서버(이 함수) 안에서만 사용하고, 클라이언트로 절대 전달하지 않는다.
// skipHttpRedirect=true로 요청하면 API 키가 없는 임시 photoUri(약 60분 후 만료)를 JSON으로 받을 수 있어,
// 이 URL은 클라이언트 <img src>에 그대로 넘겨도 키가 노출되지 않는다.

const { findNearbyPlace } = require("./_lib/places");

const DEFAULT_MAX_WIDTH_PX = 800;
const MIN_MAX_WIDTH_PX = 100;
const MAX_MAX_WIDTH_PX = 1600;

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

  const maxWidthPx = clampMaxWidthPx(parseInt(req.query.maxWidthPx, 10));

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "upstream_error", message: "GOOGLE_PLACES_API_KEY가 설정되지 않았습니다." });
    return;
  }

  try {
    const place = await findNearbyPlace(
      apiKey,
      name,
      lat,
      lng,
      "places.id,places.displayName,places.location,places.photos"
    );

    const photos = place && Array.isArray(place.photos) ? place.photos : [];
    if (photos.length === 0) {
      res.status(200).json({ found: false });
      return;
    }

    const photo = photos[0];
    const media = await fetchPhotoMedia(apiKey, photo.name, maxWidthPx);

    const attribution = Array.isArray(photo.authorAttributions)
      ? photo.authorAttributions.map((a) => a.displayName).filter(Boolean)
      : [];

    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=600");
    res.status(200).json({
      found: true,
      photoUri: media.photoUri,
      attribution: attribution.length > 0 ? attribution : ["Google"],
    });
  } catch (error) {
    console.error("Google Places Photo API error:", error);
    res.status(502).json({ error: "upstream_error", message: "구글 사진 정보를 가져오지 못했습니다." });
  }
};

function clampMaxWidthPx(value) {
  if (Number.isNaN(value)) return DEFAULT_MAX_WIDTH_PX;
  return Math.min(Math.max(value, MIN_MAX_WIDTH_PX), MAX_MAX_WIDTH_PX);
}

async function fetchPhotoMedia(apiKey, photoName, maxWidthPx) {
  const url =
    "https://places.googleapis.com/v1/" +
    photoName +
    "/media?maxWidthPx=" +
    maxWidthPx +
    "&skipHttpRedirect=true";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
    },
  });

  if (!response.ok) {
    const error = new Error("Photo media request failed with status " + response.status);
    error.status = response.status;
    throw error;
  }

  return response.json();
}
