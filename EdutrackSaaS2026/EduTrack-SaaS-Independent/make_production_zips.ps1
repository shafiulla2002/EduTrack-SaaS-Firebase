$ErrorActionPreference = "Stop"

$rootDir = "C:\EduTrackSaaS 2027\EdutrackSaaS2026\EduTrack-SaaS-Independent"
$feStaging = "$rootDir\.staging_fe"
$beStaging = "$rootDir\.staging_be"

$feZip = "$rootDir\CS-EduTrack-Frontend-Production.zip"
$beZip = "$rootDir\CS-EduTrack-Backend-Production.zip"

Write-Host "1. Cleaning previous staging and output..."
if (Test-Path $feStaging) { Remove-Item -Recurse -Force $feStaging }
if (Test-Path $beStaging) { Remove-Item -Recurse -Force $beStaging }
if (Test-Path $feZip) { Remove-Item -Force $feZip }
if (Test-Path $beZip) { Remove-Item -Force $beZip }

New-Item -ItemType Directory -Force $feStaging | Out-Null
New-Item -ItemType Directory -Force $beStaging | Out-Null

Write-Host "2. Staging Frontend..."
@("package.json", "package-lock.json", "next.config.mjs", "server.js", "tsconfig.json", "tailwind.config.ts", "postcss.config.js", "next-env.d.ts", ".env.example") | ForEach-Object {
    if (Test-Path "$rootDir\frontend\$_") {
        Copy-Item "$rootDir\frontend\$_" "$feStaging\$_" -Force
    }
}
Copy-Item "$rootDir\frontend\public" "$feStaging\public" -Recurse -Force
Copy-Item "$rootDir\frontend\src" "$feStaging\src" -Recurse -Force

New-Item -ItemType Directory -Force "$feStaging\.next" | Out-Null
Get-ChildItem "$rootDir\frontend\.next" | Where-Object { $_.Name -ne "cache" } | ForEach-Object {
    Copy-Item $_.FullName "$feStaging\.next\$($_.Name)" -Recurse -Force
}

Write-Host "3. Staging Backend..."
@("package.json", "package-lock.json", "tsconfig.json", "nest-cli.json", ".env.example", "fly.toml") | ForEach-Object {
    if (Test-Path "$rootDir\backend\$_") {
        Copy-Item "$rootDir\backend\$_" "$beStaging\$_" -Force
    }
}
New-Item -ItemType Directory -Force "$beStaging\prisma" | Out-Null
Get-ChildItem "$rootDir\backend\prisma" | Where-Object { $_.Name -ne "migrations_old" } | ForEach-Object {
    Copy-Item $_.FullName "$beStaging\prisma\$($_.Name)" -Recurse -Force
}
Copy-Item "$rootDir\backend\src" "$beStaging\src" -Recurse -Force
Copy-Item "$rootDir\backend\dist" "$beStaging\dist" -Recurse -Force
if (Test-Path "$rootDir\backend\api") {
    Copy-Item "$rootDir\backend\api" "$beStaging\api" -Recurse -Force
}

Write-Host "4. Compressing Frontend..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($feStaging, $feZip)

Write-Host "5. Compressing Backend..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($beStaging, $beZip)

Write-Host "6. Cleaning staging directories..."
Remove-Item -Recurse -Force $feStaging
Remove-Item -Recurse -Force $beStaging

Write-Host "7. Calculating Checksums..."
$feHash = (Get-FileHash -Path $feZip -Algorithm SHA256).Hash.ToLower()
$beHash = (Get-FileHash -Path $beZip -Algorithm SHA256).Hash.ToLower()

Set-Content -Path "$rootDir\CS-EduTrack-Frontend-Production.sha256" -Value "$feHash  CS-EduTrack-Frontend-Production.zip"
Set-Content -Path "$rootDir\CS-EduTrack-Backend-Production.sha256" -Value "$beHash  CS-EduTrack-Backend-Production.zip"

$feLen = (Get-Item $feZip).Length
$beLen = (Get-Item $beZip).Length

$feMB = [math]::Round($feLen / 1MB, 2)
$beMB = [math]::Round($beLen / 1MB, 2)

Write-Host "`n======================================================="
Write-Host "=== PRODUCTION PACKAGING COMPLETED SUCCESSFULLY ==="
Write-Host "======================================================="
Write-Host "Frontend ZIP: $feZip"
Write-Host "Frontend Size: $feLen bytes ($feMB MB)"
Write-Host "Frontend SHA256: $feHash"
Write-Host "-------------------------------------------------------"
Write-Host "Backend ZIP:  $beZip"
Write-Host "Backend Size:  $beLen bytes ($beMB MB)"
Write-Host "Backend SHA256:  $beHash"
Write-Host "======================================================="
