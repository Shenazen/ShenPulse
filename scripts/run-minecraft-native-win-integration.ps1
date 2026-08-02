$ErrorActionPreference = "Stop"

$gameRoot = Join-Path $env:APPDATA "ShenPulse\games\minecraft-bedrock-box"
$javaPath = Join-Path $gameRoot "runtime\java\jdk-21.0.11+10-jre\bin\java.exe"

if (-not (Test-Path -LiteralPath $javaPath -PathType Leaf)) {
  throw "Java Minecraft est introuvable : $javaPath"
}

Push-Location $gameRoot
try {
  & {
    Start-Sleep -Seconds 22
    Write-Output "shenpulse_win set 1"
    Start-Sleep -Seconds 2
    Write-Output "bedrock clear"
    Start-Sleep -Seconds 2
    Write-Output "bedrock fill"

    # Interrompt le premier cube pendant les dernières secondes natives.
    Start-Sleep -Seconds 16
    Write-Output "bedrock clear"
    Start-Sleep -Seconds 8

    # Laisse le second cube atteindre le signal natif win-up.
    Write-Output "bedrock fill"
    Start-Sleep -Seconds 72

    # Vérifie séparément le cadeau WIN, puis restaure le compteur.
    Write-Output "bedrock win 1"
    Start-Sleep -Seconds 3
    Write-Output "shenpulse_win set 1"
    Start-Sleep -Seconds 2
    Write-Output "stop"
  } | & $javaPath "-Xms1024M" "-Xmx2048M" "-jar" "paper-1.21-130.jar" "nogui"
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
