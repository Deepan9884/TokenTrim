# TokenTrim Extension (Chrome / Chromium MV3)

Private, client-side document converter turning PDFs, Word docs, PowerPoint presentations, spreadsheets, images, text, and EPUBs into clean, token-optimized Markdown for Claude, ChatGPT, and Gemini.

---

## Directory Structure
```
extension/
├── manifest.json       # Manifest V3 specification
├── popup.html          # Extension main popup interface
├── popup.css           # Premium dark-mode UI stylesheet
├── popup.js            # Frontend controller & UI interactions
├── sidepanel.html      # Chrome Side Panel interface
├── sidepanel.js        # Side Panel controller
├── background.js       # Background service worker & context menus
├── content.js          # Webpage capture & article extractor
├── icons/              # Extension icons (16, 32, 48, 128)
├── icons-sprite.svg    # Vector icon sprite sheet
├── lib/                # Client-side document engines & API client
│   ├── converter.js    # Multi-engine parser dispatcher
│   ├── admin-api.js    # API client connecting to backend
│   ├── tokenizer.js    # Token counting (BPE, Claude, GPT, Gemini)
│   ├── presets.js      # AI model optimization profiles
│   ├── pdf.js          # PDF.js engine
│   └── converters/     # Specialized parsers (DOCX, PPTX, XLSX, etc.)
├── esbuild.config.js   # Production bundler
└── package.json
```

---

## Building the Extension
```bash
cd extension
npm install
npm run build
```
The bundled, ready-to-load extension will be generated in `extension/dist/`.

---

## Loading into Chrome / Brave / Edge
1. Open Chrome/Brave/Edge and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in top right).
3. Click **Load unpacked**.
4. Select the `extension/dist` folder (or the root `dist` folder if built from top-level).
5. The TokenTrim extension icon will appear in your browser toolbar!

---

## Connecting to Backend API (Vercel)
By default:
- For local testing: connects to `http://localhost:3100`.
- In production: enter your Vercel backend URL (e.g. `https://your-backend.vercel.app`) in the extension Settings tab or configure it via `AdminAPI.setBaseUrl('https://your-backend.vercel.app')`.
- All features (PDF/DOCX/PPTX parsing, compression, token counting, copying) work 100% locally and offline even without a backend!
