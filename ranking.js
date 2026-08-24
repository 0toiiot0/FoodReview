// 인기 랭킹 TOP5. index.html 전용.
// window.Auth(auth.js)가 만든 supabase 클라이언트를 재사용해 전용 창구 함수
// (public.get_top_bookmarked_places, SECURITY DEFINER RPC)를 호출한다.
// 이 함수는 가게 정보 + 담긴 횟수만 반환하므로 로그인 여부와 무관하게 항상 호출한다.

(function () {
  "use strict";

  const sectionEl = document.querySelector(".ranking-section");
  const listEl = document.getElementById("rankingList");
  if (!listEl || !window.Auth) return;

  const supabaseClient = window.Auth.getClient();

  function mapsLinkFor(row) {
    return "https://www.google.com/maps/search/?api=1&query=" + row.lat + "," + row.lng;
  }

  function createRankingItem(row, rank) {
    const item = document.createElement("li");
    item.className = "ranking-item";

    const rankEl = document.createElement("span");
    rankEl.className = "ranking-rank";
    rankEl.textContent = String(rank);
    item.appendChild(rankEl);

    const info = document.createElement("div");
    info.className = "ranking-info";

    const name = document.createElement("p");
    name.className = "ranking-name";
    name.textContent = row.place_name || "이름 없음";
    info.appendChild(name);

    const meta = document.createElement("p");
    meta.className = "ranking-meta";
    meta.textContent = [row.category, row.address].filter(Boolean).join(" · ");
    info.appendChild(meta);

    item.appendChild(info);

    const side = document.createElement("div");
    side.className = "ranking-side";

    const count = document.createElement("span");
    count.className = "ranking-count";
    count.textContent = (row.save_count || 0) + "명이 담음";
    side.appendChild(count);

    if (typeof row.lat === "number" && typeof row.lng === "number") {
      const link = document.createElement("a");
      link.className = "ranking-map-link";
      link.href = mapsLinkFor(row);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "구글맵 보기";
      side.appendChild(link);
    }

    item.appendChild(side);

    return item;
  }

  supabaseClient
    .rpc("get_top_bookmarked_places", { limit_count: 5 })
    .then(function (result) {
      if (result.error || !result.data || result.data.length === 0) {
        if (result.error) console.error("인기 랭킹 조회 실패:", result.error);
        if (sectionEl) sectionEl.hidden = true;
        return;
      }

      const fragment = document.createDocumentFragment();
      result.data.forEach(function (row, index) {
        fragment.appendChild(createRankingItem(row, index + 1));
      });
      listEl.appendChild(fragment);
    });
})();
