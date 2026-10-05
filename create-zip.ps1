Write-Host "Creating TokenTrim Extension ZIP (standards-compliant)..." -ForegroundColor Cyan

# 1. Ensure dist/ is built with bundled scripts
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

# 2. Package into standards-compliant ZIP with forward-slash paths
node tools/package-zip.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Packaging failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SUCCESS! Created: TokenTrim-Extension.zip and TokenTrim-1.2.0.zip" -ForegroundColor Green
Write-Host ""
Write-Host "To install in Brave / Chrome:" -ForegroundColor Yellow
Write-Host "Option A (Direct Unpacked):" -ForegroundColor White
Write-Host "  1. Open chrome://extensions/ or brave://extensions/" -ForegroundColor White
Write-Host "  2. Enable Developer mode (top-right toggle)" -ForegroundColor White
Write-Host "  3. Click 'Load unpacked' and select the 'dist' folder directly" -ForegroundColor White
Write-Host ""
Write-Host "Option B (From ZIP):" -ForegroundColor White
Write-Host "  1. Extract TokenTrim-1.2.0.zip or TokenTrim-Extension.zip" -ForegroundColor White
Write-Host "  2. Open chrome://extensions/ or brave://extensions/" -ForegroundColor White
Write-Host "  3. Click 'Load unpacked' and select the extracted folder" -ForegroundColor White
