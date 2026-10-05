# TokenTrim - Quick Fix Guide for Upload Issues

## Your Diagnostic Results Show:
✅ All libraries loaded (Mammoth, Turndown, GFM)
✅ File input works
✅ PDF file detected correctly
❌ Converter module fails when testing as standalone HTML (this is EXPECTED)

## The Real Test: Check the Extension Popup

Since the diagnostic was run as a standalone page, the converter module couldn't load (ES6 module restrictions). You MUST test in the actual extension popup.

### Step-by-Step Test:

#### 1. Load/Reload the Extension
1. Open `chrome://extensions/` (or `brave://extensions/`)
2. Enable **Developer mode** (top-right toggle)
3. Click **"Load unpacked"** and select the `TokenTrim` folder
4. OR if already loaded, click the **reload icon** (🔄) on the TokenTrim card

#### 2. Inspect the Extension Popup
1. Click the **TokenTrim icon** in your browser toolbar to open the popup
2. **Right-click anywhere in the popup** 
3. Select **"Inspect"** (Chrome) or **"Inspect Element"** (Brave)
4. This opens Developer Tools - go to the **Console** tab

#### 3. Look for These Messages:
You should see:
```
[TokenTrim] Popup initializing...
[TokenTrim] Dropzone events registered
[TokenTrim] File input change listener registered
[TokenTrim] Popup initialized successfully
[TokenTrim] Background service worker loaded
```

If you see errors instead, copy them and share them.

#### 4. Test File Upload in Popup
With the popup open AND DevTools Console visible:
1. Click the dropzone or "Choose PDF or DOCX File" button
2. Select your PDF file
3. Watch the Console for messages

**Expected Console Output:**
```
[TokenTrim] File selected: YourFile.pdf size: 22000 type: application/pdf
[TokenTrim] Automatically starting conversion for: YourFile.pdf
[TokenTrim] Transitioning to CONVERTING state for: YourFile.pdf
[TokenTrim] Starting conversion with options: {stripHeaders: true, formatTables: true}
[TokenTrim] Progress: 5% - Initializing PDF parser...
[TokenTrim] Progress: 10% - Reading PDF file...
... etc ...
```

#### 5. Common Problems & Solutions:

**Problem: Popup shows blank/white screen**
- Solution: Check Console for errors, likely a JavaScript error

**Problem: "Cannot find module" error**
- Solution: Make sure these files exist:
  - `lib/converter.js`
  - `lib/pdf.js`
  - `lib/pdf.worker.js`
  - `lib/mammoth.browser.min.js`
  - `lib/turndown.min.js`
  - `lib/turndown-plugin-gfm.js`

**Problem: File input doesn't open**
- Solution: Check Console, look for "Popup initialized successfully"
- If missing, there's an initialization error

**Problem: "Refused to load" or "CORS" errors**
- Solution: Check `manifest.json` has correct permissions
- Make sure extension is loaded from the correct folder

**Problem: Conversion starts but fails**
- Solution: Check the specific error message in Console
- Try a different, smaller PDF file

#### 6. Run These Tests in Popup Console:

Open the popup, then open DevTools Console, and run:

```javascript
// Test 1: Check initialization
window.TokenTrim

// Test 2: Check converter
typeof converter

// Test 3: Check file input
document.getElementById('fileInput')

// Test 4: Manually trigger file picker
document.getElementById('fileInput').click()

// Test 5: Check PDF.js
converter.pdfjsLib

// Test 6: Test file validation
const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
converter.validateFile(testFile)
```

### What Each Test Should Return:

1. `window.TokenTrim` → Object with functions (switchToState, loadFile, etc.)
2. `typeof converter` → "object"
3. `document.getElementById('fileInput')` → `<input type="file"...>`
4. File picker should open
5. `converter.pdfjsLib` → Object with PDF.js functions
6. `{valid: true}` or `{valid: false, error: "reason"}`

---

## If Extension Won't Load At All:

### Check manifest.json is valid:
```bash
cd e:\Projects\TokenTrim
type manifest.json
```

Make sure:
- No syntax errors
- All files referenced exist
- All paths are correct

### Verify all files are present:
```bash
dir lib\
```

Should show:
- converter.js
- mammoth.browser.min.js
- pdf.js (~300KB)
- pdf.worker.js (~1MB+)
- turndown.min.js
- turndown-plugin-gfm.js
- README.md

---

## Still Having Issues?

After testing in the actual extension popup, share:

1. **Extension Load Status**: Does it load in chrome://extensions/?
2. **Console Output**: Copy ALL console messages when you open popup
3. **Console Output**: Copy ALL console messages when you try to upload a file
4. **Test Results**: Results from running the 6 console tests above
5. **Screenshots**: If possible, screenshot of the error

The diagnostic showed your environment is working - now we need to see what's happening inside the extension popup specifically.
