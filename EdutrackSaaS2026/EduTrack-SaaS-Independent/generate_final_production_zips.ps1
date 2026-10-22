$ErrorActionPreference = "Stop"

$rootDir = "C:\EduTrackSaaS 2027\EdutrackSaaS2026\EduTrack-SaaS-Independent"
$frontendDir = Join-Path $rootDir "frontend"
$backendDir = Join-Path $rootDir "backend"

$feZip = Join-Path $rootDir "CS-EduTrack-Frontend-Production.zip"
$beZip = Join-Path $rootDir "CS-EduTrack-Backend-Production.zip"

$feShaFile = Join-Path $rootDir "CS-EduTrack-Frontend-Production.sha256"
$beShaFile = Join-Path $rootDir "CS-EduTrack-Backend-Production.sha256"

$stagingRoot = Join-Path $rootDir (".prod_staging_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$feStaging = Join-Path $stagingRoot "frontend"
$beStaging = Join-Path $stagingRoot "backend"

New-Item -ItemType Directory -Force -Path $feStaging | Out-Null
New-Item -ItemType Directory -Force -Path $beStaging | Out-Null

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
        Copy-Item -Path $src -Destination (Join-Path $feStaging $f) -Force
    }
}

Copy-Item -Path (Join-Path $frontendDir "public") -Destination (Join-Path $feStaging "public") -Recurse -Force
Copy-Item -Path (Join-Path $frontendDir "src") -Destination (Join-Path $feStaging "src") -Recurse -Force

$feNextStaging = Join-Path $feStaging ".next"
New-Item -ItemType Directory -Force -Path $feNextStaging | Out-Null
Get-ChildItem -Path (Join-Path $frontendDir ".next") | Where-Object { $_.Name -ne "cache" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $feNextStaging $_.Name) -Recurse -Force
}
# Strictly remove any stray .env files copied into .next by Next.js tracing
Get-ChildItem -Path $feNextStaging -Recurse -Filter ".env*" -File | Remove-Item -Force

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
        Copy-Item -Path $src -Destination (Join-Path $beStaging $f) -Force
    }
}

$bePrismaStaging = Join-Path $beStaging "prisma"
New-Item -ItemType Directory -Force -Path $bePrismaStaging | Out-Null
Get-ChildItem -Path (Join-Path $backendDir "prisma") | Where-Object { $_.Name -ne "migrations_old" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $bePrismaStaging $_.Name) -Recurse -Force
}

Copy-Item -Path (Join-Path $backendDir "src") -Destination $beStaging -Recurse -Force
Copy-Item -Path (Join-Path $backendDir "dist") -Destination $beStaging -Recurse -Force

if (Test-Path (Join-Path $backendDir "api")) {
    Copy-Item -Path (Join-Path $backendDir "api") -Destination $beStaging -Recurse -Force
}

Write-Host "3. Creating ZIP Archives in staging..."
Add-Type -AssemblyName System.IO.Compression.FileSystem

$feZipStaged = Join-Path $stagingRoot "frontend_pkg.zip"
$beZipStaged = Join-Path $stagingRoot "backend_pkg.zip"

[System.IO.Compression.ZipFile]::CreateFromDirectory($feStaging, $feZipStaged)
[System.IO.Compression.ZipFile]::CreateFromDirectory($beStaging, $beZipStaged)

Move-Item -Path $feZipStaged -Destination $feZip -Force
Move-Item -Path $beZipStaged -Destination $beZip -Force

Remove-Item -Path $stagingRoot -Recurse -Force

Write-Host "4. Calculating Checksums..."
$feHash = (Get-FileHash -Path $feZip -Algorithm SHA256).Hash.ToLower()
$beHash = (Get-FileHash -Path $beZip -Algorithm SHA256).Hash.ToLower()

Set-Content -Path $feShaFile -Value "$feHash  CS-EduTrack-Frontend-Production.zip"
Set-Content -Path $beShaFile -Value "$beHash  CS-EduTrack-Backend-Production.zip"

$feLen = (Get-Item $feZip).Length
$beLen = (Get-Item $beZip).Length

$feMB = [math]::Round($feLen / 1MB, 2)
$beMB = [math]::Round($beLen / 1MB, 2)

Write-Host ""
Write-Host "======================================================="
Write-Host "=== CS EDUTRACK PRODUCTION PACKAGING SUCCESSFUL ==="
Write-Host "======================================================="
Write-Host "Frontend ZIP: $feZip"
Write-Host "Frontend Size: $feLen bytes ($feMB MB)"
Write-Host "Frontend SHA256: $feHash"
Write-Host "-------------------------------------------------------"
Write-Host "Backend ZIP:  $beZip"
Write-Host "Backend Size:  $beLen bytes ($beMB MB)"
Write-Host "Backend SHA256:  $beHash"
Write-Host "======================================================="
