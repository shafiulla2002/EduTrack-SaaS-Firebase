# Production Packaging Script for CS EduTrack
$ErrorActionPreference = "Stop"

$rootDir = "C:\EduTrackSaaS 2027\EdutrackSaaS2026\EduTrack-SaaS-Independent"
$frontendSrc = Join-Path $rootDir "frontend"
$backendSrc = Join-Path $rootDir "backend"

$stagingDir = Join-Path $rootDir (".staging_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$frontendStaging = Join-Path $stagingDir "frontend"
$backendStaging = Join-Path $stagingDir "backend"

$frontendZip = Join-Path $rootDir "CS-EduTrack-Frontend-Production.zip"
$backendZip = Join-Path $rootDir "CS-EduTrack-Backend-Production.zip"

$frontendShaFile = Join-Path $rootDir "CS-EduTrack-Frontend-Production.sha256"
$backendShaFile = Join-Path $rootDir "CS-EduTrack-Backend-Production.sha256"

Write-Host "=== CREATING CS EDUTRACK PRODUCTION PACKAGES ==="

# Clean any existing zips
if (Test-Path $frontendZip) { Remove-Item -Force $frontendZip }
if (Test-Path $backendZip) { Remove-Item -Force $backendZip }

# 1. Create Staging Directories
New-Item -ItemType Directory -Force -Path $frontendStaging | Out-Null
New-Item -ItemType Directory -Force -Path $backendStaging | Out-Null

# 2. Copy Frontend Files
Write-Host "1. Staging Frontend Files..."
$frontendFiles = @(
    "package.json",
    "package-lock.json",
    "next.config.mjs",
    "server.js",
    "tsconfig.json",
    "tailwind.config.ts",
    "postcss.config.js",
    "next-env.d.ts",
    ".env.example"
)

foreach ($file in $frontendFiles) {
    $src = Join-Path $frontendSrc $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $frontendStaging $file) -Force
    }
}

# Copy Frontend Public Directory
Copy-Item -Path (Join-Path $frontendSrc "public") -Destination (Join-Path $frontendStaging "public") -Recurse -Force
Write-Host "   + Copied public/"

# Copy Frontend Src Directory
Copy-Item -Path (Join-Path $frontendSrc "src") -Destination (Join-Path $frontendStaging "src") -Recurse -Force
Write-Host "   + Copied src/"

# Copy Frontend .next Directory (Excluding cache)
$feNextSrc = Join-Path $frontendSrc ".next"
$feNextDest = Join-Path $frontendStaging ".next"
New-Item -ItemType Directory -Force -Path $feNextDest | Out-Null

Get-ChildItem -Path $feNextSrc | Where-Object { $_.Name -ne "cache" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $feNextDest $_.Name) -Recurse -Force
}
Write-Host "   + Copied .next/ (excluding cache)"

# 3. Copy Backend Files
Write-Host "2. Staging Backend Files..."
$backendFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "nest-cli.json",
    ".env.example",
    "fly.toml"
)

foreach ($file in $backendFiles) {
    $src = Join-Path $backendSrc $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $backendStaging $file) -Force
    }
}

# Copy Backend Prisma Directory (Excluding migrations_old)
$bePrismaSrc = Join-Path $backendSrc "prisma"
$bePrismaDest = Join-Path $backendStaging "prisma"
New-Item -ItemType Directory -Force -Path $bePrismaDest | Out-Null

Get-ChildItem -Path $bePrismaSrc | Where-Object { $_.Name -ne "migrations_old" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $bePrismaDest $_.Name) -Recurse -Force
}
Write-Host "   + Copied prisma/"

# Copy Backend Src Directory
Copy-Item -Path (Join-Path $backendSrc "src") -Destination (Join-Path $backendStaging "src") -Recurse -Force
Write-Host "   + Copied src/"

# Copy Backend Dist Directory
Copy-Item -Path (Join-Path $backendSrc "dist") -Destination (Join-Path $backendStaging "dist") -Recurse -Force
Write-Host "   + Copied dist/"

# Copy Backend API Directory if exists
$beApiSrc = Join-Path $backendSrc "api"
if (Test-Path $beApiSrc) {
    Copy-Item -Path $beApiSrc -Destination (Join-Path $backendStaging "api") -Recurse -Force
    Write-Host "   + Copied api/"
}

# 4. Create ZIP Archives using .NET ZipFile
Write-Host "3. Compressing Archives..."
Add-Type -AssemblyName System.IO.Compression.FileSystem

Write-Host "   Compressing CS-EduTrack-Frontend-Production.zip..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($frontendStaging, $frontendZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Write-Host "   Compressing CS-EduTrack-Backend-Production.zip..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($backendStaging, $backendZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

# 5. Clean Staging Directory
Remove-Item -Path $stagingDir -Recurse -Force

# 6. Generate SHA256 Checksums
Write-Host "4. Calculating SHA256 Checksums..."
$feHash = (Get-FileHash -Path $frontendZip -Algorithm SHA256).Hash.ToLower()
$beHash = (Get-FileHash -Path $backendZip -Algorithm SHA256).Hash.ToLower()

Set-Content -Path $frontendShaFile -Value "$feHash  CS-EduTrack-Frontend-Production.zip"
Set-Content -Path $backendShaFile -Value "$beHash  CS-EduTrack-Backend-Production.zip"

$feSize = (Get-Item $frontendZip).Length
$beSize = (Get-Item $backendZip).Length

Write-Host "`n=== PACKAGING COMPLETED SUCCESSFULLY ==="
Write-Host "Frontend ZIP: $frontendZip ($([math]::Round($feSize / 1MB, 2)) MB, $feSize bytes)"
Write-Host "Frontend SHA256: $feHash"
Write-Host "Backend ZIP:  $backendZip ($([math]::Round($beSize / 1MB, 2)) MB, $beSize bytes)"
Write-Host "Backend SHA256:  $beHash"
