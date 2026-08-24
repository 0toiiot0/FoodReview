// 가게 "담기" 기능. restaurants.html 전용.
// window.Auth(auth.js)와 #resultGrid(restaurants.js가 만드는 .result-card 카드)에만 의존하며,
// 검색/리뷰/AI 분석 로직에는 관여하지 않는다.

(function () {
  "use strict";

  const supabaseClient = window.Auth.getClient();
  const gridEl = document.getElementById("resultGrid");
  if (!gridEl) return;

  let bookmarkedIds = new Set();
  let toastEl = null;
  let toastTimer = null;

  function loadBookmarks() {
    return window.Auth.getUser().then(function (user) {
      if (!user) {
        bookmarkedIds = new Set();
        return;
      }
      return supabaseClient
        .from("bookmarks")
        .select("place_id")
        .eq("user_id", user.id)
        .then(function (result) {
          if (result.error) {
            console.error("담기 목록 조회 실패:", result.error);
            bookmarkedIds = new Set();
            return;
          }
          bookmarkedIds = new Set(result.data.map(function (row) {
            return row.place_id;
          }));
        });
    });
  }

  function applyState(card) {
    const btn = card.querySelector(".result-card__save-btn");
    if (!btn) return;
    const isSaved = !!card.dataset.placeId && bookmarkedIds.has(card.dataset.placeId);
    btn.classList.toggle("is-bookmarked", isSaved);
    btn.setAttribute("aria-pressed", isSaved ? "true" : "false");
    btn.setAttribute("aria-label", isSaved ? "담김" : "담기");
  }

  function syncAllCards() {
    gridEl.querySelectorAll(".result-card").forEach(applyState);
  }

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches(".result-card")) {
          applyState(node);
        }
      });
    });
  });
  observer.observe(gridEl, { childList: true });

  function showToast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "bookmark-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2200);
  }

  function toggleBookmark(user, card, btn) {
    const placeId = card.dataset.placeId;
    if (!placeId) {
      showToast("이 가게는 담을 수 없어요.");
      return;
    }

    btn.disabled = true;

    if (bookmarkedIds.has(placeId)) {
      supabaseClient
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("place_id", placeId)
        .then(function (result) {
          if (result.error) {
            console.error("담기 취소 실패:", result.error);
            showToast("잠시 후 다시 시도해주세요.");
            return;
          }
          bookmarkedIds.delete(placeId);
          applyState(card);
        })
        .finally(function () {
          btn.disabled = false;
        });
      return;
    }

    supabaseClient
      .from("bookmarks")
      .insert({
        user_id: user.id,
        place_id: placeId,
        place_name: card.dataset.placeName || "",
        category: card.dataset.category || null,
        address: card.dataset.address || "",
        lat: Number(card.dataset.lat),
        lng: Number(card.dataset.lng),
      })
      .then(function (result) {
        if (result.error) {
          if (result.error.code === "23505") {
            bookmarkedIds.add(placeId);
            applyState(card);
            return;
          }
          console.error("담기 실패:", result.error);
          showToast("잠시 후 다시 시도해주세요.");
          return;
        }
        bookmarkedIds.add(placeId);
        applyState(card);
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  gridEl.addEventListener("click", function (event) {
    const btn = event.target.closest(".result-card__save-btn");
    if (!btn) return;

    const card = btn.closest(".result-card");
    if (!card) return;

    window.Auth.getUser().then(function (user) {
      if (!user) {
        showToast("로그인하면 담을 수 있어요.");
        return;
      }
      toggleBookmark(user, card, btn);
    });
  });

  window.Auth.onChange(function () {
    loadBookmarks().then(syncAllCards);
  });

  loadBookmarks().then(syncAllCards);
})();
