# TokenTrim — AI-Optimized Document Preprocessor

<div align="center">

### **Trim Document Tokens by 60–85% Before Sending to Claude, ChatGPT, or Gemini**
**100% Client-Side · Zero Server Uploads · Instant Local Markdown Extraction**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/Deepan9884/TokenTrim)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-10b981?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25_Local_WASM-e11d48?style=for-the-badge)](https://github.com/Deepan9884/TokenTrim)

[**Download Ready-to-Install ZIP**](TokenTrim-Extension.zip) • [**Quick Installation**](#-quick-installation-guide) • [**How It Works**](#-complete-demo--workflow) • [**Supported Formats**](#-supported-formats--benchmarks) • [**Privacy Guarantee**](#-privacy--security-architecture)

</div>

---

## ⚡ The Problem: LLM Token Overload

When you upload raw PDFs, Word documents, presentations, or spreadsheets to LLMs (Claude, ChatGPT, Gemini, DeepSeek):
1. **Bloated Context Windows**: Headers, footers, page numbers, duplicate XML wrappers, and decorative tables consume thousands of unnecessary tokens.
2. **Context Degradation ("Lost in the Middle")**: Long, noisy documents degrade LLM reasoning and cause hallucinations.
3. **Expensive API Costs & Rapid Rate Limits**: You hit token caps and message quotas 3x faster than necessary.

### 💡 The Solution: TokenTrim
**TokenTrim** is a lightweight, zero-latency browser extension that preprocesses any document right inside your browser. It extracts structure, cleans repetitive noise, and converts the document into high-density, prompt-ready Markdown tuned for your target AI model — **saving between 60% and 85% of token overhead**.

---

## 🎮 Complete Demo & Workflow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TOKEN TRIM EXTENSION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Preset: Claude 3.5 / Sonnet ▼ ]   [ Range: All Pages (e.g. 1-3, 5) ]    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    DRAG & DROP DOCUMENT HERE                          │  │
│  │         PDF, DOCX, PPTX, XLSX, CSV, Images (OCR), HTML, EPUB          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│  [ In-Browser WASM Parser & Noise Cleaner: Extracted in 280ms ]             │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  STATUS: CONVERSION SUCCESS                                           │  │
│  │  Original Tokens : 8,420                                              │  │
│  │  Cleaned Tokens  : 2,150                                              │  │
│  │  Token Savings   : 6,270 (74.5% SAVED)                                │  │
│  │                                                                       │  │
│  │  [ 📋 Copy Clean Markdown ]     [ 💾 Save Document ]     [ 🔄 Reset ] │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
       [ Paste directly into Claude / ChatGPT / Gemini / DeepSeek ]
```

### Step-by-Step Demo:
1. **Open Extension**: Click the TokenTrim extension icon in your browser toolbar.
2. **Select Target Model**:
   * **Claude**: Structured with semantic tags and hierarchical heading preservation.
   * **GPT-4o**: Compact bulleted markdown with token minimization.
   * **Gemini**: Standard structural markdown with normalized table formatting.
   * **DeepSeek / Open Models**: Maximum density stripped of all decorative whitespace.
3. **Drop Document**: Drop any PDF, Word document, slide deck, spreadsheet, or screenshot.
4. **Instant In-Browser Conversion**: TokenTrim parses the document in milliseconds using local WebAssembly.
5. **Live Token Savings**: View your exact token count before and after reduction.
6. **Copy & Use**: Click **Copy Clean Markdown** to paste directly into your chat prompt.

---

## 🚀 Quick Installation Guide

Install TokenTrim in 30 seconds — no build tools, terminal, or Node.js required:

### Step 1: Download the Extension ZIP
Download [`TokenTrim-Extension.zip`](TokenTrim-Extension.zip) directly from the root of this repository.

### Step 2: Unzip the File
Extract `TokenTrim-Extension.zip` into a folder on your computer (e.g. `Downloads/TokenTrim-Extension`).

### Step 3: Load into Your Chromium Browser

#### For Google Chrome:
1. Open Chrome and navigate to `chrome://extensions` in the address bar.
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. In the top-left corner, click **Load unpacked**.
4. Select the extracted `TokenTrim-Extension` folder.

#### For Brave Browser:
1. Navigate to `brave://extensions`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the extracted folder.

#### For Microsoft Edge:
1. Navigate to `edge://extensions`.
2. Toggle on **Developer mode** in the left sidebar.
3. Click **Load unpacked** and select the extracted folder.

#### For Arc Browser:
1. Navigate to `arc://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Step 4: Pin to Toolbar
Click the Extensions puzzle icon in your browser toolbar and click **Pin** next to **TokenTrim**. You're ready to go!

---

## 📊 Supported Formats & Benchmarks

| Document Type | Formats Supported | Avg. Token Reduction | Parsing Engine |
| :--- | :--- | :---: | :--- |
| **PDF Documents** | `.pdf` | **68%** | Local PDF.js WASM Engine |
| **Word Processing** | `.docx`, `.doc` | **72%** | Client-Side XML Stream Parser |
| **Presentations** | `.pptx`, `.ppt` | **81%** | Slide Structure & Outline Extractor |
| **Spreadsheets** | `.xlsx`, `.csv`, `.tsv` | **79%** | Markdown Table Optimizer |
| **Scanned Documents & Photos** | `.png`, `.jpg`, `.jpeg`, `.webp` | **64%** | In-Browser Tesseract.js OCR |
| **Web & E-Books** | `.html`, `.epub`, `.txt` | **60%** | Boilerplate & Semantic Text Parser |

---

## 🔒 Privacy & Security Architecture

TokenTrim was built with a strict **Privacy-First, Zero-Data-Leakage** guarantee:

* 🛡️ **100% Client-Side Processing**: Document conversion and optical character recognition happen exclusively inside your browser's V8 engine using WebAssembly (WASM).
* 🚫 **No Document Uploads**: Your file contents, text, images, and tables are **never** uploaded to any backend server or external cloud API.
* 🔐 **Ephemeral Memory**: Once you close the popup or clear your document, extracted memory is immediately garbage-collected.
* 📦 **Offline Capable**: All conversion engines (PDF parser, DOCX extractor, OCR weights) are fully self-contained inside the extension bundle.

---

## 🛠️ FAQ & Troubleshooting

<details>
<summary><b>Why is TokenTrim distributed as an unpacked ZIP?</b></summary>
Distributing as an unpacked extension gives users full transparency and instant access without waiting for web store review cycles. You can inspect the bundled manifest and code directly.
</details>

<details>
<summary><b>Does TokenTrim work when I'm offline?</b></summary>
Yes! The core parsing engines (PDF, DOCX, XLSX, HTML, and OCR) are completely packaged inside the extension ZIP and do not require an active internet connection to convert documents.
</details>

<details>
<summary><b>Can I convert scanned PDFs or images?</b></summary>
Yes. TokenTrim includes built-in Optical Character Recognition (OCR) powered by local WebAssembly. If a document page is an image or scanned document, TokenTrim automatically extracts the textual content into structured Markdown.
</details>

---

## 📄 License

Distributed under the **MIT License**.

Developed with ❤️ for developers, researchers, and AI power-users.
