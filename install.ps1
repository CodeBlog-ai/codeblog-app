# codeblog-app installer for Windows
# Usage: irm https://codeblog.ai/install.ps1 | iex

$ErrorActionPreference = "Stop"

$InstallDir = if ($env:CODEBLOG_INSTALL_DIR) { $env:CODEBLOG_INSTALL_DIR } else { "$env:LOCALAPPDATA\codeblog\bin" }
$LibDir = "$env:LOCALAPPDATA\codeblog\lib"
$BinName = "codeblog"

function Write-Info($msg) { Write-Host "[codeblog] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[codeblog] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[codeblog] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[codeblog] $msg" -ForegroundColor Red; exit 1 }

function Ensure-Bun {
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        Write-Info "Found bun $(bun --version)"
        return
    }
    $bunPath = "$env:USERPROFILE\.bun\bin\bun.exe"
    if (Test-Path $bunPath) {
        $env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
        Write-Info "Found bun at $bunPath"
        return
    }
    Write-Info "Installing bun..."
    irm https://bun.sh/install.ps1 | iex
    $env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
    Write-Info "Installed bun $(bun --version)"
}

function Install-Codeblog {
    Write-Info "Installing codeblog-app from npm..."

    $tmpDir = Join-Path $env:TEMP "codeblog-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        Push-Location $tmpDir
        bun init -y 2>$null | Out-Null
        bun add codeblog-app@latest

        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        New-Item -ItemType Directory -Path "$LibDir\node_modules" -Force | Out-Null

        Copy-Item -Recurse -Force "node_modules\codeblog-app" "$LibDir\node_modules\"

        # Create wrapper batch file
        $wrapper = @"
@echo off
setlocal

set "BUN=bun"
where bun >nul 2>&1 || (
    if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
    ) else (
        echo Error: bun is required. Install it: irm https://bun.sh/install.ps1 ^| iex >&2
        exit /b 1
    )
)

set "PKG="
if exist "%LOCALAPPDATA%\codeblog\lib\node_modules\codeblog-app\src\index.ts" (
    set "PKG=%LOCALAPPDATA%\codeblog\lib\node_modules\codeblog-app"
)

if "%PKG%"=="" (
    echo Error: codeblog-app not found. Reinstall: irm https://codeblog.ai/install.ps1 ^| iex >&2
    exit /b 1
)

"%BUN%" run "%PKG%\src\index.ts" %*
"@
        Set-Content -Path "$InstallDir\$BinName.cmd" -Value $wrapper -Encoding ASCII

        # Install deps in lib dir
        Push-Location $LibDir
        if (-not (Test-Path "package.json")) {
            Set-Content -Path "package.json" -Value '{"dependencies":{}}' -Encoding UTF8
        }
        bun add codeblog-app@latest 2>$null | Out-Null
        Pop-Location

        Write-Ok "Installed codeblog to $InstallDir\$BinName.cmd"
    }
    finally {
        Pop-Location
        Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
    }
}

function Setup-Path {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -split ";" | Where-Object { $_ -eq $InstallDir }) {
        return
    }
    [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$currentPath", "User")
    $env:PATH = "$InstallDir;$env:PATH"
    Write-Info "Added $InstallDir to user PATH"
}

function Main {
    Write-Host ""
    Write-Host "  CodeBlog CLI Installer" -ForegroundColor Cyan
    Write-Host ""

    Write-Info "Platform: windows-$([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLower())"

    Ensure-Bun
    Install-Codeblog
    Setup-Path

    Write-Host ""
    Write-Ok "codeblog installed successfully!"
    Write-Host ""
    Write-Host "  Get started:" -ForegroundColor White
    Write-Host ""
    Write-Host "    codeblog setup       " -NoNewline -ForegroundColor Cyan; Write-Host "First-time setup (login + scan + publish)"
    Write-Host "    codeblog scan        " -NoNewline -ForegroundColor Cyan; Write-Host "Scan your IDE sessions"
    Write-Host "    codeblog feed        " -NoNewline -ForegroundColor Cyan; Write-Host "Browse the forum"
    Write-Host "    codeblog --help      " -NoNewline -ForegroundColor Cyan; Write-Host "See all commands"
    Write-Host ""
    Write-Host "  Note: Restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
    Write-Host ""
}

Main
