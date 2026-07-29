$ErrorActionPreference = "Stop"

$workspace = "c:\VikasSchool\EduTrack-SaaS-Independent"
$frontend = "$workspace\frontend"
$deployTemp = "$workspace\.temp\frontend_deploy"

Write-Host "Cleaning previous temp folder..."
if (Test-Path $deployTemp) {
    Remove-Item -Recurse -Force $deployTemp
}

Write-Host "Creating temp directories..."
New-Item -ItemType Directory -Path $deployTemp | Out-Null
New-Item -ItemType Directory -Path "$deployTemp\.next" | Out-Null

Write-Host "Copying standalone build files..."
Copy-Item -Path "$frontend\.next\standalone\*" -Destination $deployTemp -Recurse -Force
Copy-Item -Path "$frontend\.next\standalone\.next\*" -Destination "$deployTemp\.next" -Recurse -Force

Write-Host "Copying public assets..."
if (Test-Path "$frontend\public") {
    Copy-Item -Path "$frontend\public" -Destination $deployTemp -Recurse -Force
}

Write-Host "Copying static assets..."
if (Test-Path "$frontend\.next\static") {
    New-Item -ItemType Directory -Path "$deployTemp\.next\static" | Out-Null
    Copy-Item -Path "$frontend\.next\static\*" -Destination "$deployTemp\.next\static" -Recurse -Force
}

# Create ZIP archive
$zipPath = "$workspace\edutrack-frontend-v2.zip.zip"
Write-Host "Packaging deployment archive into $zipPath..."
if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
}

# Run PowerShell Compress-Archive
Compress-Archive -Path "$deployTemp\*" -DestinationPath $zipPath -Force

Write-Host "🎉 SUCCESS! Created deployment package at $zipPath"
