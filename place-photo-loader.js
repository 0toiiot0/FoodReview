// /api/place-photo를 호출해 카드 썸네일을 실제 사진으로 교체하는 공용 헬퍼.
// popular-restaurants.js, recommend.js가 함께 사용한다.
// 사진을 못 찾거나 요청이 실패해도 기존 이모지 썸네일이 그대로 남으므로 별도 에러 처리는 하지 않는다.
//
// attach()는 즉시 fetch하지 않고 같은 실행 흐름(한 카드 그리드 렌더링 등) 안에서 모인 요청을
// 모아뒀다가 한 번에 흘려보낸다. 이 중 localStorage에 이미 캐시된 사진은 네트워크 없이 바로 꺼내
// 쓰고, 새로 구글에 요청해야 하는 것만 세어서 MAX_BATCH_SIZE를 넘으면 — 버그나 예상 밖의 대량
// 렌더링으로 한 번에 너무 많은 구글 API 호출이 나가는 걸 막기 위해 — 그만큼은 건너뛰고 이모지를
// 그대로 둔다.

window.PlacePhotoLoader = (function () {
  "use strict";

  const MAX_BATCH_SIZE = 15;
  const CACHE_PREFIX = "placePhoto:";
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 — 이 기간이 지나면 다시 구글에서 받아온다.

  let pendingBatch = [];
  let flushScheduled = false;

  function attach(options) {
    const lat = options.lat;
    const lng = options.lng;
    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) return;

    pendingBatch.push(options);
    if (!flushScheduled) {
      flushScheduled = true;
      Promise.resolve().then(flushBatch);
    }
  }

  function flushBatch() {
    const batch = pendingBatch;
    pendingBatch = [];
    flushScheduled = false;

    const toFetch = [];
    batch.forEach(function (options) {
      const key = cacheKey(options.name, options.lat, options.lng);
      const cached = readCache(key);
      if (cached) {
        swapInPhoto(options, cached.src, cached.attribution);
      } else {
        toFetch.push({ options: options, key: key });
      }
    });

    if (toFetch.length > MAX_BATCH_SIZE) {
      console.warn(
        "PlacePhotoLoader: 캐시에 없는 요청이 한 번에 " + toFetch.length + "건이라 한도(" + MAX_BATCH_SIZE + "건)를 넘어 전부 건너뜁니다."
      );
      return;
    }

    toFetch.forEach(function (entry) {
      fetchAndCache(entry.options, entry.key);
    });
  }

  function fetchAndCache(options, key) {
    const url =
      "/api/place-photo?name=" +
      encodeURIComponent(options.name || "") +
      "&lat=" +
      encodeURIComponent(options.lat) +
      "&lng=" +
      encodeURIComponent(options.lng) +
      "&maxWidthPx=800";

    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.found || !data.photoUri) return;
        const attribution = (data.attribution && data.attribution[0]) || "Google";

        // 사진 바이트 자체를 받아 data URI로 만들어 localStorage에 저장해두면, 다음부터는
        // 구글의 photoUri(약 60분 후 만료)를 다시 받아올 필요 없이 저장된 이미지를 바로 쓴다.
        fetch(data.photoUri)
          .then(function (response) {
            if (!response.ok) throw new Error("image fetch failed");
            return response.blob();
          })
          .then(blobToDataUri)
          .then(function (dataUri) {
            writeCache(key, dataUri, attribution);
            swapInPhoto(options, dataUri, attribution);
          })
          .catch(function () {
            // 이미지 바이트를 못 읽어와도(예: CORS) 임시 URL로는 화면에 정상 표시된다.
            // 다만 이 경우엔 캐시에 저장하지 못하므로 다음에도 다시 요청하게 된다.
            swapInPhoto(options, data.photoUri, attribution);
          });
      })
      .catch(function () {
        // 사진을 못 가져와도 기존 썸네일이 그대로 남아 있으므로 조용히 무시한다.
      });
  }

  function swapInPhoto(options, src, attribution) {
    const thumb = options.thumb;
    const fallbackEl = options.fallbackEl;
    const iconClass = options.iconClass;
    const photoClass = options.photoClass;

    const img = document.createElement("img");
    img.alt = options.name || "";
    img.addEventListener("load", function () {
      if (fallbackEl && fallbackEl.parentNode === thumb) thumb.removeChild(fallbackEl);
      if (iconClass) thumb.classList.remove(iconClass);
      if (photoClass) thumb.classList.add(photoClass);
      img.classList.add("is-loaded");

      const attributionEl = document.createElement("span");
      attributionEl.className = "card-thumb-attribution";
      attributionEl.textContent = "사진: " + (attribution || "Google");
      thumb.appendChild(attributionEl);
    });
    img.addEventListener("error", function () {
      if (img.parentNode === thumb) thumb.removeChild(img);
    });
    img.src = src;
    thumb.insertBefore(img, thumb.firstChild);
  }

  function cacheKey(name, lat, lng) {
    return CACHE_PREFIX + (name || "") + "|" + lat.toFixed(5) + "|" + lng.toFixed(5);
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.src || typeof parsed.cachedAt !== "number") return null;
      if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeCache(key, src, attribution) {
    try {
      localStorage.setItem(key, JSON.stringify({ src: src, attribution: attribution, cachedAt: Date.now() }));
    } catch (error) {
      // 저장 공간 초과 등으로 캐시에 실패해도 화면에는 이미 사진이 반영되므로 무시한다.
    }
  }

  function blobToDataUri(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return { attach: attach };
})();
