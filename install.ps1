$ErrorActionPreference = "Stop"

$REPO = "GhanshyamSharma122/codecli"
$BRANCH = "main"
$APP = "codecli"

$INSTALL_DIR = "$env:USERPROFILE\.$APP"

Write-Host "Installing $APP..."

if (!(Get-Command node -ErrorAction SilentlyContinue)) {

    Write-Error "NodeJS not installed https://nodejs.org"
    exit 1
}

if (!(Get-Command npm -ErrorAction SilentlyContinue)) {

    Write-Error "npm not found"
    exit 1
}

New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

$ZIP = "$INSTALL_DIR\repo.zip"

Write-Host "Downloading..."

Invoke-WebRequest `
"https://github.com/$REPO/archive/refs/heads/$BRANCH.zip" `
-OutFile $ZIP


Write-Host "Extracting..."

Expand-Archive $ZIP -DestinationPath $INSTALL_DIR -Force


$FOLDER = Get-ChildItem $INSTALL_DIR |
Where-Object { $_.PSIsContainer } |
Select-Object -First 1


Set-Location $FOLDER.FullName

Write-Host "Installing npm package globally..."

npm install -g .


Write-Host ""
Write-Host "SUCCESS!"
Write-Host "Run: codecli"