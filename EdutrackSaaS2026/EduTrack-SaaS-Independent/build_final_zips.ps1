# Final Production Packaging for CS EduTrack Frontend and Backend
$ErrorActionPreference = "Stop"

$rootDir = "C:\EduTrackSaaS 2027\EdutrackSaaS2026\EduTrack-SaaS-Independent"
$frontendDir = Join-Path $rootDir "frontend"
$backendDir = Join-Path $rootDir "backend"

$stagingRoot = Join-Path $rootDir ".staging_prod_final"
if (Test-Path $stagingRoot) {
    Remove-Item -Path $stagingRoot -Recurse -Force
}

$frontendStaging = Join-Path $stagingRoot "frontend"
$backendStaging = Join-Path $stagingRoot "backend"

New-Item -ItemType Directory -Force -Path $frontendStaging | Out-Null
New-Item -ItemType Directory -Force -Path $backendStaging | Out-Null

Write-Host "1. Staging Frontend..."
$feFiles = @(
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

foreach ($f in $feFiles) {
    $src = Join-Path $frontendDir $f
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $frontendStaging $f) -Force
    }
}

Copy-Item -Path (Join-Path $frontendDir "public") -Destination (Join-Path $frontendStaging "public") -Recurse -Force
Copy-Item -Path (Join-Path $frontendDir "src") -Destination (Join-Path $frontendStaging "src") -Recurse -Force

$feNextStaging = Join-Path $frontendStaging ".next"
New-Item -ItemType Directory -Force -Path $feNextStaging | Out-Null
Get-ChildItem -Path (Join-Path $frontendDir ".next") | Where-Object { $_.Name -ne "cache" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $feNextStaging $_.Name) -Recurse -Force
}

Write-Host "2. Staging Backend..."
$beFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "nest-cli.json",
    ".env.example",
    "fly.toml"
)

foreach ($f in $beFiles) {
    $src = Join-Path $backendDir $f
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $backendStaging $f) -Force
    }
}

$bePrismaStaging = Join-Path $backendStaging "prisma"
New-Item -ItemType Directory -Force -Path $bePrismaStaging | Out-Null
Get-ChildItem -Path (Join-Path $backendDir "prisma") | Where-Object { $_.Name -ne "migrations_old" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $bePrismaStaging $_.Name) -Recurse -Force
}

Copy-Item -Path (Join-Path $backendDir "src") -Destination (Join-Path $backendStaging "src") -Recurse -Force
Copy-Item -Path (Join-Path $backendDir "dist") -Destination (Join-Path $backendStaging "dist") -Recurse -Force

if (Test-Path (Join-Path $backendDir "api")) {
    Copy-Item -Path (Join-Path $backendDir "api") -Destination (Join-Path $backendStaging "api") -Recurse -Force
}

Write-Host "3. Creating ZIP files..."
Add-Type -AssemblyName System.IO.Compression.FileSystem

$feZip = Join-Path $rootDir "CS-EduTrack-Frontend-Production.zip"
$beZip = Join-Path $rootDir "CS-EduTrack-Backend-Production.zip"

if (Test-Path $feZip) { Remove-Item -Force $feZip }
if (Test-Path $beZip) { Remove-Item -Force $beZip }

[System.IO.Compression.ZipFile]::CreateFromDirectory($frontendStaging, $feZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
[System.IO.Compression.ZipFile]::CreateFromDirectory($backendStaging, $beZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Remove-Item -Path $stagingRoot -Recurse -Force

Write-Host "4. Calculating Checksums..."
$feHash = (Get-FileHash -Path $feZip -Algorithm SHA256).Hash.ToLower()
$beHash = (Get-FileHash -Path $beZip -Algorithm SHA256).Hash.ToLower()

$feShaFile = Join-Path $rootDir "CS-EduTrack-Frontend-Production.sha256"
$beShaFile = Join-Path $rootDir "CS-EduTrack-Backend-Production.sha256"

Set-Content -Path $feShaFile -Value "$feHash  CS-EduTrack-Frontend-Production.zip"
Set-Content -Path $beShaFile -Value "$beHash  CS-EduTrack-Backend-Production.zip"

$feLen = (Get-Item $feZip).Length
$beLen = (Get-Item $beZip).Length
$feMB = [math]::Round($feLen / 1MB, 2)
$beMB = [math]::Round($beLen / 1MB, 2)

Write-Host "`n=== PRODUCTION PACKAGING COMPLETE ==="
Write-Host "Frontend ZIP: $feZip"
Write-Host "Frontend Size: $feLen bytes ($feMB MB)"
Write-Host "Frontend SHA256: $feHash"
Write-Host "Backend ZIP: $beZip"
Write-Host "Backend Size: $beLen bytes ($beMB MB)"
Write-Host "Backend SHA256: $beHash"
