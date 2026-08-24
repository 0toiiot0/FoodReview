// "맛집 주머니" 목록. mypage.html 전용.
// window.Auth(auth.js)에만 의존한다. RLS가 select/delete를 로그인한 사용자 소유 행으로
// 이미 제한하므로, 쿼리에 별도의 user_id 필터는 걸지 않는다.

(function () {
  "use strict";

  const supabaseClient = window.Auth.getClient();

  const loginPromptEl = document.getElementById("bookmarkLoginPrompt");
  const loginBtn = document.getElementById("bookmarkLoginBtn");
  const statusEl = document.getElementById("bookmarkStatus");
  const gridEl = document.getElementById("bookmarkGrid");
  const emptyEl = document.getElementById("bookmarkEmpty");

  if (!gridEl) return;

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function showLoginPrompt() {
    loginPromptEl.hidden = false;
    statusEl.hidden = true;
    gridEl.hidden = true;
    emptyEl.hidden = true;
    gridEl.innerHTML = "";
  }

  function showLoggedInView() {
    loginPromptEl.hidden = true;
    statusEl.hidden = false;
    gridEl.hidden = false;
  }

  function mapsLinkFor(row) {
    return "https://www.google.com/maps/search/?api=1&query=" + row.lat + "," + row.lng;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  }

  function createBookmarkCard(row) {
    const card = document.createElement("article");
    card.className = "bookmark-card";
    card.dataset.id = row.id;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "bookmark-card__delete-btn";
    deleteBtn.setAttribute("aria-label", "삭제");
    deleteBtn.textContent = "×";
    card.appendChild(deleteBtn);

    const name = document.createElement("h3");
    name.className = "bookmark-card__name";
    name.textContent = row.place_name || "이름 없음";
    card.appendChild(name);

    if (row.category) {
      const category = document.createElement("p");
      category.className = "bookmark-card__category";
      category.textContent = row.category;
      card.appendChild(category);
    }

    const address = document.createElement("p");
    address.className = "bookmark-card__address";
    address.textContent = row.address || "주소 정보 없음";
    card.appendChild(address);

    const date = document.createElement("p");
    date.className = "bookmark-card__date";
    date.textContent = formatDate(row.created_at) + " 담음";
    card.appendChild(date);

    const link = document.createElement("a");
    link.className = "bookmark-card__map-link";
    link.href = mapsLinkFor(row);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "구글맵 보기";
    card.appendChild(link);

    return card;
  }

  function renderCards(rows) {
    gridEl.innerHTML = "";
    if (!rows || rows.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    const fragment = document.createDocumentFragment();
    rows.forEach(function (row) {
      fragment.appendChild(createBookmarkCard(row));
    });
    gridEl.appendChild(fragment);
  }

  function loadBookmarks() {
    setStatus("불러오는 중...");
    supabaseClient
      .from("bookmarks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(function (result) {
        if (result.error) {
          console.error("맛집 주머니 조회 실패:", result.error);
          setStatus("목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }
        setStatus("");
        renderCards(result.data);
      });
  }

  function removeCard(card) {
    card.remove();
    if (!gridEl.children.length) {
      emptyEl.hidden = false;
    }
  }

  gridEl.addEventListener("click", function (event) {
    const btn = event.target.closest(".bookmark-card__delete-btn");
    if (!btn) return;

    const card = btn.closest(".bookmark-card");
    if (!card) return;

    btn.disabled = true;

    supabaseClient
      .from("bookmarks")
      .delete()
      .eq("id", card.dataset.id)
      .then(function (result) {
        if (result.error) {
          console.error("삭제 실패:", result.error);
          setStatus("삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
          btn.disabled = false;
          return;
        }
        removeCard(card);
      });
  });

  if (loginBtn) {
    loginBtn.addEventListener("click", function () {
      const headerLoginBtn = document.getElementById("authLoginBtn");
      if (headerLoginBtn) headerLoginBtn.click();
    });
  }

  function refreshView() {
    window.Auth.getUser().then(function (user) {
      if (!user) {
        showLoginPrompt();
        return;
      }
      showLoggedInView();
      loadBookmarks();
    });
  }

  window.Auth.onChange(refreshView);

  refreshView();
})();
