# TokenTrim - Create Extension ZIP for Developer Mode
# This creates a clean package with only necessary files

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Creating TokenTrim Extension ZIP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "TokenTrim-Extension-$timestamp.zip"
$tempDir = "TokenTrim-Package"

# Remove temp directory if exists
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

# Create temp directory
New-Item -ItemType Directory -Path $tempDir | Out-Null
Write-Host "Creating package directory..." -ForegroundColor Yellow

# Files to include
$filesToCopy = @(
    "manifest.json",
    "popup.html",
    "popup.css",
    "popup.js",
    "background.js",
    "content.js",
    "LICENSE"
)

# Copy files
Write-Host "Copying core files..." -ForegroundColor Yellow
foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $tempDir -Force
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file not found" -ForegroundColor Red
    }
}

# Copy directories
Write-Host "Copying directories..." -ForegroundColor Yellow

# Copy lib folder
if (Test-Path "lib") {
    Copy-Item -Path "lib" -Destination $tempDir -Recurse -Force
    Write-Host "  ✓ lib/" -ForegroundColor Green
} else {
    Write-Host "  ⚠ lib/ not found - PDF.js may be missing" -ForegroundColor Yellow
}

# Copy icons folder
if (Test-Path "icons") {
    Copy-Item -Path "icons" -Destination $tempDir -Recurse -Force
    Write-Host "  ✓ icons/" -ForegroundColor Green
} else {
    Write-Host "  ⚠ icons/ not found - extension will use default icons" -ForegroundColor Yellow
}

Write-Host ""

# Create ZIP
Write-Host "Creating ZIP file..." -ForegroundColor Yellow
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -CompressionLevel Optimal

# Cleanup
Remove-Item -Path $tempDir -Recurse -Force

$zipSize = [math]::Round((Get-Item $zipName).Length / 1KB, 2)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ZIP Created Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "File: $zipName" -ForegroundColor White
Write-Host "Size: $zipSize KB" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Open Chrome: chrome://extensions/" -ForegroundColor White
Write-Host "  2. Enable 'Developer mode' (top-right toggle)" -ForegroundColor White
Write-Host "  3. Click 'Load unpacked'" -ForegroundColor White
Write-Host "  4. Extract $zipName and select the folder" -ForegroundColor White
Write-Host ""
Write-Host "Note: You need to EXTRACT the ZIP first, then load the folder!" -ForegroundColor Yellow
Write-Host ""
