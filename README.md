<p align="center">
  <img src="icons/logo-horizontal.svg" alt="TokenTrim Logo" width="340">
</p>

# TokenTrim - PDF to Markdown Converter

Convert PDF, Word, PowerPoint, image, spreadsheet, text & EPUB files into clean, AI-optimized Markdown.

![TokenTrim Extension](https://img.shields.io/badge/manifest-v3-blue) ![Status](https://img.shields.io/badge/status-production--ready-green)

---

## 🏛️ Modular Project Architecture

TokenTrim is organized into 3 decoupled projects designed for independent hosting and scaling:

```
TokenTrim/
├── extension/        # Chrome Extension (standalone client, zero external deps)
├── admin-frontend/   # Admin Dashboard UI (configured for Netlify deployment)
└── backend/          # Serverless API Backend (configured for Vercel deployment)
```

| Component | Target Platform | Description |
| :--- | :--- | :--- |
| **`extension/`** | Chrome Web Store / Chromium | Client-side converter with token estimator, cloud sync client & opt-in telemetry |
| **`admin-frontend/`** | **Netlify** | Next.js admin dashboard UI with `/api/*` reverse-proxy to Vercel via `netlify.toml` |
| **`backend/`** | **Vercel** | Next.js Serverless API hosting auth, document cloud sync, events & admin metrics |

---

## ✨ Features

- **🎯 AI-Optimized Output** - Markdown formatted specifically for LLM consumption
- **⚡ Client-Side Processing** - All conversion happens locally in your browser (no data leaves your device)
- **🔒 Privacy First** - Zero server calls, zero tracking, zero data collection
- **📊 Token Optimization** - Automatically reduces token count by stripping redundant headers, footers, and formatting
- **🎨 Beautiful UI** - Clean, modern interface with real-time progress tracking
- **📋 One-Click Copy** - Copy converted Markdown directly to clipboard
- **💾 Download Support** - Save Markdown files locally
- **🖱️ Context Menu Integration** - Right-click any PDF link to convert
- **📄 Table Formatting** - Intelligent table detection and Markdown conversion

## 📦 Installation

### Option 1: Chrome Web Store (Recommended - Coming Soon)

Once published, you'll be able to:
1. Visit Chrome Web Store
2. Click "Add to Chrome"
3. Start converting PDFs immediately

### Option 2: Build from Source

#### Quick Setup (Automated)

```powershell
# 1. Download PDF.js automatically
.\setup-pdfjs.ps1

# 2. Generate production icons
start tools/generate-production-icons.html
# Click "Download All Icons" and move to icons/ folder

# 3. Build production package
.\build.ps1

# 4. Load in Chrome
# Open chrome://extensions/
# Enable Developer mode
# Click "Load unpacked"
# Select the dist/ folder
```

#### Manual Setup

1. **Clone Repository:**
```bash
git clone <repository-url>
cd TokenTrim
```

2. **Install PDF.js Library:**
   - Visit [PDF.js releases](https://github.com/mozilla/pdf.js/releases)
   - Download **legacy build** (e.g., `pdfjs-4.x.x-legacy-dist.zip`)
   - Extract `pdf.js` and `pdf.worker.js` into `lib/` folder

3. **Generate Icons:**
   - Open `tools/generate-production-icons.html`
   - Click "Download All Icons"
   - Move files to `icons/` folder

4. **Load Extension:**
   - Open `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `TokenTrim` folder

For detailed instructions, see [INDEPENDENT_DISTRIBUTION_GUIDE.md](INDEPENDENT_DISTRIBUTION_GUIDE.md)

## 🚀 Usage

### Method 1: Upload PDF Directly

1. Click the TokenTrim extension icon in your browser toolbar
2. Drag and drop a PDF file into the dropzone (or click to browse)
3. Configure conversion options (strip headers, format tables)
4. Click **Convert to Markdown**
5. Copy the result or download the `.md` file

### Method 2: Context Menu (Right-Click)

1. Right-click any PDF link on a webpage
2. Select **"Convert PDF for AI chat"** from the context menu
3. Click the extension icon to open the popup
4. The PDF will be loaded and ready to convert

### Method 3: From PDF Pages

1. Open a PDF file in Chrome (embedded PDFs work too)
2. Right-click anywhere on the page
3. Select **"Convert this PDF for AI chat"**
4. Click the extension icon to complete the conversion

## ⚙️ Conversion Options

### Strip Redundant Headers & Footers
Removes repetitive page titles, page numbers, and standard footers that add noise to AI prompts.

### Format Tables for Claude/ChatGPT
Converts complex PDF tables into clean Markdown tables optimized for token efficiency.

## 🎯 Use Cases

- **📚 Research Papers** - Convert academic PDFs for analysis and summarization
- **📊 Business Reports** - Extract financial reports and quarterly earnings
- **📋 Documentation** - Transform technical docs into AI-readable format
- **📝 Presentations** - Convert slide decks into structured Markdown
- **📖 Books & Articles** - Extract long-form content for discussion

## 🏗️ Project Structure

```
TokenTrim/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html            # Main UI structure
├── popup.css             # Styles with exact Material Design 3 tokens
├── popup.js              # UI logic and PDF conversion
├── background.js         # Service worker (context menus, notifications)
├── content.js            # Content script (PDF detection)
├── lib/                  # PDF.js library files (you add these)
├── icons/                # Extension icons (you add these)
└── design/               # Original Stitch design files
```

## 🔧 Technical Details

### Architecture

- **Manifest Version:** V3
- **Permissions:** `activeTab`, `contextMenus`, `storage`, `scripting`
- **PDF Parser:** PDF.js (Mozilla)
- **Design System:** Material Design 3
- **Fonts:** Inter, JetBrains Mono

### Browser Compatibility

- ✅ Chrome 88+
- ✅ Edge 88+
- ✅ Brave
- ✅ Opera
- ❌ Firefox (requires Manifest V2 or adaptation)
- ❌ Safari (requires different extension format)

### File Size Limits

- Maximum PDF size: **50 MB**
- Recommended for best performance: **< 10 MB**

## 🎨 Design

The UI design was created in Stitch and implements Google's Material Design 3 specification with:

- **60+ CSS color variables** from Material Design 3 palette
- **Typography system** using Inter and JetBrains Mono
- **8-point spacing scale** (2xs to 2xl)
- **4 distinct states:** Empty, Loaded, Converting, Success
- **Smooth animations** and progress indicators

## 🔒 Privacy & Security

- **Local by default** - Conversion runs client-side in your browser.
- **Optional sync only** - Cloud documents (`/api/documents`) and event upload
  (`/api/events`) happen only after you sign in and configure a base URL.
- **No silent tracking** - Local telemetry counters are opt-in; see `PRIVACY.md`.
- **Open source** - Inspect the code yourself.
- Full details (endpoints, retention, residual risks): `PRIVACY.md`.

## 🐛 Troubleshooting

### Extension won't load
- Ensure you're in Developer mode (`chrome://extensions`)
- Check that all required files are present
- Verify PDF.js files are in the `lib/` folder

### PDF conversion fails
- Confirm `pdf.js` and `pdf.worker.js` are installed in `lib/`
- Check that you downloaded the **legacy build** of PDF.js
- Try with a smaller PDF file first
- Check the browser console for errors (F12 → Console)

### Context menu not appearing
- Reload the extension after installation
- Right-click directly on a `.pdf` link or PDF page
- Ensure the link URL contains `.pdf` in the path

### Blank popup or styling issues
- Check that `popup.css` is loaded correctly
- Verify Google Fonts are loading (requires internet connection)
- Try reloading the extension

## 🚧 Known Limitations

- Complex PDF layouts may not convert perfectly
- Scanned PDFs (images) are not supported (requires OCR)
- Password-protected PDFs cannot be processed
- Very large PDFs (>50MB) may cause performance issues
- Some advanced PDF features (forms, annotations) are ignored

## 🛣️ Roadmap

Future enhancements planned:

- [ ] OCR support for scanned PDFs
- [ ] Batch conversion of multiple PDFs
- [ ] Custom conversion presets (Claude, ChatGPT, etc.)
- [ ] History of converted files
- [ ] Advanced table detection algorithms
- [ ] Export to other formats (JSON, XML, etc.)
- [ ] Keyboard shortcuts
- [ ] Dark mode

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development Setup

1. Clone the repository
2. Install PDF.js in `lib/` folder
3. Load unpacked extension in Chrome
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **PDF.js** by Mozilla - PDF parsing engine
- **Material Design 3** by Google - Design system
- **Stitch** - UI design tool
- **Inter** and **JetBrains Mono** - Typography

## 📬 Support

Having issues or questions? 

- Check the [Troubleshooting](#-troubleshooting) section
- Review existing issues on GitHub
- Create a new issue with details about your problem

## 📊 Version History

### v1.0.0 (Beta)
- Initial release
- Client-side PDF to Markdown conversion
- Context menu integration
- Token optimization features
- Material Design 3 UI

---

**Made with ❤️ for the AI community**

*Convert PDFs, optimize tokens, chat smarter.*


## 🏭 Production Distribution

TokenTrim is now fully independent and ready for public distribution!

### For Publishers

Complete production setup with automated tools:

```powershell
# 1. Download dependencies
.\setup-pdfjs.ps1

# 2. Generate professional icons
start tools/generate-production-icons.html

# 3. Build production package
.\build.ps1

# 4. Submit to Chrome Web Store
# Upload TokenTrim-1.0.0.zip
```

### Documentation for Distribution

- **[INDEPENDENT_DISTRIBUTION_GUIDE.md](INDEPENDENT_DISTRIBUTION_GUIDE.md)** - Complete distribution guide
- **[PRIVACY_POLICY.md](PRIVACY_POLICY.md)** - Privacy policy (must host publicly)
- **[STORE_LISTING.md](STORE_LISTING.md)** - Chrome Web Store listing details
- **[setup-production.md](setup-production.md)** - Step-by-step production setup

### Automated Tools

- **setup-pdfjs.ps1** - Auto-downloads PDF.js from GitHub releases
- **build.ps1** - Creates production-ready ZIP package
- **tools/generate-production-icons.html** - Professional icon generator
- **verify.html** - Pre-launch verification checker

### Distribution Channels

1. **Chrome Web Store** (Recommended)
   - Professional distribution
   - Automatic updates
   - User trust & discovery
   - See [STORE_LISTING.md](STORE_LISTING.md)

2. **GitHub Releases**
   - Open source distribution
   - Manual updates required
   - Users need Developer mode

3. **Direct Website**
   - Full control
   - Custom branding
   - Requires hosting

See [INDEPENDENT_DISTRIBUTION_GUIDE.md](INDEPENDENT_DISTRIBUTION_GUIDE.md) for complete details.
