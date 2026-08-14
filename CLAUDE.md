# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A static one-page landing site for "자리있어" (a Korean food-review service for people organizing group meetups). This is currently **landing-page-only** — no backend, no build tooling, no framework. The site is three files: `index.html`, `style.css`, `script.js`, served as plain static assets (open `index.html` directly or serve the directory with any static file server; there is no dev server, package.json, or build step in this repo).

`PRD.md` and `DESIGN.md` are the product/design specs this page was built from — read them before making content or visual changes, since they encode *why* choices were made, not just what they are.

## Architecture

- `index.html` — all page content/sections in source order: Hero → 인기 맛집 (popular restaurants) → 최근 리뷰 ticker → 서비스 특징 (feature list) → footer. All restaurant/review data is inline fake data (per PRD, V1 has no real data source).
- `style.css` — all styling, driven by CSS custom properties defined once in `:root` (`--paper`, `--paper-deep`, `--ink`, `--ink-muted`, `--rule`, `--ink-invert`). No CSS framework; sections are styled top-to-bottom matching the HTML section order.
- `script.js` — two independent, small behaviors:
  - Builds the "최근 리뷰" ticker DOM from a `reviews` array (duplicating the list once for a seamless `-50%` CSS loop).
  - A generic scroll-reveal `IntersectionObserver` that adds `.is-visible` to any `.reveal` element, with a `prefers-reduced-motion` fallback that skips straight to visible.

## Design system constraints (from DESIGN.md)

These are intentional, load-bearing constraints — don't casually "fix" or reintroduce dropped defaults:

- **No shadows, gradients, or rounded corners anywhere** (the only gradient exception is the ticker's edge fade mask, which is a clip effect, not decoration).
- **Only one accent mechanism**: contrast via `--ink` solid fills, not color. There is exactly one dark CTA button on the page (Hero); the footer is the only other fully-dark block.
- Ratings are typeset as large serif numbers (`Newsreader`, weight 700) — never star icons/emoji for the rating value itself (an unused `#star-shape` SVG symbol exists in the markup but the rating display uses numerals).
- Headings use `Gowun Batang` (serif), body/UI uses `Pretendard`. Only weights 400 and 700 are used — no in-between weights.
- The ticker is the **only** persistent motion on the page (60–90s loop, pause on hover, fully stops under `prefers-reduced-motion`). Don't add other continuous animations — DESIGN.md calls this out explicitly as a rule other sections must not compete with.
- Fake restaurant/review data should read as plausible real Seoul neighborhoods/cuisines (per PRD.md §5.2), not placeholder text like "맛집 A".

## Scope note

Per `PRD.md`, search, review submission, login, and real data are all intentionally non-functional in this version — the Hero search input is `readonly` and the CTA button has no handler. Don't wire these up unless explicitly asked; unimplemented features are meant to be visibly previewed via `COMING SOON` badges in the 서비스 특징 section, not built out.

## 반응형
- 모바일 (375)
- 태블릿 (768)
- 데스크토보 (1280)
으로 브레이크포인트 설정