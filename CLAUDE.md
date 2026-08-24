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

**As of 2026-08-24 the site follows a Nintendo.com-style light design system (v4).** This retires the same-day Spotify-style dark system (v3: `#121212` background, green accent, black-on-accent text) after only a few hours — v3, the 2026-08-20 Airbnb-style system, and the v1 monochrome ruleset are now only historical context in DESIGN.md's history section. Design direction has changed twice in one day here, so **always check DESIGN.md's top banner/date for the current version before assuming any color/shadow value below is still current** — don't rely on memory of an earlier session. These are the current load-bearing constraints:

- **Light background is the default again**: `--paper:#FFFFFF` (page background), `--paper-deep:#F4F4F4` (cards/modals/header/footer at rest), `--surface-hover:#FFFFFF` (cards/ticker chips brighten back to pure white on hover, paired with a bigger hard shadow — see below).
- **Nintendo red (`--accent:#E60012`, hover/active `--accent-deep:#B8000E`, darker) is the accent mechanism**, replacing the v3 Spotify green. Used across CTAs, rating stars, active filters/pills, and badges.
- **Text on an accent (red) surface must be white (`--ink-invert:#FFFFFF`) again, not black** — v3's "black text on green" convention is reversed back. This token's value has now changed three times (white → black → white); when adding any new accent-colored button/badge/pill, always check what `--ink-invert` currently resolves to rather than assuming.
- **Shadows are hard, blur-free offsets, not soft blurred shadows**: `--shadow-sm:3px 3px 0 rgba(0,0,0,.9)` → `--shadow-md:5px 5px 0 …` → `--shadow-lg:7px 7px 0 …`. This is the signature v4 look (tactile, game-console-button feel) — never add a blur radius to these tokens or to a one-off `box-shadow`, that would silently revert to the Airbnb/Spotify look.
- Card radius is `--radius-md:14px` (friendlier/rounder than v3's 8px), `--radius-sm:8px` for inputs, pill buttons stay `999px`.
- Ratings are shown as **bold sans numerals (Pretendard 700) plus a red star icon** (`#star-shape` SVG, `fill:var(--accent)`). No serif numerals.
- Headings and body/UI both use `Pretendard` only (unchanged since v2 — see DESIGN.md §3).
- The ticker is still the **only persistent looping motion** on the page (60–90s loop, pause on hover, fully stops under `prefers-reduced-motion`); ticker chips use `--surface-hover` as their background so they read as *lighter than* the ticker section's `--paper-deep` background. Short hover/entrance transitions (card/row brightening + lift, button hover) are allowed elsewhere; don't add another continuous/repeating loop animation outside the ticker.
- `index.html` (`style.css`), `restaurants.html` (`restaurants.css`), and `mypage.html` (`mypage.css`) each define their own identical `:root` token block (no shared CSS file) — when changing a token value, update all three files or the pages will visibly diverge. Also check any hardcoded (non-`var()`) color left over from a prior theme — e.g. a translucent circle-button background, a modal scrim, or a nested badge like `.bookmark-filter__count` that assumed a particular `--ink-invert` value — since those don't auto-update when a token flips.
- Fake restaurant/review data should read as plausible real Seoul neighborhoods/cuisines (per PRD.md §5.2), not placeholder text like "맛집 A".

## Scope note

Per `PRD.md`, the Hero search input is `readonly` and the CTA button has no handler — that part is still intentionally non-functional. AI 리뷰 요약/감성 분석/워드클라우드(통계 대시보드) in the 서비스 특징 section are no longer `COMING SOON`: they now ship for real on `restaurants.html`'s "AI 리뷰 분석" panel (see `api/analyze.js`, `restaurants.js`), so as of 2026-08-24 each `feature-row` links there and shows a `NOW LIVE` badge instead.

## 반응형
- 모바일 (375)
- 태블릿 (768)
- 데스크토보 (1280)
으로 브레이크포인트 설정