# TokenTrim - Production Build Script
# Creates a production-ready package for Chrome Web Store
# Uses esbuild via npm for bundling, then packages the dist/ folder

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TokenTrim - Production Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$errors = @()
$warnings = @()

# Function to check file exists
function Test-RequiredFile {
    param($path, $description)
    if (Test-Path $path) {
        Write-Host "  [OK] $description" -ForegroundColor Green
        return
    } else {
        Write-Host "  [FAIL] $description" -ForegroundColor Red
        $script:errors += "Missing: $path"
        return
    }
}

Write-Host "Step 1: Running npm build (esbuild)" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

try {
    Write-Host "  Running: npm run build" -ForegroundColor Gray
    $npmResult = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] npm build failed" -ForegroundColor Red
        Write-Host $npmResult -ForegroundColor Red
        $errors += "npm build failed"
    } else {
        Write-Host "  [OK] esbuild completed successfully" -ForegroundColor Green
    }
} catch {
    $errors += "Failed to run npm build"
    Write-Host "  [FAIL] Failed to run npm build" -ForegroundColor Red
}

Write-Host ""

if ($errors.Count -gt 0) {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Build Failed" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    foreach ($err in $errors) {
        Write-Host "  [FAIL] $err" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
}

Write-Host "Step 2: Verifying Built Files in dist/" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Check core extension files in dist/
Test-RequiredFile "dist\manifest.json" "dist/manifest.json"
Test-RequiredFile "dist\popup.html" "dist/popup.html"
Test-RequiredFile "dist\popup.css" "dist/popup.css"
Test-RequiredFile "dist\popup.js" "dist/popup.js (bundled)"
Test-RequiredFile "dist\background.js" "dist/background.js"
Test-RequiredFile "dist\content.js" "dist/content.js"

# Check lib files in dist/
Test-RequiredFile "dist\lib\pdf.js" "dist/lib/pdf.js (PDF.js library)"
Test-RequiredFile "dist\lib\pdf.worker.js" "dist/lib/pdf.worker.js (PDF.js worker)"
Test-RequiredFile "dist\lib\mammoth.browser.min.js" "dist/lib/mammoth.browser.min.js (Mammoth DOCX library)"
Test-RequiredFile "dist\lib\turndown.min.js" "dist/lib/turndown.min.js (Turndown Markdown library)"
Test-RequiredFile "dist\lib\turndown-plugin-gfm.js" "dist/lib/turndown-plugin-gfm.js (Turndown GFM plugin)"
Test-RequiredFile "dist\lib\tesseract.min.js" "dist/lib/tesseract.min.js (Tesseract.js OCR engine)"
Test-RequiredFile "dist\lib\tesseract-worker.min.js" "dist/lib/tesseract-worker.min.js (Tesseract.js worker)"
Test-RequiredFile "dist\lib\tesseract-core\tesseract-core.wasm.js" "dist/lib/tesseract-core/tesseract-core.wasm.js (OCR WASM core)"
Test-RequiredFile "dist\lib\tessdata\eng.traineddata.gz" "dist/lib/tessdata/eng.traineddata.gz (OCR language data)"

# Check icons in dist/
Test-RequiredFile "dist\icons\icon16.png" "dist/icons/icon16.png"
Test-RequiredFile "dist\icons\icon48.png" "dist/icons/icon48.png"
Test-RequiredFile "dist\icons\icon128.png" "dist/icons/icon128.png"

Write-Host ""

if ($errors.Count -gt 0) {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Build Failed - Missing Required Files in dist/" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    foreach ($err in $errors) {
        Write-Host "  [FAIL] $err" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
}

Write-Host "Step 3: Validating Manifest" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

try {
    $manifest = Get-Content "dist\manifest.json" -Raw | ConvertFrom-Json
    
    Write-Host "  [OK] Manifest version: $($manifest.manifest_version)" -ForegroundColor Green
    Write-Host "  [OK] Extension name: $($manifest.name)" -ForegroundColor Green
    Write-Host "  [OK] Version: $($manifest.version)" -ForegroundColor Green
    Write-Host "  [OK] Description length: $($manifest.description.Length) chars" -ForegroundColor Green
    
    if ($manifest.description.Length -lt 10 -or $manifest.description.Length -gt 132) {
        $warnings += "Description should be 10-132 characters"
        Write-Host "  [WARN] Description length should be 10-132 characters" -ForegroundColor Yellow
    }
    
} catch {
    $errors += "Invalid manifest.json format"
    Write-Host "  [FAIL] manifest.json is not valid JSON" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host ""

Write-Host "Step 4: Checking Package Size" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

$totalSize = 0
Get-ChildItem -Path "dist" -Recurse -File | ForEach-Object {
    $totalSize += $_.Length
}

$sizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "  Total package size: $sizeMB MB" -ForegroundColor $(if ($sizeMB -lt 50) { "Green" } else { "Yellow" })

if ($sizeMB -gt 50) {
    $warnings += "Package size is large (>50MB)"
}

Write-Host ""

Write-Host "Step 5: Creating ZIP Package" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

$packageName = "TokenTrim-$($manifest.version).zip"

try {
    Write-Host "  Running: node tools/package-zip.js (standards-compliant forward slashes)" -ForegroundColor Gray
    node tools/package-zip.js
    if ($LASTEXITCODE -ne 0) { throw "node tools/package-zip.js failed" }
    $zipSize = [math]::Round((Get-Item $packageName).Length / 1MB, 2)
    Write-Host "  [OK] Created $packageName ($zipSize MB)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Failed to create ZIP package" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

Write-Host "Step 6: Verification" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Verify ZIP contents
$zipContents = Get-ChildItem -Path "dist" -Recurse -File
$fileCount = $zipContents.Count

Write-Host "  [OK] Package contains $fileCount files" -ForegroundColor Green

$requiredFiles = @("manifest.json", "popup.html", "popup.js", "popup.css", "background.js", "content.js")
foreach ($file in $requiredFiles) {
    if (Test-Path (Join-Path "dist" $file)) {
        Write-Host "  [OK] $file included" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $file missing from package!" -ForegroundColor Red
        $errors += "Missing from package: $file"
    }
}

# The admin panel is a separate web app (admin/) and must never ship in the extension ZIP.
$forbiddenNames = @("admin", ".next", "supabase", "tests")
$leaked = @(Get-ChildItem -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $forbiddenNames -contains $_.Name })
$leaked += @(Get-ChildItem -Path "dist" -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -like ".env*" })
if ($leaked.Count -gt 0) {
    foreach ($hit in $leaked) {
        Write-Host ("  [FAIL] Forbidden admin/server file in dist/: " + $hit.FullName) -ForegroundColor Red
    }
    $errors += "dist/ contains forbidden admin/server files (admin must ship separately)"
} else {
    Write-Host "  [OK] No admin/.next/supabase/tests files in dist/" -ForegroundColor Green
}

Write-Host ""

if ($warnings.Count -gt 0) {
    Write-Host "Warnings:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  [WARN] $warning" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($errors.Count -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Build Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Package created: $packageName" -ForegroundColor Green
    Write-Host "Size: $zipSize MB" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Build Failed" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    foreach ($err in $errors) {
        Write-Host "  [FAIL] $err" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
}
