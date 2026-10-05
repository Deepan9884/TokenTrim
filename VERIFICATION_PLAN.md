# TokenTrim v1.1.0 — Verification Plan (as built)

**Goal:** prove every feature works in a live browser. Four layers, all runnable locally and in CI.

## Layers & commands

| Layer | Command | Gate |
|---|---|---|
| Unit (20 tests, 7 modules) | `npm test` | 20/20 pass |
| Quality benchmark | `npm run benchmark` | lossless recall ≥ 95%, budget enforced, no footer |
| Security audits | `npm run audit:permissions` + `npm run audit:network` | PASS / zero third-party requests |
| Live E2E (Playwright + Chromium) | `npm run build && npm run e2e:fixtures && npm run test:e2e` | all specs green |
| Full release gate | `npm test && npm run benchmark && npm run audit:permissions && npm run audit:network && npm run build && npm run test:e2e` | everything green |

Headed is required (extension UI doesn't render in headless shell). Linux CI uses `xvfb-run` (see `.github/workflows/e2e.yml`).

## E2E architecture (`tests/e2e/`)

- `playwright.config.ts` — sequential (`workers: 1`, extension state), 60s tests, trace/screenshot/video on failure, `utils/global-setup.ts` fails fast if `dist/` or fixtures are missing.
- `utils/extension.ts` — worker-scoped persistent Chromium with `dist/` loaded (`--disable-extensions-except` + `--load-extension`), extension id from the service worker URL, clipboard permissions granted; test-scoped `popupPage` (storage cleared, IndexedDB dropped, onboarding marked done, lands on empty view). Helpers: `uploadAndWait`, `dropAndWait` (real `DataTransfer` drop), `copyFullMarkdown`, `stubDownloads` (captures payload instead of native Save-As), `loadSyntheticFile` (60 MB / wrong-type / edge files via `window.TokenTrim.loadFile`).
- `fixtures/generate-fixtures.js` — reproducible minimal PDFs with correct xref (simple, table, headers×3pp, large×20pp, research, contract, blank scanned, corrupt bytes, zero-byte) + `simple.docx` via JSZip. Fixtures self-validated against the project's own pdf.js + Mammoth.

## Coverage (spec → scenarios)

| Spec | IDs | What it proves live |
|---|---|---|
| `conversion.spec.ts` | C01–C06 + scanned/corrupt | browse + real drop-path convert; DOCX badge/table; 60MB/wrong-type/zero-byte rejections; scanned→guidance; corrupt→actionable error, never junk |
| `options.spec.ts` | O01–O15 + O13b–O13d, O14b | strip/table toggles change output; lossless ≥ extractive ≥ aggressive length ordering; 4K budget enforced + warning; research preset keeps facts; single/multi-range ("1-2, 20") extraction with exact report; invalid input blocks with inline + banner errors; out-of-range surfaces page count; query keeps relevant section; no-match keeps full doc honestly |
| `success-actions.spec.ts` | S01–S08 | clipboard holds full markdown (footer-free); download payload is `.md` data URL; both prompt packs wrap source in `<untrusted-document>`; convert-another resets; badge/report/feedback render |
| `presets-settings.spec.ts` | P01–P09 | modal opens both ways; switch updates + persists reload; defaults/telemetry/OCR persist to storage; invalid license rejected; `TT-PRO-…` activates Pro + 200MB hint |
| `history.spec.ts` | H01–H05 | entry listed, re-open restores, delete/clear work, survives reload |
| `batch.spec.ts` | B01–B04 | 3-file queue → 3×done with tokens; promote-to-success; corrupt item errors independently |
| `onboarding.spec.ts` | OB1–OB4 | fresh → onboarding; consent enables flag; skip sets flag; never repeats |
| `sidepanel.spec.ts` | SP1–SP5 | panel converts; pending-handoff over real (intercepted) HTTP fetch → load → convert; panel copy/download; preset+mode reshape output |
| `integration.spec.ts` | CM-handler, KS1-manifest, PS1–PS5 | background `convertPdf` message stores pending URL; manifest declares shortcut + side panel + least privilege and matches package version; **zero** googleapis/gstatic/jsdelivr/unpkg/cdnjs requests during open+convert; no CSP/fetch console errors; no footer |

## Honest non-automatable (marked `test.fixme` + manual steps in-spec)

- Native OS right-click menu clicks (CM1/CM2) — handler + handoff automated; click itself manual.
- OS-level `Ctrl+Shift+T` dispatch (KS1-live) — declaration asserted; dispatch manual.
- Encrypted-PDF fixture (no generator) — PASSWORD_PROTECTED mapping manual with any locked PDF.

## Pre-release manual checklist

`dist/` loads clean in `chrome://extensions` · popup 380×500 all states, no console errors · side panel ~380px converts · menus show correct labels · shortcut opens popup · DevTools Network = 0 external · storage/IndexedDB hold presets+history · keyboard/ARIA pass · password/corrupt/scanned/empty/>50MB files behave per error catalog · free gates batch/OCR/history, `TT-PRO-` unlocks.

## Pass criteria

50+ automated scenarios green · 20/20 unit · benchmark 100% lossless recall (current) · both audits PASS · zero console errors · manual checklist complete.

## Current results (2026-09-20, live Chromium, 2 consecutive full runs)

- E2E: **58 passed, 0 failed, 2 skipped** (`test-results/` holds traces/screenshots) — skips are the only 2 non-automatable checks (native OS menu clicks, OS shortcut dispatch); encrypted-PDF is now a real automated test via `password.pdf` (AES, password `test123`, generated by `fixtures/generate-password.py`).
- Unit: **35/35** (8 files, incl. new `page-range.test.js` with real-PDF multi-range cases) · benchmark 100% recall · both audits PASS · `TokenTrim-1.1.0.zip` rebuilt (1.28 MB, 39 files).
- Custom page extraction: single input accepts "1-20, 29-31" / "5" / "1-5, 8, 11-13" (`lib/page-range.js`); converter filters by explicit page list with clamping, honest `Page range X extracted (N of M)` report, and `PAGE_RANGE_INVALID` errors that bypass content fallback; invalid input blocks convert with inline + banner errors.
- Rouge & Ivory redesign: BETA badge removed; crimson/ivory theme; real vector icons via a local 11.5KB Material Symbols sprite (`tools/fetch-icons.js`, inlined in popup.html — the earlier remote-font removal had left icon names rendering as plain text); cat-yarn loader rebuilt with synced master cycle; progress shimmer, tabular numerals, view-enter motion, focus rings; missing cat-scene markup added to the converting view; error banner gained an icon. Visual proof: `npm run ui:shots` → `test-results/ui/` (empty/loaded/converting/success/settings).
- E2E caught and fixed 5 real product bugs: digit-normalization eating numbered body text; dropped text→table detection; racy auto-convert (now `window.__TT_MANUAL` hook); no-match queries silently returning 1 arbitrary section (now keeps full doc + honest warning); onboarding "Try with sample" button that loaded no sample (relabeled "Get started"). Also cleaned a dead `!pro && false` expression on the batch button, hardened the harness (persisted-settings baseline reset between tests), and fixed a stale O01b test still racing auto-convert.
