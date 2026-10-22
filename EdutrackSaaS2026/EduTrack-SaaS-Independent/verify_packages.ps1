$ErrorActionPreference = "Stop"

$rootDir = "C:\EduTrackSaaS 2027\EdutrackSaaS2026\EduTrack-SaaS-Independent"
$frontendZip = Join-Path $rootDir "CS-EduTrack-Frontend-Production.zip"
$backendZip = Join-Path $rootDir "CS-EduTrack-Backend-Production.zip"

$tempDir = Join-Path $rootDir (".verify_extract_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$feExtract = Join-Path $tempDir "frontend"
$beExtract = Join-Path $tempDir "backend"

New-Item -ItemType Directory -Force -Path $feExtract | Out-Null
New-Item -ItemType Directory -Force -Path $beExtract | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem

Write-Host "======================================================="
Write-Host "=== PRODUCTION ZIP VERIFICATION SUITE ==="
Write-Host "======================================================="

Write-Host "1. Extracting Frontend ZIP ($frontendZip)..."
$tempFeZip = Join-Path $tempDir "temp_frontend.zip"
$tempBeZip = Join-Path $tempDir "temp_backend.zip"
Copy-Item $frontendZip $tempFeZip -Force
Copy-Item $backendZip $tempBeZip -Force

[System.IO.Compression.ZipFile]::ExtractToDirectory($tempFeZip, $feExtract)
Write-Host "   -> Frontend ZIP extracted successfully."

Write-Host "`n2. Extracting Backend ZIP ($backendZip)..."
[System.IO.Compression.ZipFile]::ExtractToDirectory($tempBeZip, $beExtract)
Write-Host "   -> Backend ZIP extracted successfully."

Write-Host "`n3. Checking Required Frontend Files & Assets..."
$reqFe = @(
    "package.json",
    "next.config.mjs",
    "server.js",
    "public\cs-edutrack-logo.jpg",
    "public\favicon.ico",
    "public\favicon-16x16.png",
    "public\favicon-32x32.png",
    "public\icon-192.png",
    "public\icon-512.png",
    "public\apple-touch-icon.png",
    "public\site.webmanifest",
    ".next\server",
    ".next\static",
    ".next\routes-manifest.json",
    ".next\app-build-manifest.json",
    "src\app\layout.tsx",
    "src\app\dashboard\teachers\attendance\page.tsx",
    "src\app\dashboard\teachers\attendance\qr\page.tsx",
    "src\app\teacher-attendance\page.tsx"
)

$fePass = $true
foreach ($f in $reqFe) {
    $p = Join-Path $feExtract $f
    $exists = Test-Path $p
    if ($exists) {
        Write-Host "   [PASS] $f" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] $f" -ForegroundColor Red
        $fePass = $false
    }
}

Write-Host "`n4. Checking Required Backend Files & Runtime Assets..."
$reqBe = @(
    "package.json",
    "tsconfig.json",
    "nest-cli.json",
    ".env.example",
    "dist\main.js",
    "dist\app.module.js",
    "dist\teacher-attendance",
    "dist\teachers",
    "dist\students",
    "dist\auth",
    "dist\billing",
    "dist\attendance",
    "prisma\schema.prisma",
    "src\main.ts"
)

$bePass = $true
foreach ($f in $reqBe) {
    $p = Join-Path $beExtract $f
    $exists = Test-Path $p
    if ($exists) {
        Write-Host "   [PASS] $f" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] $f" -ForegroundColor Red
        $bePass = $false
    }
}

Write-Host "`n5. Scanning For Forbidden Files & Secrets..."
$forbiddenFiles = @(
    ".env",
    ".env.local",
    ".env.production",
    ".env.vercel.pulled",
    "firebase-service-account.json",
    "service-account.json",
    "id_rsa",
    "private_key.pem"
)
$foundViolations = @()

Get-ChildItem -Path $tempDir -Recurse -File | ForEach-Object {
    if ($forbiddenFiles -contains $_.Name) {
        $foundViolations += "Forbidden file found: $($_.FullName)"
    }
}

if ($foundViolations.Count -eq 0) {
    Write-Host "   [PASS] 0 secret/forbidden files found across all packages." -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Violations found: $($foundViolations -join ', ')" -ForegroundColor Red
}

Write-Host "`n6. Verifying Favicon & Layout Metadata Reference in Frontend..."
$layoutContent = Get-Content (Join-Path $feExtract "src\app\layout.tsx") -Raw
$hasFavicon = $layoutContent -match "favicon\.ico" -and $layoutContent -match "favicon-16x16\.png" -and $layoutContent -match "favicon-32x32\.png" -and $layoutContent -match "site\.webmanifest"
if ($hasFavicon) {
    Write-Host "   [PASS] layout.tsx contains complete metadata and favicon icon mappings." -ForegroundColor Green
} else {
    Write-Host "   [FAIL] layout.tsx is missing favicon configuration." -ForegroundColor Red
}

Write-Host "`n7. Verifying Teacher Attendance Routes..."
$hasTeacherAttQr = Test-Path (Join-Path $feExtract "src\app\dashboard\teachers\attendance\qr\page.tsx")
$hasTeacherAttManual = Test-Path (Join-Path $feExtract "src\app\dashboard\teachers\attendance\page.tsx")
$hasTeacherAttPortal = Test-Path (Join-Path $feExtract "src\app\teacher-attendance\page.tsx")
if ($hasTeacherAttQr -and $hasTeacherAttManual -and $hasTeacherAttPortal) {
    Write-Host "   [PASS] Teacher Attendance (Manual, QR Management, Teacher Self-Portal) routes verified in frontend." -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Teacher Attendance files missing." -ForegroundColor Red
}

# Clean temp directory
Remove-Item -Path $tempDir -Recurse -Force

# Metrics
$feLen = (Get-Item $frontendZip).Length
$beLen = (Get-Item $backendZip).Length
$feHash = (Get-FileHash -Path $frontendZip -Algorithm SHA256).Hash.ToLower()
$beHash = (Get-FileHash -Path $backendZip -Algorithm SHA256).Hash.ToLower()

$feMB = [math]::Round($feLen / 1MB, 2)
$beMB = [math]::Round($beLen / 1MB, 2)

Write-Host "`n======================================================="
Write-Host "FINAL PRODUCTION PACKAGING REPORT"
Write-Host "======================================================="
Write-Host "Frontend ZIP:    $frontendZip"
Write-Host "Frontend Size:   $feMB MB ($feLen bytes)"
Write-Host "Frontend SHA256: $feHash"
Write-Host "Frontend Status: $(if ($fePass -and $hasFavicon -and $hasTeacherAttQr) { 'VERIFIED & READY (100% PASS)' } else { 'FAILED' })"
Write-Host "-------------------------------------------------------"
Write-Host "Backend ZIP:     $backendZip"
Write-Host "Backend Size:    $beMB MB ($beLen bytes)"
Write-Host "Backend SHA256:  $beHash"
Write-Host "Backend Status:  $(if ($bePass) { 'VERIFIED & READY (100% PASS)' } else { 'FAILED' })"
Write-Host "======================================================="
