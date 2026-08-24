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
  const filterEl = document.getElementById("bookmarkFilter");
  const filterEmptyEl = document.getElementById("bookmarkFilterEmpty");

  if (!gridEl) return;

  let currentFilter = "all";

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function showLoginPrompt() {
    loginPromptEl.hidden = false;
    statusEl.hidden = true;
    filterEl.hidden = true;
    gridEl.hidden = true;
    filterEmptyEl.hidden = true;
    emptyEl.hidden = true;
    gridEl.innerHTML = "";
  }

  function showLoggedInView() {
    loginPromptEl.hidden = true;
    statusEl.hidden = false;
    filterEl.hidden = false;
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

  function statusLabel(status) {
    return status === "visited" ? "다녀옴" : "가볼 예정";
  }

  function applyStatus(btn, status) {
    btn.dataset.status = status;
    btn.textContent = statusLabel(status);
    btn.classList.toggle("is-visited", status === "visited");
    btn.setAttribute("aria-pressed", status === "visited" ? "true" : "false");
  }

  function createNoteButton(note) {
    const trimmed = (note || "").trim();
    const noteBtn = document.createElement("button");
    noteBtn.type = "button";
    noteBtn.className = "bookmark-card__note-btn";
    noteBtn.dataset.note = trimmed;
    noteBtn.textContent = trimmed || "한 줄 평가 남기기";
    noteBtn.classList.toggle("bookmark-card__note-btn--empty", !trimmed);
    return noteBtn;
  }

  function renderNoteDisplay(noteWrap, note) {
    noteWrap.innerHTML = "";
    noteWrap.appendChild(createNoteButton(note));
  }

  function applyNoteVisibility(noteWrap, status, note) {
    noteWrap.hidden = status !== "visited";
    renderNoteDisplay(noteWrap, note);
  }

  function saveNote(card, noteWrap, value) {
    const trimmed = value.trim();
    supabaseClient
      .from("bookmarks")
      .update({ note: trimmed })
      .eq("id", card.dataset.id)
      .then(function (result) {
        if (result.error) {
          console.error("한 줄 평가 저장 실패:", result.error);
          setStatus("한 줄 평가를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
        }
        renderNoteDisplay(noteWrap, trimmed);
      });
  }

  function openNoteEditor(card, noteWrap, autofocus) {
    const currentBtn = noteWrap.querySelector(".bookmark-card__note-btn");
    const currentNote = currentBtn ? currentBtn.dataset.note || "" : "";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "bookmark-card__note-input";
    input.maxLength = 120;
    input.placeholder = "한 줄 평가를 남겨보세요";
    input.value = currentNote;

    let settled = false;

    function commit() {
      if (settled) return;
      settled = true;
      saveNote(card, noteWrap, input.value);
    }

    function cancel() {
      if (settled) return;
      settled = true;
      renderNoteDisplay(noteWrap, currentNote);
    }

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });
    input.addEventListener("blur", commit);

    noteWrap.innerHTML = "";
    noteWrap.appendChild(input);
    if (autofocus) input.focus();
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

    const status = row.status === "visited" ? "visited" : "planned";
    card.dataset.status = status;

    const statusBtn = document.createElement("button");
    statusBtn.type = "button";
    statusBtn.className = "bookmark-card__status-btn";
    applyStatus(statusBtn, status);
    card.appendChild(statusBtn);

    const noteWrap = document.createElement("div");
    noteWrap.className = "bookmark-card__note-wrap";
    applyNoteVisibility(noteWrap, status, row.note);
    card.appendChild(noteWrap);

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

  function applyFilter() {
    const cards = gridEl.querySelectorAll(".bookmark-card");
    let visibleCount = 0;
    cards.forEach(function (card) {
      const matches = currentFilter === "all" || card.dataset.status === currentFilter;
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    filterEmptyEl.hidden = cards.length === 0 || visibleCount > 0;
  }

  function renderCards(rows) {
    gridEl.innerHTML = "";
    if (!rows || rows.length === 0) {
      emptyEl.hidden = false;
      filterEmptyEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    const fragment = document.createDocumentFragment();
    rows.forEach(function (row) {
      fragment.appendChild(createBookmarkCard(row));
    });
    gridEl.appendChild(fragment);
    applyFilter();
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

  function toggleVisitStatus(card, btn) {
    const nextStatus = btn.dataset.status === "visited" ? "planned" : "visited";

    btn.disabled = true;

    supabaseClient
      .from("bookmarks")
      .update({ status: nextStatus })
      .eq("id", card.dataset.id)
      .then(function (result) {
        if (result.error) {
          console.error("상태 변경 실패:", result.error);
          setStatus("상태를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.");
          btn.disabled = false;
          return;
        }
        applyStatus(btn, nextStatus);
        btn.disabled = false;
        card.dataset.status = nextStatus;
        applyFilter();

        const noteWrap = card.querySelector(".bookmark-card__note-wrap");
        if (!noteWrap) return;
        const currentNoteBtn = noteWrap.querySelector(".bookmark-card__note-btn");
        const currentNote = currentNoteBtn ? currentNoteBtn.dataset.note || "" : "";
        applyNoteVisibility(noteWrap, nextStatus, currentNote);
        if (nextStatus === "visited") {
          openNoteEditor(card, noteWrap, true);
        }
      });
  }

  gridEl.addEventListener("click", function (event) {
    const statusBtn = event.target.closest(".bookmark-card__status-btn");
    if (statusBtn) {
      const card = statusBtn.closest(".bookmark-card");
      if (card) toggleVisitStatus(card, statusBtn);
      return;
    }

    const noteBtn = event.target.closest(".bookmark-card__note-btn");
    if (noteBtn) {
      const noteWrap = noteBtn.closest(".bookmark-card__note-wrap");
      const card = noteBtn.closest(".bookmark-card");
      if (noteWrap && card) openNoteEditor(card, noteWrap, true);
      return;
    }

    const deleteBtn = event.target.closest(".bookmark-card__delete-btn");
    if (!deleteBtn) return;

    const card = deleteBtn.closest(".bookmark-card");
    if (!card) return;

    deleteBtn.disabled = true;

    supabaseClient
      .from("bookmarks")
      .delete()
      .eq("id", card.dataset.id)
      .then(function (result) {
        if (result.error) {
          console.error("삭제 실패:", result.error);
          setStatus("삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
          deleteBtn.disabled = false;
          return;
        }
        removeCard(card);
      });
  });

  if (filterEl) {
    filterEl.addEventListener("click", function (event) {
      const btn = event.target.closest(".bookmark-filter__btn");
      if (!btn) return;

      currentFilter = btn.dataset.filter;
      filterEl.querySelectorAll(".bookmark-filter__btn").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      applyFilter();
    });
  }

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
