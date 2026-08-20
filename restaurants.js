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

  // 현재 검색 조건 상태 (새 검색 시작 시 초기화, "더 보기" 클릭 시 page만 증가)
  // { mode: "keyword" | "category", keyword, categoryCode, coords, page }
  let searchState = null;
  let loadedCount = 0;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    runSearch();
  });

  moreButton.addEventListener("click", function () {
    loadMore();
  });

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
    const card = document.createElement("article");
    card.className = "result-card";

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
    address.textContent = place.road_address_name || place.address_name || "주소 정보 없음";
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
})();
