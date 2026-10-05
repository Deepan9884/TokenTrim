# TokenTrim Privacy Policy

**Last updated:** 2026-09-20 · **Version:** 1.1.0

## Summary
TokenTrim converts PDF and DOCX files to Markdown **entirely on your device**. Document bytes, filenames, URLs, and page text are never transmitted to us or any third party.

## What runs locally
- PDF parsing (pdf.js, bundled)
- DOCX parsing (Mammoth, bundled)
- Markdown conversion (Turndown, bundled)
- Token estimation, compression, relevance scoring, history (IndexedDB)

## Network behavior
- **Zero third-party requests** in extension pages: no Google Fonts, no jsDelivr cMaps, no analytics endpoints.
- PDF cMaps / standard fonts load from the local bundle only (remote URLs removed in v1.1).
- Fetching a PDF URL from a right-clicked link is a direct browser fetch of that URL at your request (same as opening the link). The bytes stay in memory for conversion.

## Permissions (why each)
- `activeTab` — read the current PDF tab when you invoke conversion.
- `contextMenus` — right-click PDF links/pages.
- `storage` — presets, flags, license, opt-in telemetry counts (local only).
- `scripting` — PDF detection helpers.
- `downloads` — save `.md` files.
- `sidePanel` — direct conversion panel.
- `optional_host_permissions: <all_urls>` — only requested when fetching a PDF link you chose; never auto-granted browsing access.

## Telemetry (opt-in, off by default)
When enabled, we store **anonymous counters only** in `chrome.storage.local`: event names (`convert_success`, `copy`, …), page counts, token counts, preset id. No content, filenames, URLs, or clipboard. Disable anytime in Settings.

## Data retention
- History lives in local IndexedDB; Clear anytime in History → Clear.
- Uninstalling removes local data.

## Contact
Report privacy issues via the Chrome Web Store support link or GitHub Issues (no file content, please).
