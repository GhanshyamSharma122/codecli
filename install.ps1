$ErrorActionPreference = "Stop"

# CONFIG
$REPO = "GhanshyamSharma122/codecli"
$BRANCH = "main"
$APP_NAME = "codecli"

$INSTALL_DIR = "$env:USERPROFILE\.$APP_NAME"

Write-Host ""
Write-Host "Installing $APP_NAME globally..."
Write-Host ""

# Detect OS
if ($env:OS -ne "Windows_NT") {

    Write-Error "Windows only installer. Use .sh for Linux/Mac"
    exit 1
}

# Check NodeJS
if (!(Get-Command node -ErrorAction SilentlyContinue)) {

    Write-Error "NodeJS not installed: https://nodejs.org"
    exit 1
}

# Check npm
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {

    Write-Error "npm not found"
    exit 1
}

# Create install directory
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

$ZIP = "$INSTALL_DIR\repo.zip"

# Download repo zip
Write-Host "Downloading repo..."

Invoke-WebRequest `
"https://github.com/$REPO/archive/refs/heads/$BRANCH.zip" `
-OutFile $ZIP


Write-Host "Extracting..."

Expand-Archive $ZIP -DestinationPath $INSTALL_DIR -Force


# Find extracted folder
$FOLDER = Get-ChildItem $INSTALL_DIR |
Where-Object {
    $_.PSIsContainer -and $_.Name -like "*$BRANCH"
} |
Select-Object -First 1


if (!$FOLDER) {

    Write-Error "Extraction failed"
    exit 1
}

Set-Location $FOLDER.FullName


Write-Host ""
Write-Host "Running npm install -g ."
Write-Host ""

npm install -g .


Write-Host ""
Write-Host "SUCCESS!"
Write-Host ""
Write-Host "Now run:"
Write-Host ""
Write-Host "codecli"
Write-Host ""