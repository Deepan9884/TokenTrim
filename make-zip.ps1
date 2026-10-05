Write-Host "Building TokenTrim extension bundle..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

Write-Host "Packaging TokenTrim extension with standards-compliant forward slashes..." -ForegroundColor Cyan
node tools/package-zip.js



