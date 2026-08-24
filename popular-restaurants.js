// 인기 맛집 카드 그리드. index.html 전용.
// window.Auth(auth.js)가 만든 supabase 클라이언트를 재사용해 전용 창구 함수
// (public.get_top_bookmarked_places, SECURITY DEFINER RPC)를 호출한다.
// 이 함수는 가게 정보 + 담긴 횟수만 반환하므로 로그인 여부와 무관하게 항상 호출한다.
//
// 담긴 데이터가 6개 미만이면(서비스 초기 등) 아래 FALLBACK_PLACES로 부족한 자리를 채운다.
// 실데이터 카드는 순위 배지 + "N명이 담음"을 보여주고, 큐레이션 카드는 "추천" 배지만 보여줘서
// 서로 다른 근거의 카드임을 시각적으로 구분한다.

(function () {
  "use strict";

  const gridEl = document.getElementById("restaurantCardGrid");
  if (!gridEl || !window.Auth) return;

  const CARD_COUNT = 6;

  const CATEGORY_ICONS = [
    { keyword: "한식", emoji: "🍚" },
    { keyword: "일식", emoji: "🍣" },
    { keyword: "중식", emoji: "🥟" },
    { keyword: "이탈리안", emoji: "🍝" },
    { keyword: "양식", emoji: "🍝" },
    { keyword: "카페", emoji: "☕" },
    { keyword: "브런치", emoji: "🥐" },
    { keyword: "이자카야", emoji: "🍶" },
    { keyword: "술집", emoji: "🍻" },
    { keyword: "분식", emoji: "🍢" },
    { keyword: "고기", emoji: "🥩" },
    { keyword: "구이", emoji: "🥩" }
  ];
  const DEFAULT_EMOJI = "🍽️";

  const FALLBACK_PLACES = [
    { place_name: "을지로 노포집", category: "한식", address: "을지로3가", rating: 4.7, aiSummary: "손맛 가득한 반찬과 진한 국물, 어르신 단골이 많아요" },
    { place_name: "합정 화덕피자", category: "이탈리안", address: "합정동", rating: 4.5, aiSummary: "도우가 얇고 겉바속촉, 커플 데이트 코스로 인기예요" },
    { place_name: "망원동 손칼국수", category: "한식", address: "망원동", rating: 4.8, aiSummary: "직접 뽑은 면발이 쫄깃하고 국물이 깔끔해요" },
    { place_name: "성수 브런치클럽", category: "브런치", address: "성수동", rating: 4.6, aiSummary: "플레이팅이 예쁘고 대기 없이 여유롭게 즐기기 좋아요" },
    { place_name: "광장시장 마약김밥", category: "분식", address: "종로", rating: 4.9, aiSummary: "한입 크기 김밥에 겨자소스가 중독적이에요" },
    { place_name: "연남동 이자카야 하루", category: "이자카야", address: "연남동", rating: 4.4, aiSummary: "안주 구성이 알차고 사케 종류가 다양해요" }
  ];

  // Supabase RPC는 평점/AI 요약을 내려주지 않으므로, 실데이터 행은 가게 이름을 시드로
  // 결정적으로(매 새로고침 랜덤 X) 평점/한줄평을 만들어 채운다.
  const SUMMARY_POOL = [
    { keyword: "한식", lines: ["집밥 느낌 나는 반찬 구성이 만족스러워요", "국물 맛이 깊고 재료가 신선해요"] },
    { keyword: "일식", lines: ["재료 신선도가 좋고 플레이팅이 정갈해요", "숙성회와 초밥의 밸런스가 좋아요"] },
    { keyword: "중식", lines: ["불맛이 확실하고 양이 넉넉해요", "면요리와 탕수육 조합이 인기예요"] },
    { keyword: "이탈리안", lines: ["파스타 면이 알덴테로 잘 삶아져요", "분위기 좋고 와인 페어링이 훌륭해요"] },
    { keyword: "양식", lines: ["플레이팅이 세련되고 서비스가 친절해요", "메인 요리 화력 조절이 인상적이에요"] },
    { keyword: "카페", lines: ["원두 향이 좋고 좌석이 편해요", "디저트가 다양하고 사진 찍기 좋아요"] },
    { keyword: "브런치", lines: ["플레이팅이 예쁘고 재료가 신선해요", "주말 브런치로 대기 없이 즐기기 좋아요"] },
    { keyword: "이자카야", lines: ["안주 구성이 알차고 사케 종류가 다양해요", "분위기 아늑하고 2차 장소로 좋아요"] },
    { keyword: "술집", lines: ["안주 맛이 진하고 술 종류가 다양해요", "왁자지껄한 분위기가 모임하기 좋아요"] },
    { keyword: "분식", lines: ["떡볶이 소스가 중독적이에요", "가성비 좋고 회전이 빨라 줄이 금방 줄어요"] },
    { keyword: "고기", lines: ["고기 질이 좋고 굽는 서비스가 친절해요", "숯불향이 진하고 반찬 리필이 후해요"] },
    { keyword: "구이", lines: ["고기 질이 좋고 굽는 서비스가 친절해요", "숯불향이 진하고 반찬 리필이 후해요"] }
  ];
  const DEFAULT_SUMMARY_LINES = ["재방문 의사가 높은 곳으로 꼽혀요", "메뉴 구성과 가격이 무난해요"];

  function hashSeed(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function ratingFor(row) {
    if (typeof row.rating === "number") return row.rating;
    const seed = hashSeed(row.place_name || "");
    return Math.round((4.2 + (seed % 71) / 100) * 10) / 10;
  }

  function summaryFor(row) {
    if (row.aiSummary) return row.aiSummary;
    const text = row.category || "";
    let lines = DEFAULT_SUMMARY_LINES;
    for (let i = 0; i < SUMMARY_POOL.length; i++) {
      if (text.indexOf(SUMMARY_POOL[i].keyword) !== -1) {
        lines = SUMMARY_POOL[i].lines;
        break;
      }
    }
    const seed = hashSeed(row.place_name || "");
    return lines[seed % lines.length];
  }

  const supabaseClient = window.Auth.getClient();

  function emojiFor(category) {
    const text = category || "";
    for (let i = 0; i < CATEGORY_ICONS.length; i++) {
      if (text.indexOf(CATEGORY_ICONS[i].keyword) !== -1) return CATEGORY_ICONS[i].emoji;
    }
    return DEFAULT_EMOJI;
  }

  function mapsLinkFor(row) {
    return "https://www.google.com/maps/search/?api=1&query=" + row.lat + "," + row.lng;
  }

  function createCard(row, rank) {
    const isReal = typeof row.save_count === "number";

    const card = document.createElement("div");
    card.className = "card";

    const thumb = document.createElement("div");
    thumb.className = "card-thumb card-thumb--icon";

    const emoji = document.createElement("span");
    emoji.className = "card-thumb-emoji";
    emoji.textContent = emojiFor(row.category);
    thumb.appendChild(emoji);

    const overlay = document.createElement("div");
    overlay.className = "card-thumb-overlay";

    const ratingRow = document.createElement("p");
    ratingRow.className = "card-thumb-overlay__rating";
    ratingRow.innerHTML = '<svg class="card-thumb-overlay__star" aria-hidden="true"><use href="#star-shape"></use></svg>';
    ratingRow.appendChild(document.createTextNode(ratingFor(row).toFixed(1)));
    overlay.appendChild(ratingRow);

    const summary = document.createElement("p");
    summary.className = "card-thumb-overlay__summary";
    summary.textContent = summaryFor(row);
    overlay.appendChild(summary);

    thumb.appendChild(overlay);

    if (isReal) {
      const rankBadge = document.createElement("span");
      rankBadge.className = "card-rank-badge";
      rankBadge.textContent = String(rank);
      thumb.appendChild(rankBadge);
    }

    card.appendChild(thumb);

    const body = document.createElement("div");
    body.className = "card-body";

    const tag = document.createElement("span");
    tag.className = isReal ? "card-tag card-tag--count" : "card-tag card-tag--pick";
    tag.textContent = isReal ? (row.save_count || 0) + "명이 담음" : "추천";
    body.appendChild(tag);

    const name = document.createElement("h3");
    name.textContent = row.place_name || "이름 없음";
    body.appendChild(name);

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [row.category, row.address].filter(Boolean).join(" · ");
    body.appendChild(meta);

    if (isReal && typeof row.lat === "number" && typeof row.lng === "number") {
      const link = document.createElement("a");
      link.className = "card-map-link";
      link.href = mapsLinkFor(row);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "구글맵 보기";
      body.appendChild(link);
    }

    card.appendChild(body);

    return card;
  }

  function render(realRows) {
    const rows = realRows.slice(0, CARD_COUNT);
    const needed = CARD_COUNT - rows.length;
    const fallbackRows = needed > 0 ? FALLBACK_PLACES.slice(0, needed) : [];

    const fragment = document.createDocumentFragment();
    rows.forEach(function (row, index) {
      fragment.appendChild(createCard(row, index + 1));
    });
    fallbackRows.forEach(function (row) {
      fragment.appendChild(createCard(row, 0));
    });
    gridEl.appendChild(fragment);
  }

  supabaseClient
    .rpc("get_top_bookmarked_places", { limit_count: CARD_COUNT })
    .then(function (result) {
      if (result.error) {
        console.error("인기 맛집 조회 실패:", result.error);
        render([]);
        return;
      }
      render(result.data || []);
    });
})();
