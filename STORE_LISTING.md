# TokenTrim — Chrome Web Store Listing (v1.1.0)

## Name
TokenTrim - PDF to Markdown

## Tagline
Give your AI the document, not the noise.

## Description
Private PDF and Word (DOCX) → AI-ready Markdown with measurable token savings for Claude, ChatGPT, Gemini, and local models.

- 100% local conversion — no uploads, no servers
- Model-specific token ledger (Claude / ChatGPT / Gemini / Local)
- Token budgets (4K/8K/16K/32K) + Lossless / Extractive / Aggressive modes
- Query-aware section selection (BM25, local)
- Page ranges, table optimizer, boilerplate remover, prompt packs
- Side panel + right-click + keyboard shortcut (Ctrl+Shift+T)
- Local history (IndexedDB), batch queue, OCR pilot (Pro)

## Screenshots (to capture)
1. Empty state → drop PDF
2. Loaded state with budget/mode/page-range
3. Success with token ledger + quality report
4. Side panel converting a linked PDF

## Permission rationale (store)
- activeTab/scripting: detect + convert the PDF you chose
- contextMenus: right-click PDF links
- storage: presets/flags/license (local)
- downloads: save .md
- sidePanel: in-page conversion
- optional host: fetch only the PDF URL you right-clicked

## Support
PRIVACY.md + GitHub Issues. Response SLA <24h during launch.
