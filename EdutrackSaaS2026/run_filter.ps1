# EduTrack Managed Package Scrubbing Protocol (Ancestry-Aligned)
# This script prepares the build-clean directory by being restrictive but strictly
# preserving the 10 UtilityBar flexipages required by ancestry as per the last build failure.

$TargetDir = "build-clean"

# 1. Clean and Setup
if (Test-Path $TargetDir) {
    Remove-Item -Path $TargetDir -Recurse -Force
}
New-Item -ItemType Directory -Path $TargetDir

# Copy standard source
xcopy /E /I /Y force-app\main\default $TargetDir\main\default

# 2. Application Purge (Restrictive)
$allowedApps = @("Edu_Track.app-meta.xml", "VIKAS_SCHOOL.app-meta.xml")
$appPath = "$TargetDir/main/default/applications"
if (Test-Path $appPath) {
    Get-ChildItem -Path $appPath -Filter "*.xml" | ForEach-Object {
        if ($allowedApps -notcontains $_.Name) {
            Remove-Item -Path $_.FullName -Force
        }
    }
}

# 3. Flexipage Purge (Ancestry-Specific)
# Salesforce demanded adding these 10 back.
$mandatoryFlexipages = @(
    "FlowsApp_UtilityBar.flexipage-meta.xml",
    "AcademicOperations_UtilityBar.flexipage-meta.xml",
    "ExpressionSetConsole_UtilityBar.flexipage-meta.xml",
    "DataGovernanceConsole_UtilityBar.flexipage-meta.xml",
    "VIKAS_SCHOOL_UtilityBar.flexipage-meta.xml",
    "Integration_UtilityBar.flexipage-meta.xml",
    "LightningSalesConsole_UtilityBar.flexipage-meta.xml",
    "LightningService_UtilityBar.flexipage-meta.xml",
    "SalesCloudMobile_UtilityBar.flexipage-meta.xml",
    "LightningSales_UtilityBar.flexipage-meta.xml"
)

$flexPath = "$TargetDir/main/default/flexipages"
if (Test-Path $flexPath) {
    Get-ChildItem -Path $flexPath -Filter "*.xml" | ForEach-Object {
        $name = $_.Name
        # If it's mandatory, keep it. If it contains other system keywords, delete it.
        if ($mandatoryFlexipages -contains $name) {
            Write-Host "Keeping mandatory ancestry flexipage: $name" -ForegroundColor Green
        } elseif ($name -match "(UtilityBar|standard__|ExpressionSet|ActionPlan|Budget|FlowsApp|SalesCloudMobile)") {
            Write-Host "Purging non-ancestry system flexipage: $name" -ForegroundColor Yellow
            Remove-Item -Path $_.FullName -Force
        }
    }
}

# 4. Layout Purge (Custom objects only)
$layoutPath = "$TargetDir/main/default/layouts"
if (Test-Path $layoutPath) {
    Get-ChildItem -Path $layoutPath -Filter "*.xml" | ForEach-Object {
        $name = $_.Name
        if ($name -match "^[a-zA-Z0-9_]+__c-") {
            # Keep
        } else {
            Remove-Item -Path $_.FullName -Force
        }
    }
}

# 5. Field Purge (Standard Objects only)
$objectsPath = "$TargetDir/main/default/objects"
if (Test-Path $objectsPath) {
    Get-ChildItem -Path $objectsPath -Filter "*.field-meta.xml" -Recurse | ForEach-Object {
        $fieldName = $_.Name
        if ($fieldName -notmatch "(__c|__pc|__r|__mdt|__x|__e|__b|__as|__kav|__pr)\.field-meta\.xml$" -and $fieldName -ne "Type.field-meta.xml") {
            Remove-Item -Path $_.FullName -Force
        }
    }
}

Write-Host "--- Build directory READY (build-clean) ---" -ForegroundColor Cyan
