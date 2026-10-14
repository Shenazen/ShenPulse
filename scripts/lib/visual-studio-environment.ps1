# Prépare le compilateur x64 pour les builds et les tests natifs sans lancer de jeu.
function Initialize-ShenPulseVisualStudioEnvironment {
  $nativeVsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  if (-not (Test-Path -LiteralPath $nativeVsWhere -PathType Leaf)) {
    throw "Visual Studio Build Tools est requis pour compiler le code natif."
  }
  $nativeVisualStudio = & $nativeVsWhere -latest -products "*" -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if (-not $nativeVisualStudio) {
    throw "Les outils C++ x64 de Visual Studio sont introuvables."
  }
  $nativeDevCmd = Join-Path $nativeVisualStudio "Common7\Tools\VsDevCmd.bat"
  if (-not (Test-Path -LiteralPath $nativeDevCmd -PathType Leaf)) {
    throw "VsDevCmd.bat est introuvable."
  }
  $nativeEnvironmentLines = & $env:ComSpec /d /s /c "`"$nativeDevCmd`" -no_logo -arch=x64 -host_arch=x64 >nul && set"
  foreach ($line in $nativeEnvironmentLines) {
    $separator = $line.IndexOf("=")
    if ($separator -le 0) { continue }
    Set-Item -LiteralPath ("Env:" + $line.Substring(0, $separator)) -Value $line.Substring($separator + 1)
  }
}
