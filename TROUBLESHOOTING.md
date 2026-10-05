# TokenTrim Extension - Troubleshooting Upload Button

## Issue: Upload Button Not Working

If the "Choose File" button or drag-and-drop isn't working in the extension popup, follow these steps:

### 1. Check Extension is Loaded
1. Open `brave://extensions/` (or `chrome://extensions/`)
2. Enable **Developer mode** (toggle in top-right)
3. Look for **TokenTrim - PDF to Markdown**
4. Status should show enabled with no errors
5. If you see errors, click "Details" to view them

### 2. Open Browser Console for Popup
1. Right-click the TokenTrim extension icon in toolbar
2. Select **"Inspect popup"** (Chrome) or **"Inspect"** (Brave)
3. This opens DevTools for the popup window
4. Go to **Console** tab
5. Look for errors (red text)

### 3. Common Errors & Fixes

#### Error: "Cannot find module 'lib/converter.js'"
**Fix:** The converter.js file is missing or not in the right place.
- Extract the ZIP completely
- Ensure `lib/converter.js` exists in the extension folder

#### Error: "PDF.js library not found"  
**Fix:** PDF.js files are missing.
- Check that `lib/pdf.js` and `lib/pdf.worker.js` exist
- File sizes should be: pdf.js (~300KB), pdf.worker.js (~1MB)
- If missing, run: `powershell -ExecutionPolicy Bypass -File download-pdfjs.ps1`

#### Error: "Refused to execute inline script"
**Fix:** Content Security Policy issue.
- This should not happen with the current manifest
- If it does, the manifest.json needs updating

#### No errors but button does nothing
**Fix:** JavaScript might not be loading.
1. In popup DevTools Console, type: `window.TokenTrim`
2. If it shows `undefined`, popup.js didn't load
3. Check for syntax errors in popup.js
4. Reload extension: brave://extensions/ → click reload icon

### 4. Test File Input Directly
In popup DevTools Console, run:
```javascript
// Test if file input exists
document.getElementById('fileInput')
// Should show: <input type="file" id="fileInput" ...>

// Test if dropzone exists
document.getElementById('dropzone')
// Should show: <div id="dropzone" ...>

// Manually trigger file picker
document.getElementById('fileInput').click()
// Should open file picker dialog
```

### 5. Test Module Import
In popup DevTools Console, run:
```javascript
// Test if converter module loaded
import(chrome.runtime.getURL('lib/converter.js')).then(module => {
  console.log('Converter loaded:', module.converter);
}).catch(err => {
  console.error('Converter failed:', err);
});
```

### 6. Force Reload Extension
1. Go to `brave://extensions/`
2. Click the **reload icon** (circular arrow) under TokenTrim
3. Close any open popup windows
4. Click the TokenTrim icon again to open fresh popup

### 7. Check File Permissions
If you're testing on Windows and files extracted from ZIP:
1. Right-click the extension folder
2. Properties → Security tab
3. Make sure your user has Read & Execute permissions

### 8. Try Test Page
Open `test-extension.html` in your browser to run diagnostics:
1. File → Open File → select test-extension.html
2. Run all tests
3. Check results for specific errors

---

## Still Not Working?

### Get Detailed Logs:
1. Open popup with DevTools (right-click icon → Inspect)
2. Go to Console tab
3. Click "Choose File" or drag a PDF
4. Copy ALL console output (right-click → Save as...)
5. Share the console log for debugging

### Manual Test:
Create a simple test HTML file with file input:
```html
<!DOCTYPE html>
<html>
<body>
  <input type="file" accept=".pdf" onchange="alert('File selected: ' + this.files[0].name)">
</body>
</html>
```
If this works but the extension doesn't, the issue is in popup.js event handlers.

---

## Expected Behavior

When working correctly:
1. Click empty dropzone → file picker opens
2. Select PDF → shows "Loaded" state with file info
3. Click "Convert to Markdown" → shows progress
4. Completes → shows success with Copy/Download buttons

## Debug Steps in Order:
1. ✅ Extension loaded in brave://extensions/
2. ✅ No errors in extension details
3. ✅ Right-click icon → Inspect popup → Console shows no errors
4. ✅ Console shows "PDF.js initialized successfully"
5. ✅ Can see the dropzone in popup window
6. ✅ Clicking dropzone opens file picker
7. ✅ Selecting PDF file triggers state change

If any step fails, that's where the problem is!
