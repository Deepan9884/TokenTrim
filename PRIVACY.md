# TokenTrim Privacy Policy

**Last updated:** 2026-10-05 · **Version:** 1.2.0

## Summary
TokenTrim converts documents to Markdown **locally by default**. Document bytes,
filenames, URLs, and page text stay on your device unless you explicitly enable
cloud sync or opt-in telemetry. When those optional features are used, only the
data described below leaves the device, and only to endpoints you configure.

## What runs locally (default)
- PDF parsing (pdf.js, bundled)
- DOCX parsing (Mammoth, bundled)
- Markdown conversion (Turndown, bundled)
- Token estimation, compression, relevance scoring, history (IndexedDB)

## Network behavior
- **Default: zero third-party requests** in extension pages: no Google Fonts,
  no jsDelivr cMaps, no analytics endpoints.
- PDF cMaps / standard fonts load from the local bundle only.
- Fetching a PDF URL from a right-clicked link is a direct browser fetch of
  that URL at your request (same as opening the link). The extension now
  allows only `http(s)` document-like URLs, with a 30s timeout and 200 MB
  cap. The bytes stay in memory for conversion.
- **Optional cloud sync (off unless you sign in):** `POST/GET/DELETE
  /api/documents` and `POST /api/events` to your configured admin base URL
  (default `http://localhost:3100`; production `https://*.vercel.app` or your
  `ADMIN_ORIGIN`). Document endpoints send Markdown + title/preset/source
  type; events send allowlisted counters (`convert_success`, `copy`,
  `tokens_saved`, preset/source type) with 64-char string caps. Auth uses
  Bearer tokens or `tt_session` cookies. Disable anytime by signing out and
  clearing the base URL/token in Settings.

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
Cloud event upload (`/api/events`) requires sign-in and is off by default.

## Residual risks (disclosed)
- Auth token lives in `chrome.storage.local` (OS-protected, plaintext at rest);
  sign out clears it. Prefer `chrome.storage.session` semantics where available.
- Recovery uses a 4-digit PIN (10k space) with 5 tries/15 min rate limit +
  15-min lockout; choose a strong password (8-128 chars, upper/lower/digit/
  special enforced) and treat the PIN as a second factor, not a replacement.
- No MFA in v1. Single-session enforcement revokes other browsers on login.

## Data retention
- History lives in local IndexedDB; Clear anytime in History → Clear.
- Uninstalling removes local data.

## Contact
Report privacy issues via the Chrome Web Store support link or GitHub Issues (no file content, please).
