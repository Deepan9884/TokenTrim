# TokenTrim - Tesseract.js (local OCR) Setup Script
# Vendors fully-offline OCR assets into lib/ (no CDN at runtime):
#   lib/tesseract.min.js, lib/tesseract-worker.min.js,
#   lib/tesseract-core/ (WASM), lib/tessdata/eng.traineddata.gz
# Pinned to tesseract.js v5.1.1 (local-path API: workerPath/langPath/corePath).

$ErrorActionPreference = 'Stop'
$TessVersion = '5.1.1'
$CoreVersion = '5.1.1'
$TessTgz = "https://registry.npmjs.org/tesseract.js/-/tesseract.js-$TessVersion.tgz"
$CoreTgz = "https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-$CoreVersion.tgz"
$EngData = 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz'

Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  TokenTrim - Tesseract.js Setup (OCR)' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

$ok = (Test-Path 'lib/tesseract.min.js') -and (Test-Path 'lib/tesseract-worker.min.js') `
  -and (Test-Path 'lib/tesseract-core/tesseract-core.wasm.js') `
  -and (Test-Path 'lib/tessdata/eng.traineddata.gz')
if ($ok) {
    Write-Host 'Tesseract.js assets already vendored!' -ForegroundColor Green
    Write-Host '  - lib/tesseract.min.js' -ForegroundColor Green
    Write-Host '  - lib/tesseract-worker.min.js' -ForegroundColor Green
    Write-Host '  - lib/tesseract-core/' -ForegroundColor Green
    Write-Host '  - lib/tessdata/eng.traineddata.gz' -ForegroundColor Green
    Write-Host ''
    $response = Read-Host 'Re-download? (y/N)'
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host 'Skipping download. Setup complete!' -ForegroundColor Green
        exit 0
    }
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('tokentrim-tess-' + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    Write-Host "Downloading tesseract.js $TessVersion..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $TessTgz -OutFile (Join-Path $tmp 'tess.tgz') -UseBasicParsing
    Write-Host "Downloading tesseract.js-core $CoreVersion..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $CoreTgz -OutFile (Join-Path $tmp 'core.tgz') -UseBasicParsing

    Write-Host 'Extracting...' -ForegroundColor Yellow
    New-Item -ItemType Directory -Path (Join-Path $tmp 'tess') | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tmp 'core') | Out-Null
    tar -xzf (Join-Path $tmp 'tess.tgz') -C (Join-Path $tmp 'tess')
    tar -xzf (Join-Path $tmp 'core.tgz') -C (Join-Path $tmp 'core')

    New-Item -ItemType Directory -Path 'lib/tesseract-core' -Force | Out-Null
    New-Item -ItemType Directory -Path 'lib/tessdata' -Force | Out-Null
    Copy-Item (Join-Path $tmp 'tess/package/dist/tesseract.min.js') 'lib/tesseract.min.js' -Force
    Copy-Item (Join-Path $tmp 'tess/package/dist/worker.min.js') 'lib/tesseract-worker.min.js' -Force
    Copy-Item (Join-Path $tmp 'core/package/tesseract-core*.js') 'lib/tesseract-core/' -Force
    Copy-Item (Join-Path $tmp 'core/package/tesseract-core*.wasm') 'lib/tesseract-core/' -Force
    Write-Host '  ✓ tesseract.min.js + worker + core' -ForegroundColor Green

    if (-not (Test-Path 'lib/tessdata/eng.traineddata.gz')) {
        Write-Host 'Downloading English language data (~11 MB)...' -ForegroundColor Yellow
        Invoke-WebRequest -Uri $EngData -OutFile 'lib/tessdata/eng.traineddata.gz' -UseBasicParsing
    }
    Write-Host '  ✓ eng.traineddata.gz' -ForegroundColor Green

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Green
    Write-Host '  Setup Complete!' -ForegroundColor Green
    Write-Host '========================================' -ForegroundColor Green
    Write-Host 'OCR is now fully local. Rebuild with: npm run build' -ForegroundColor Cyan
} finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
