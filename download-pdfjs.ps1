# Quick PDF.js download script
Write-Host "Downloading PDF.js..." -ForegroundColor Cyan

$url = "https://github.com/mozilla/pdf.js/releases/download/v4.0.379/pdfjs-4.0.379-legacy-dist.zip"
$zipFile = "pdfjs-legacy.zip"

try {
    # Download
    Write-Host "Downloading from GitHub..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing
    
    # Extract
    Write-Host "Extracting files..." -ForegroundColor Yellow
    Expand-Archive -Path $zipFile -DestinationPath "pdfjs-temp" -Force
    
    # Copy required files
    Write-Host "Copying to lib folder..." -ForegroundColor Yellow
    Copy-Item "pdfjs-temp\build\pdf.js" -Destination "lib\pdf.js" -Force
    Copy-Item "pdfjs-temp\build\pdf.worker.js" -Destination "lib\pdf.worker.js" -Force
    
    # Cleanup
    Write-Host "Cleaning up..." -ForegroundColor Yellow
    Remove-Item $zipFile -Force
    Remove-Item "pdfjs-temp" -Recurse -Force
    
    Write-Host ""
    Write-Host "SUCCESS! PDF.js installed" -ForegroundColor Green
    Write-Host "Files installed:" -ForegroundColor Cyan
    Write-Host "  - lib/pdf.js" -ForegroundColor White
    Write-Host "  - lib/pdf.worker.js" -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual download:" -ForegroundColor Yellow
    Write-Host "1. Visit: https://github.com/mozilla/pdf.js/releases" -ForegroundColor White
    Write-Host "2. Download: pdfjs-4.0.379-legacy-dist.zip" -ForegroundColor White
    Write-Host "3. Extract pdf.js and pdf.worker.js to lib/ folder" -ForegroundColor White
}
