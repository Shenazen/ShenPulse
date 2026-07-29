$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$executablePath = Join-Path $projectRoot "dist\win-unpacked\ShenPulse.exe"
$npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source

$running = Get-Process -Name "ShenPulse" -ErrorAction SilentlyContinue |
  Where-Object {
    try {
      [string]::Equals(
        $_.Path,
        $executablePath,
        [StringComparison]::OrdinalIgnoreCase
      )
    } catch {
      $false
    }
  }
if ($running) {
  $running | Stop-Process -Force
  $running | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
}

Push-Location $projectRoot
try {
  & $npmPath run build:dir
  if ($LASTEXITCODE -ne 0) {
    throw "La construction de ShenPulse.exe a échoué (code $LASTEXITCODE)."
  }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
  throw "ShenPulse.exe est introuvable après la construction."
}

# Codex peut définir cette variable pour ses propres processus Node. Elle ne
# doit jamais être transmise à l’application Electron autonome.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process `
  -FilePath $executablePath `
  -WorkingDirectory (Split-Path -Parent $executablePath)

Write-Output "ShenPulse autonome démarré : $executablePath"
