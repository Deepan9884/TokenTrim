# TokenTrim - PDF.js Setup Script
# This script downloads and sets up PDF.js automatically

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TokenTrim - PDF.js Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if lib folder exists
if (-not (Test-Path "lib")) {
    Write-Host "Creating lib folder..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "lib" | Out-Null
}

# Check if PDF.js already exists
if ((Test-Path "lib/pdf.js") -and (Test-Path "lib/pdf.worker.js")) {
    Write-Host "PDF.js files already exist!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Found:" -ForegroundColor Green
    Write-Host "  - lib/pdf.js" -ForegroundColor Green
    Write-Host "  - lib/pdf.worker.js" -ForegroundColor Green
    Write-Host ""
    $response = Read-Host "Do you want to re-download? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host ""
        Write-Host "Skipping download. Setup complete!" -ForegroundColor Green
        exit 0
    }
}

Write-Host "Fetching latest PDF.js release..." -ForegroundColor Yellow

try {
    # Get latest release info from GitHub API
    $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/mozilla/pdf.js/releases"
    
    # Find latest legacy dist
    $legacyRelease = $null
    foreach ($release in $releases) {
        $legacyAsset = $release.assets | Where-Object { $_.name -like "*legacy-dist.zip" }
        if ($legacyAsset) {
            $legacyRelease = $release
            $downloadAsset = $legacyAsset
            break
        }
    }
    
    if (-not $legacyRelease) {
        throw "Could not find legacy dist release"
    }
    
    $version = $legacyRelease.tag_name
    $downloadUrl = $downloadAsset.browser_download_url
    $zipFile = "pdfjs-legacy.zip"
    
    Write-Host "Found version: $version" -ForegroundColor Green
    Write-Host "Downloading from: $downloadUrl" -ForegroundColor Yellow
    Write-Host ""
    
    # Download the zip file
    Write-Host "Downloading PDF.js..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile -UseBasicParsing
    
    Write-Host "Download complete!" -ForegroundColor Green
    Write-Host ""
    
    # Extract the zip file
    Write-Host "Extracting files..." -ForegroundColor Yellow
    $tempDir = "pdfjs-temp"
    Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
    
    # Copy required files
    Write-Host "Copying required files..." -ForegroundColor Yellow
    
    # Find and copy pdf.js
    $pdfJs = Get-ChildItem -Path $tempDir -Filter "pdf.js" -Recurse | Select-Object -First 1
    if ($pdfJs) {
        Copy-Item -Path $pdfJs.FullName -Destination "lib/pdf.js" -Force
        Write-Host "  ✓ Copied pdf.js" -ForegroundColor Green
    } else {
        throw "Could not find pdf.js in extracted files"
    }
    
    # Find and copy pdf.worker.js
    $pdfWorker = Get-ChildItem -Path $tempDir -Filter "pdf.worker.js" -Recurse | Select-Object -First 1
    if ($pdfWorker) {
        Copy-Item -Path $pdfWorker.FullName -Destination "lib/pdf.worker.js" -Force
        Write-Host "  ✓ Copied pdf.worker.js" -ForegroundColor Green
    } else {
        throw "Could not find pdf.worker.js in extracted files"
    }
    
    # Cleanup
    Write-Host ""
    Write-Host "Cleaning up..." -ForegroundColor Yellow
    Remove-Item -Path $zipFile -Force
    Remove-Item -Path $tempDir -Recurse -Force
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Setup Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "PDF.js version $version installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files installed:" -ForegroundColor Cyan
    Write-Host "  - lib/pdf.js" -ForegroundColor White
    Write-Host "  - lib/pdf.worker.js" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Generate icons: Open tools/generate-production-icons.html" -ForegroundColor White
    Write-Host "  2. Build package: Run .\build.ps1" -ForegroundColor White
    Write-Host "  3. Test locally: Load extension in chrome://extensions/" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Error Occurred" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Failed to download PDF.js automatically." -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download manually:" -ForegroundColor Yellow
    Write-Host "  1. Visit: https://github.com/mozilla/pdf.js/releases" -ForegroundColor White
    Write-Host "  2. Download: pdfjs-X.X.X-legacy-dist.zip" -ForegroundColor White
    Write-Host "  3. Extract pdf.js → lib/pdf.js" -ForegroundColor White
    Write-Host "  4. Extract pdf.worker.js → lib/pdf.worker.js" -ForegroundColor White
    Write-Host ""
    exit 1
}
