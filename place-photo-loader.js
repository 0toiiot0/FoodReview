// /api/place-photo를 호출해 카드 썸네일을 실제 사진으로 교체하는 공용 헬퍼.
// popular-restaurants.js, recommend.js가 함께 사용한다.
// 사진을 못 찾거나 요청이 실패해도 기존 이모지 썸네일이 그대로 남으므로 별도 에러 처리는 하지 않는다.

window.PlacePhotoLoader = (function () {
  "use strict";

  function attach(options) {
    const thumb = options.thumb;
    const fallbackEl = options.fallbackEl;
    const name = options.name;
    const lat = options.lat;
    const lng = options.lng;
    const iconClass = options.iconClass;
    const photoClass = options.photoClass;

    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const url =
      "/api/place-photo?name=" +
      encodeURIComponent(name || "") +
      "&lat=" +
      encodeURIComponent(lat) +
      "&lng=" +
      encodeURIComponent(lng) +
      "&maxWidthPx=800";

    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.found || !data.photoUri) return;

        const img = document.createElement("img");
        img.alt = name || "";
        img.addEventListener("load", function () {
          if (fallbackEl && fallbackEl.parentNode === thumb) thumb.removeChild(fallbackEl);
          if (iconClass) thumb.classList.remove(iconClass);
          if (photoClass) thumb.classList.add(photoClass);
          img.classList.add("is-loaded");

          const attribution = document.createElement("span");
          attribution.className = "card-thumb-attribution";
          attribution.textContent = "사진: " + ((data.attribution && data.attribution[0]) || "Google");
          thumb.appendChild(attribution);
        });
        img.addEventListener("error", function () {
          if (img.parentNode === thumb) thumb.removeChild(img);
        });
        img.src = data.photoUri;
        thumb.insertBefore(img, thumb.firstChild);
      })
      .catch(function () {
        // 사진을 못 가져와도 기존 썸네일이 그대로 남아 있으므로 조용히 무시한다.
      });
  }

  return { attach: attach };
})();
