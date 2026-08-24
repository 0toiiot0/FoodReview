// 나를 위한 추천. index.html 전용, 로그인 상태에서만 동작.
// 내가 담은 가게들의 카테고리(마지막 세부 카테고리 기준)를 집계해 가장 자주 담은 카테고리를 찾고,
// restaurants.js와 동일한 카카오 키워드 검색 패턴으로 그 카테고리의 다른 가게를 찾아 보여준다.
// 이미 담은 가게(내 bookmarks.place_id)는 추천에서 제외한다.

(function () {
  "use strict";

  const KEYWORD_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
  const RESULT_LIMIT = 6;

  const sectionEl = document.getElementById("recommendSection");
  const titleEl = document.getElementById("recommendTitle");
  const gridEl = document.getElementById("recommendGrid");
  if (!sectionEl || !gridEl || !window.Auth) return;

  const supabaseClient = window.Auth.getClient();

  function isApiKeyMissing() {
    return (
      typeof KAKAO_REST_API_KEY === "undefined" ||
      !KAKAO_REST_API_KEY ||
      KAKAO_REST_API_KEY === "YOUR_KAKAO_REST_API_KEY"
    );
  }

  function leafCategory(category) {
    if (!category) return null;
    const parts = category
      .split(">")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }

  function topCategory(rows) {
    const counts = {};
    rows.forEach(function (row) {
      const leaf = leafCategory(row.category);
      if (!leaf) return;
      counts[leaf] = (counts[leaf] || 0) + 1;
    });

    let best = null;
    let bestCount = 0;
    Object.keys(counts).forEach(function (key) {
      if (counts[key] > bestCount) {
        best = key;
        bestCount = counts[key];
      }
    });
    return best;
  }

  function hideSection() {
    sectionEl.hidden = true;
    gridEl.innerHTML = "";
  }

  function fetchKakao(url) {
    return fetch(url.toString(), {
      headers: { Authorization: "KakaoAK " + KAKAO_REST_API_KEY },
    }).then(function (response) {
      if (!response.ok) {
        const error = new Error("Kakao API request failed with status " + response.status);
        error.status = response.status;
        throw error;
      }
      return response.json();
    });
  }

  function createRecommendCard(place) {
    const addressText = place.road_address_name || place.address_name || "";

    const card = document.createElement("article");
    card.className = "recommend-card";

    const name = document.createElement("h3");
    name.className = "recommend-card__name";
    name.textContent = place.place_name || "이름 없음";
    card.appendChild(name);

    if (place.category_name) {
      const category = document.createElement("p");
      category.className = "recommend-card__category";
      category.textContent = place.category_name;
      card.appendChild(category);
    }

    const address = document.createElement("p");
    address.className = "recommend-card__address";
    address.textContent = addressText || "주소 정보 없음";
    card.appendChild(address);

    if (place.place_url) {
      const link = document.createElement("a");
      link.className = "recommend-card__link";
      link.href = place.place_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "지도에서 보기";
      card.appendChild(link);
    }

    const overlay = document.createElement("div");
    overlay.className = "card-thumb-overlay";

    const ratingRow = document.createElement("p");
    ratingRow.className = "card-thumb-overlay__rating";
    ratingRow.innerHTML = '<svg class="card-thumb-overlay__star" aria-hidden="true"><use href="#star-shape"></use></svg>';
    ratingRow.appendChild(document.createTextNode(window.RestaurantInsights.ratingFor(place.place_name).toFixed(1)));
    overlay.appendChild(ratingRow);

    const summary = document.createElement("p");
    summary.className = "card-thumb-overlay__summary";
    summary.textContent = window.RestaurantInsights.summaryFor(place.place_name, place.category_name);
    overlay.appendChild(summary);

    card.appendChild(overlay);

    return card;
  }

  function renderRecommendations(category, places) {
    gridEl.innerHTML = "";
    const fragment = document.createDocumentFragment();
    places.forEach(function (place) {
      fragment.appendChild(createRecommendCard(place));
    });
    gridEl.appendChild(fragment);

    if (titleEl) {
      titleEl.innerHTML = '"' + category + '" 취향이신 분들을 위한 <span class="accent-word">추천</span>';
    }
    sectionEl.hidden = false;
  }

  function buildRecommendations() {
    supabaseClient
      .from("bookmarks")
      .select("place_id, category")
      .then(function (result) {
        if (result.error || !result.data || result.data.length === 0) {
          hideSection();
          return;
        }

        const bookmarkedIds = new Set(result.data.map(function (row) { return row.place_id; }));
        const category = topCategory(result.data);

        if (!category || isApiKeyMissing()) {
          hideSection();
          return;
        }

        const url = new URL(KEYWORD_SEARCH_URL);
        url.searchParams.set("query", category);
        url.searchParams.set("page", "1");

        fetchKakao(url)
          .then(function (data) {
            const documents = (data && data.documents) || [];
            const filtered = documents
              .filter(function (place) {
                return place.id && !bookmarkedIds.has(place.id);
              })
              .slice(0, RESULT_LIMIT);

            if (filtered.length === 0) {
              hideSection();
              return;
            }
            renderRecommendations(category, filtered);
          })
          .catch(function (error) {
            console.error("맞춤 추천 검색 실패:", error);
            hideSection();
          });
      });
  }

  function refresh() {
    window.Auth.getUser().then(function (user) {
      if (!user) {
        hideSection();
        return;
      }
      buildRecommendations();
    });
  }

  window.Auth.onChange(refresh);

  refresh();
})();
