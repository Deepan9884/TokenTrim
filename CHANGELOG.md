# Changelog

## 1.2.0 — Universal converter (PPTX · Images · Sheets · Text · HTML · EPUB)
- New `lib/converters/` adapters, zero new dependencies: `source-types` registry, `ooxml-zip` (DecompressionStream-based), `pptx-parser` (slides + tables + speaker notes, slide-range), `sheet-parser` (XLSX sharedStrings/sheets + CSV/TSV sniff), `text-parser` (TXT/MD pass-through, readability-lite HTML, EPUB spine), `image-handler` (vision-ready MD + local OCR hook)
- `converter.js` is now a router: validate/detect via `detectSourceType`, per-format `convertPptx/Image/Xlsx/Csv/PlainText/Html/Epub`, shared pipeline + stats; PPTX reuses page-range as slide-range
- OCR wired: `lib/ocr.js` uses vendored `lib/tesseract.min.js` when present, else exports vision-ready Markdown with a paste-into-vision-LLM prompt (no dead-end errors)
- UI: universal accept lists + copy, per-format badges/stats, dynamic Pages/Slides label, smart doc-preset defaults (presentation/spreadsheet), batch + history carry `sourceType`, side panel shows format in stats
- Presets: new `presentation` + `spreadsheet` document presets; errors cover all formats
- Backend: `0003_doctypes.sql` (`source_type`, `original_filename`, `ocr_used`), store + `/api/documents` accept/persist them, dashboard shows 30d conversions-by-format chips, extension tracks `source_type` + `ocr_used` per conversion
- Tests: 46 vitest + admin build + extension build green; e2e C05 now uses a truly-unsupported `.exe`

## Unreleased — Creator Panel + auth
- Standalone admin web app (`admin/`, Next.js): creator email/password login, 4-digit recovery key, user-trend charts, user list with IDs/aggregates, event explorer
- Supabase Postgres schema (`supabase/migrations/`) with deny-by-default RLS; demo JSON store for zero-setup local runs
- Extension integration: Account section in settings (connect, sign up/in/out, forgot-password via key), offline event outbox, per-conversion tracking
- Verified live: 18 Playwright admin tests (auth, dashboard, extension↔panel) + 6 vitest helper tests

## Unreleased — Rouge & Ivory redesign
- Removed the BETA badge; new crimson wordmark with trim-line accent
- Red/white elegant theme: warm ivory surfaces, hairline borders, diffusion shadows
- Real vector icons everywhere via a local 11.5KB Material Symbols sprite (the remote-font removal had left icon names as plain text)
- Cat-yarn loader rebuilt in-theme: synced 4.2s master cycle, breathing, blinking eyes with catchlights, crimson yarn with string trail
- Progress bar light sweep, tabular numerals, view-enter motion, focus rings, refined modal/pills/toggles/inputs
- Fixed squeezed option rows (pages/query stack vertically; inline buttons no longer stretch)
- Added the missing cat-scene markup to the converting view; error banner gained an icon
- `npm run ui:shots` captures every state for design review (test-results/ui/)

## 1.1.0 — Trustworthy + Beta foundation
- Removed remote fonts/cMaps; zero third-party requests; tightened CSP
- Moved host access to optional; narrowed content scripts; added side panel + shortcut
- Real per-model token ledger (Claude/ChatGPT/Gemini/Local) + budgets + truncation
- Functional presets (heading/table/citation/budget) with persistence
- New pipeline modules: boilerplate-remover, table-optimizer, markdown-cleaner, compression-engine, relevance-scorer
- No branding footer in output
- Page ranges, query-aware BM25 selection, prompt packs, quality report + warnings
- Local history (IndexedDB), batch queue, Pro license stub (local-only), OCR pilot stub
- Onboarding, actionable errors, feedback labels, opt-in telemetry
- Tests (vitest), benchmark gate, permission/network audits, CI workflow
- Docs: PRIVACY.md, STORE_LISTING.md, QUALITY_RUBRIC.md, COMPETITOR_MATRIX.md
