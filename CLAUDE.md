# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A static one-page landing site for "어디갈래" (a Korean food-review service for people organizing group meetups). This is currently **landing-page-only** — no backend, no build tooling, no framework. The site is three files: `index.html`, `style.css`, `script.js`, served as plain static assets (open `index.html` directly or serve the directory with any static file server; there is no dev server, package.json, or build step in this repo).

`PRD.md` and `DESIGN.md` are the product/design specs this page was built from — read them before making content or visual changes, since they encode *why* choices were made, not just what they are.

## Architecture

- `index.html` — all page content/sections in source order: Hero → 인기 맛집 (popular restaurants) → 최근 리뷰 ticker → 서비스 특징 (feature list) → footer. All restaurant/review data is inline fake data (per PRD, V1 has no real data source).
- `style.css` — all styling, driven by CSS custom properties defined once in `:root` (`--paper`, `--paper-deep`, `--ink`, `--ink-muted`, `--rule`, `--ink-invert`). No CSS framework; sections are styled top-to-bottom matching the HTML section order.
- `script.js` — two independent, small behaviors:
  - Builds the "최근 리뷰" ticker DOM from a `reviews` array (duplicating the list once for a seamless `-50%` CSS loop).
  - A generic scroll-reveal `IntersectionObserver` that adds `.is-visible` to any `.reveal` element, with a `prefers-reduced-motion` fallback that skips straight to visible.

## Design system constraints (from DESIGN.md)

**As of 2026-08-20 the site follows an Airbnb-style design system.** The previous "no shadows/gradients/rounded corners, monochrome-only accent" ruleset (still visible in DESIGN.md's v1 history) was explicitly retired by the user and replaced with the following — these are the current load-bearing constraints:

- **Shadows and rounded corners are the default**, not exceptions: cards use `border-radius: 12px` and a soft shadow (`--shadow-sm` → `--shadow-md` on hover), buttons/badges use pill radius (`999px`). Don't strip these back toward flat/square "for consistency with the old look" — that look is gone.
- **Coral accent (`--accent`, `#FF385C` family) is the primary accent mechanism**, used repeatedly across CTAs, rating stars, active filters, and badges. Multiple CTA-style buttons on one page are fine now — the old "exactly one CTA" rule is retired. Keep radius/shadow/accent values consistent across `index.html` and `restaurants.html` even though they're styled by different CSS files (`style.css` vs `restaurants.css`).
- Ratings are shown as **bold sans numerals (Pretendard 700) plus a coral star icon** — the `#star-shape` SVG symbol in the markup is now actually used (it was previously defined but unused). No serif numerals.
- Headings and body/UI both use `Pretendard` only (the serif pairing — `Gowun Batang` for headings, `Newsreader` for numerals — was dropped; see DESIGN.md §3 for the reasoning). Weights 400/500/600/700 are all fair game — the old "only 400 and 700" rule is retired.
- The ticker is still the **only persistent looping motion** on the page (60–90s loop, pause on hover, fully stops under `prefers-reduced-motion`) — that concept survived the redesign even though its visual style (now rounded chip cards, not hairline-divided text) changed. Short hover/entrance transitions (card lift, button hover) are now allowed elsewhere; just don't add another continuous/repeating loop animation outside the ticker.
- Fake restaurant/review data should read as plausible real Seoul neighborhoods/cuisines (per PRD.md §5.2), not placeholder text like "맛집 A".

## Scope note

Per `PRD.md`, the Hero search input is `readonly` and the CTA button has no handler — that part is still intentionally non-functional. AI 리뷰 요약/감성 분석/워드클라우드(통계 대시보드) in the 서비스 특징 section are no longer `COMING SOON`: they now ship for real on `restaurants.html`'s "AI 리뷰 분석" panel (see `api/analyze.js`, `restaurants.js`), so as of 2026-08-24 each `feature-row` links there and shows a `NOW LIVE` badge instead.

## 반응형
- 모바일 (375)
- 태블릿 (768)
- 데스크토보 (1280)
으로 브레이크포인트 설정