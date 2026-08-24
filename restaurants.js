// 카카오 로컬 API를 이용한 맛집 검색 + 카드 렌더링 (페이지네이션 포함)
// 참고: https://developers.kakao.com/docs/latest/ko/local/dev-guide

(function () {
  "use strict";

  const KEYWORD_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
  const CATEGORY_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/category.json";

  // 위치 기반 카테고리 검색에 쓸 기본 좌표 (서울시청)
  const DEFAULT_COORDS = { x: "126.9780", y: "37.5665" };
  const DEFAULT_RADIUS = 2000; // meters

  // 카카오 로컬 API 페이지네이션: 한 페이지 최대 15건, 최대 3페이지(45건)까지 지원
  const MAX_PAGE = 3;

  const form = document.getElementById("searchForm");
  const keywordInput = document.getElementById("searchKeyword");
  const categorySelect = document.getElementById("searchCategory");
  const statusEl = document.getElementById("resultStatus");
  const gridEl = document.getElementById("resultGrid");
  const moreButton = document.getElementById("moreButton");
  const reviewPanel = document.getElementById("reviewPanel");

  const REVIEW_CACHE_PREFIX = "reviewCache::";
  const ANALYSIS_CACHE_PREFIX = "analysisCache::";

  // 현재 검색 조건 상태 (새 검색 시작 시 초기화, "더 보기" 클릭 시 page만 증가)
  // { mode: "keyword" | "category", keyword, categoryCode, coords, page }
  let searchState = null;
  let loadedCount = 0;
  let reviewContentEl = null;
  let activeRequestId = 0;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    runSearch();
  });

  moreButton.addEventListener("click", function () {
    loadMore();
  });

  function activateCard(card) {
    if (!card || !card.dataset.placeName) {
      return;
    }
    openReviewPanel(card.dataset.placeName, card.dataset.lat, card.dataset.lng);
  }

  gridEl.addEventListener("click", function (event) {
    if (event.target.closest(".result-card__link")) {
      return;
    }
    if (event.target.closest(".result-card__save-btn")) {
      return;
    }
    activateCard(event.target.closest(".result-card"));
  });

  gridEl.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    // 카드 자체가 포커스된 상태에서만 반응한다 (내부 링크/버튼은 자체 키보드 동작을 가지므로 제외).
    const card = event.target.closest(".result-card");
    if (!card || event.target !== card) {
      return;
    }
    event.preventDefault();
    activateCard(card);
  });

  if (reviewPanel) {
    reviewContentEl = initReviewPanel();
  }

  function isApiKeyMissing() {
    return (
      typeof KAKAO_REST_API_KEY === "undefined" ||
      !KAKAO_REST_API_KEY ||
      KAKAO_REST_API_KEY === "YOUR_KAKAO_REST_API_KEY"
    );
  }

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function clearResults() {
    gridEl.innerHTML = "";
  }

  function showMoreButton() {
    moreButton.hidden = false;
    moreButton.disabled = false;
    moreButton.textContent = "더 보기";
  }

  function hideMoreButton() {
    moreButton.hidden = true;
    moreButton.disabled = true;
    moreButton.textContent = "더 보기";
  }

  function runSearch() {
    const keyword = keywordInput.value.trim();
    const categoryCode = categorySelect.value;

    searchState = null;
    loadedCount = 0;
    hideMoreButton();

    if (isApiKeyMissing()) {
      clearResults();
      setStatus("카카오 API 키를 config.js에 설정해주세요.");
      return;
    }

    if (!keyword && !categoryCode) {
      clearResults();
      setStatus("키워드를 입력하거나 카테고리를 선택해주세요.");
      return;
    }

    clearResults();
    setStatus("검색 중입니다...");

    if (keyword) {
      searchState = { mode: "keyword", keyword: keyword, categoryCode: categoryCode, coords: null, page: 1 };
      executeSearch(false);
    } else {
      getCurrentCoords().then(function (coords) {
        searchState = { mode: "category", keyword: "", categoryCode: categoryCode, coords: coords, page: 1 };
        executeSearch(false);
      });
    }
  }

  function loadMore() {
    if (!searchState || moreButton.disabled) {
      return;
    }

    moreButton.disabled = true;
    moreButton.textContent = "불러오는 중...";
    searchState.page += 1;
    executeSearch(true);
  }

  function executeSearch(append) {
    const url = buildSearchUrl(searchState);

    fetchKakao(url)
      .then(function (data) {
        handleSearchResult(data, append);
      })
      .catch(function (error) {
        handleSearchError(error, append);
      });
  }

  function buildSearchUrl(state) {
    if (state.mode === "keyword") {
      const url = new URL(KEYWORD_SEARCH_URL);
      url.searchParams.set("query", state.keyword);
      if (state.categoryCode) {
        url.searchParams.set("category_group_code", state.categoryCode);
      }
      url.searchParams.set("page", String(state.page));
      return url;
    }

    const url = new URL(CATEGORY_SEARCH_URL);
    url.searchParams.set("category_group_code", state.categoryCode);
    url.searchParams.set("x", state.coords.x);
    url.searchParams.set("y", state.coords.y);
    url.searchParams.set("radius", String(DEFAULT_RADIUS));
    url.searchParams.set("page", String(state.page));
    return url;
  }

  function getCurrentCoords() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) {
        resolve(DEFAULT_COORDS);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          resolve({
            x: String(position.coords.longitude),
            y: String(position.coords.latitude),
          });
        },
        function () {
          // 위치 접근 실패 시 기본 좌표(서울시청)로 폴백
          resolve(DEFAULT_COORDS);
        },
        { timeout: 3000 }
      );
    });
  }

  function fetchKakao(url) {
    return fetch(url.toString(), {
      headers: {
        Authorization: "KakaoAK " + KAKAO_REST_API_KEY,
      },
    }).then(function (response) {
      if (!response.ok) {
        const error = new Error("Kakao API request failed with status " + response.status);
        error.status = response.status;
        throw error;
      }
      return response.json();
    });
  }

  function handleSearchResult(data, append) {
    const documents = (data && data.documents) || [];
    const meta = (data && data.meta) || {};

    if (!append) {
      clearResults();
      loadedCount = 0;
    }

    if (documents.length === 0) {
      if (!append) {
        setStatus("검색 결과가 없습니다.");
      }
      hideMoreButton();
      return;
    }

    loadedCount += documents.length;
    const totalCount = typeof meta.pageable_count === "number" ? meta.pageable_count : loadedCount;
    setStatus("검색 결과 " + totalCount + "건 중 " + loadedCount + "건 표시");

    appendCards(documents);

    const reachedPageLimit = searchState.page >= MAX_PAGE;
    const isEnd = meta.is_end !== false; // 값이 없거나 true면 마지막 페이지로 취급
    if (!isEnd && !reachedPageLimit) {
      showMoreButton();
    } else {
      hideMoreButton();
    }
  }

  function handleSearchError(error, append) {
    // "더 보기" 요청이 실패하면 이미 표시된 결과는 유지하고 재시도할 수 있게 페이지 번호를 되돌린다.
    if (append && searchState) {
      searchState.page -= 1;
    }

    if (!append) {
      clearResults();
    }

    if (error && error.status === 401) {
      setStatus("카카오 API 키를 config.js에 설정해주세요.");
      hideMoreButton();
      return;
    }

    setStatus("검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    console.error("Kakao Local API error:", error);

    if (append) {
      showMoreButton();
    } else {
      hideMoreButton();
    }
  }

  function appendCards(documents) {
    const fragment = document.createDocumentFragment();

    documents.forEach(function (place) {
      fragment.appendChild(createResultCard(place));
    });

    gridEl.appendChild(fragment);
  }

  function createResultCard(place) {
    const addressText = place.road_address_name || place.address_name || "";

    const card = document.createElement("article");
    card.className = "result-card";
    card.dataset.placeId = place.id || "";
    card.dataset.placeName = place.place_name || "";
    card.dataset.category = place.category_name || "";
    card.dataset.address = addressText;
    card.dataset.lat = place.y || "";
    card.dataset.lng = place.x || "";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", (place.place_name || "이름 없음") + " 리뷰 보기");

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "result-card__save-btn";
    saveBtn.setAttribute("aria-label", "담기");
    saveBtn.setAttribute("aria-pressed", "false");
    saveBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z"/></svg>';
    card.appendChild(saveBtn);

    const name = document.createElement("h3");
    name.className = "result-card__name";
    name.textContent = place.place_name || "이름 없음";
    card.appendChild(name);

    if (place.category_name) {
      const category = document.createElement("p");
      category.className = "result-card__category";
      category.textContent = place.category_name;
      card.appendChild(category);
    }

    const address = document.createElement("p");
    address.className = "result-card__address";
    address.textContent = addressText || "주소 정보 없음";
    card.appendChild(address);

    if (place.phone) {
      const phone = document.createElement("p");
      phone.className = "result-card__phone";
      phone.textContent = place.phone;
      card.appendChild(phone);
    }

    if (place.place_url) {
      const link = document.createElement("a");
      link.className = "result-card__link";
      link.href = place.place_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "지도에서 보기";
      card.appendChild(link);
    }

    return card;
  }

  // ================= 구글 리뷰 패널 =================

  function initReviewPanel() {
    reviewPanel.hidden = true;
    reviewPanel.setAttribute("aria-hidden", "true");

    const dialog = document.createElement("div");
    dialog.className = "review-panel__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "review-panel__close";
    closeButton.setAttribute("aria-label", "닫기");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", closeReviewPanel);
    dialog.appendChild(closeButton);

    const content = document.createElement("div");
    content.className = "review-panel__content";
    dialog.appendChild(content);

    reviewPanel.appendChild(dialog);

    reviewPanel.addEventListener("click", function (event) {
      if (event.target === reviewPanel) {
        closeReviewPanel();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !reviewPanel.hidden) {
        closeReviewPanel();
      }
    });

    return content;
  }

  function openReviewPanel(name, lat, lng) {
    if (!reviewContentEl) {
      return;
    }

    const requestId = ++activeRequestId;

    reviewPanel.hidden = false;
    reviewPanel.setAttribute("aria-hidden", "false");

    const cacheKey = REVIEW_CACHE_PREFIX + name + "::" + lat + "::" + lng;
    const cached = readJSONCache(cacheKey);
    if (cached) {
      renderReviewResult(cached, name, lat, lng, requestId);
      return;
    }

    renderReviewLoading();

    const url = new URL("/api/reviews", window.location.origin);
    url.searchParams.set("name", name);
    url.searchParams.set("lat", lat);
    url.searchParams.set("lng", lng);

    fetch(url.toString())
      .then(function (response) {
        if (!response.ok) {
          const error = new Error("리뷰 요청이 실패했습니다.");
          error.status = response.status;
          throw error;
        }
        return response.json();
      })
      .then(function (data) {
        if (requestId !== activeRequestId) {
          return;
        }
        renderReviewResult(data, name, lat, lng, requestId);
        writeJSONCache(cacheKey, data);
      })
      .catch(function (error) {
        if (requestId !== activeRequestId) {
          return;
        }
        console.error("Google review fetch error:", error);
        renderReviewError();
      });
  }

  function closeReviewPanel() {
    reviewPanel.hidden = true;
    reviewPanel.setAttribute("aria-hidden", "true");
  }

  function clearReviewContent() {
    while (reviewContentEl.firstChild) {
      reviewContentEl.removeChild(reviewContentEl.firstChild);
    }
  }

  function renderReviewLoading() {
    clearReviewContent();
    const loading = document.createElement("p");
    loading.className = "review-panel__loading";
    loading.textContent = "리뷰를 불러오는 중....";
    reviewContentEl.appendChild(loading);
  }

  function renderReviewError() {
    clearReviewContent();
    const error = document.createElement("p");
    error.className = "review-panel__error";
    error.textContent = "리뷰를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
    reviewContentEl.appendChild(error);
  }

  function renderReviewResult(data, name, lat, lng, requestId) {
    if (!data || !data.found) {
      renderReviewNotFound(name);
      return;
    }

    clearReviewContent();

    const title = document.createElement("h2");
    title.className = "review-panel__name";
    title.textContent = data.name || name;
    reviewContentEl.appendChild(title);

    const ratingRow = document.createElement("p");
    ratingRow.className = "review-panel__rating";

    if (typeof data.rating === "number") {
      const stars = document.createElement("span");
      stars.className = "review-panel__stars";
      stars.textContent = starsFor(data.rating);
      ratingRow.appendChild(stars);

      const ratingNum = document.createElement("span");
      ratingNum.textContent = " " + data.rating.toFixed(1);
      ratingRow.appendChild(ratingNum);
    }

    const count = document.createElement("span");
    count.className = "review-panel__count";
    count.textContent = " (" + (data.userRatingCount || 0) + "개 리뷰)";
    ratingRow.appendChild(count);

    reviewContentEl.appendChild(ratingRow);

    const list = document.createElement("ul");
    list.className = "review-panel__list";

    if (data.reviews && data.reviews.length > 0) {
      data.reviews.forEach(function (review) {
        list.appendChild(createReviewItem(review));
      });
    } else {
      const empty = document.createElement("li");
      empty.className = "review-panel__item";
      empty.textContent = "아직 등록된 리뷰가 없습니다.";
      list.appendChild(empty);
    }

    reviewContentEl.appendChild(list);

    const hasReviews = Array.isArray(data.reviews) && data.reviews.length > 0;
    if (hasReviews) {
      reviewContentEl.appendChild(buildAnalysisSection(data.reviews, name, lat, lng, requestId));
    }

    if (data.mapsUri) {
      const link = document.createElement("a");
      link.className = "review-panel__maps-link";
      link.href = data.mapsUri;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "구글 맵에서 전체 리뷰 보기";
      reviewContentEl.appendChild(link);
    }
  }

  function createReviewItem(review) {
    const item = document.createElement("li");
    item.className = "review-panel__item";

    const meta = document.createElement("p");
    meta.className = "review-panel__item-meta";
    meta.textContent =
      (review.author || "익명") +
      " · " +
      starsFor(review.rating || 0) +
      (review.relativeTime ? " · " + review.relativeTime : "");
    item.appendChild(meta);

    const text = document.createElement("p");
    text.className = "review-panel__item-text";
    text.textContent = review.text || "";
    item.appendChild(text);

    return item;
  }

  function renderReviewNotFound(name) {
    clearReviewContent();
    const empty = document.createElement("p");
    empty.className = "review-panel__empty";
    empty.textContent = '"' + name + '"의 구글 리뷰 정보를 찾을 수 없습니다.';
    reviewContentEl.appendChild(empty);
  }

  function starsFor(rating) {
    const count = Math.max(0, Math.min(5, Math.round(rating)));
    return "⭐".repeat(count);
  }

  function readJSONCache(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeJSONCache(key, data) {
    try {
      window.localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      // localStorage를 사용할 수 없는 환경(프라이빗 모드 등)에서는 캐시 없이 동작한다.
    }
  }

  // ================= AI 리뷰 분석 =================

  function buildAnalysisSection(reviews, name, lat, lng, requestId) {
    const section = document.createElement("section");
    section.className = "ai-analysis";

    const title = document.createElement("h3");
    title.className = "ai-analysis__title";
    title.textContent = "AI 리뷰 분석";
    section.appendChild(title);

    const bodyEl = document.createElement("div");
    bodyEl.className = "ai-analysis__body";
    section.appendChild(bodyEl);

    const analysisCacheKey = ANALYSIS_CACHE_PREFIX + name + "::" + lat + "::" + lng;
    const cached = readJSONCache(analysisCacheKey);

    if (cached) {
      renderAnalysisResult(bodyEl, cached);
      return section;
    }

    renderAnalysisLoading(bodyEl);

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        reviews: reviews.map(function (review) {
          return { text: review.text, rating: review.rating };
        }),
      }),
    })
      .then(function (response) {
        if (!response.ok) {
          const error = new Error("AI 분석 요청이 실패했습니다.");
          error.status = response.status;
          throw error;
        }
        return response.json();
      })
      .then(function (data) {
        if (requestId !== activeRequestId) {
          return;
        }
        renderAnalysisResult(bodyEl, data);
        writeJSONCache(analysisCacheKey, data);
      })
      .catch(function (error) {
        if (requestId !== activeRequestId) {
          return;
        }
        console.error("AI analysis fetch error:", error);
        renderAnalysisError(bodyEl);
      });

    return section;
  }

  function clearElement(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function renderAnalysisLoading(bodyEl) {
    clearElement(bodyEl);
    const loading = document.createElement("p");
    loading.className = "ai-analysis__loading";
    loading.textContent = "AI가 리뷰를 분석하는 중....";
    bodyEl.appendChild(loading);
  }

  function renderAnalysisError(bodyEl) {
    clearElement(bodyEl);
    const error = document.createElement("p");
    error.className = "ai-analysis__error";
    error.textContent = "AI 분석에 실패했습니다.";
    bodyEl.appendChild(error);
  }

  function renderAnalysisResult(bodyEl, data) {
    clearElement(bodyEl);

    bodyEl.appendChild(buildSentimentBar(data.sentiment));

    const wordCloudWrap = document.createElement("div");
    wordCloudWrap.className = "ai-analysis__wordcloud-wrap";
    const canvas = document.createElement("canvas");
    wordCloudWrap.appendChild(canvas);
    bodyEl.appendChild(wordCloudWrap);
    drawWordCloud(canvas, data.keywords || []);

    bodyEl.appendChild(buildSummaryBubble(data.summary));
  }

  function buildSentimentBar(sentiment) {
    const wrap = document.createElement("div");

    const positive = (sentiment && sentiment.positive) || 0;
    const neutral = (sentiment && sentiment.neutral) || 0;
    const negative = (sentiment && sentiment.negative) || 0;
    const total = (sentiment && sentiment.total) || positive + neutral + negative || 1;

    const bar = document.createElement("div");
    bar.className = "ai-analysis__bar";

    [
      ["positive", positive, "긍정"],
      ["neutral", neutral, "보통"],
      ["negative", negative, "부정"],
    ].forEach(function (entry) {
      if (entry[1] <= 0) {
        return;
      }
      const segment = document.createElement("span");
      segment.className = "ai-analysis__bar-" + entry[0];
      segment.style.width = (entry[1] / total) * 100 + "%";
      bar.appendChild(segment);
    });
    wrap.appendChild(bar);

    const legend = document.createElement("ul");
    legend.className = "ai-analysis__legend";
    [
      ["positive", positive, "긍정"],
      ["neutral", neutral, "보통"],
      ["negative", negative, "부정"],
    ].forEach(function (entry) {
      const item = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "ai-analysis__legend-dot";
      dot.style.background = "var(--" + entry[0] + ")";
      item.appendChild(dot);
      item.appendChild(document.createTextNode(entry[2] + " " + entry[1]));
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    return wrap;
  }

  function buildSummaryBubble(summary) {
    const wrap = document.createElement("div");

    const badge = document.createElement("span");
    badge.className = "ai-analysis__ai-badge";
    badge.textContent = "AI 요약";
    wrap.appendChild(badge);

    const bubble = document.createElement("p");
    bubble.className = "ai-analysis__summary-bubble";
    bubble.textContent = summary || "";
    wrap.appendChild(bubble);

    return wrap;
  }

  function drawWordCloud(canvasEl, keywords) {
    if (typeof window.WordCloud !== "function" || !keywords.length) {
      return;
    }

    // wordcloud2.js는 라틴 폰트 기준으로 글자 높이를 추정하기 때문에, 한글(Pretendard)에서는
    // 실제 렌더링 높이가 예상보다 커서 캔버스 경계에 글자가 잘리는 경우가 있다.
    // 캔버스를 표시 영역보다 여유 있게 크게 그린 뒤, wrap의 overflow:hidden으로 바깥쪽만 잘라내
    // 실제 보이는 영역 안에서는 글자가 잘리지 않도록 한다.
    const wrap = canvasEl.parentElement;
    const PADDING = 24;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    canvasEl.width = width + PADDING * 2;
    canvasEl.height = height + PADDING * 2;
    canvasEl.style.width = canvasEl.width + "px";
    canvasEl.style.height = canvasEl.height + "px";
    canvasEl.style.left = "-" + PADDING + "px";
    canvasEl.style.top = "-" + PADDING + "px";

    const rootStyle = getComputedStyle(document.documentElement);
    const positiveColor = rootStyle.getPropertyValue("--positive").trim();
    const negativeColor = rootStyle.getPropertyValue("--negative").trim();
    const backgroundColor = rootStyle.getPropertyValue("--paper-deep").trim();

    const scores = keywords.map(function (keyword) {
      return keyword.score;
    });
    const minScore = Math.min.apply(null, scores);
    const maxScore = Math.max.apply(null, scores);

    function weightFactor(score) {
      if (maxScore === minScore) {
        return 24;
      }
      return 14 + ((score - minScore) / (maxScore - minScore)) * 22;
    }

    const list = keywords.map(function (keyword) {
      return [keyword.word, keyword.score, keyword.sentiment];
    });

    window.WordCloud(canvasEl, {
      list: list,
      gridSize: 10,
      weightFactor: weightFactor,
      rotateRatio: 0,
      fontFamily: "Pretendard, sans-serif",
      backgroundColor: backgroundColor,
      color: function (word, weight, fontSize, distance, theta, extra) {
        return extra[2] === "negative" ? negativeColor : positiveColor;
      },
    });
  }
})();
