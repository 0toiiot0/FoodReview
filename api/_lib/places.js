// Google Places API (New) Text Search로 가게 이름+좌표를 매칭하는 공용 헬퍼.
// api/reviews.js, api/place-photo.js가 함께 사용한다.

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const LOCATION_BIAS_RADIUS = 500; // meters — Text Search 후보를 넉넉히 받기 위한 가중치일 뿐, 강제 필터가 아님
const MATCH_RADIUS_METERS = 150; // 도보 2분 거리 — 서버에서 직접 계산해 엄격히 적용하는 실제 필터

async function findNearbyPlace(apiKey, name, lat, lng, fieldMask) {
  const response = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
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
      return place;
    }
  }

  return null;
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

module.exports = {
  findNearbyPlace,
  haversineDistance,
  LOCATION_BIAS_RADIUS,
  MATCH_RADIUS_METERS,
};
