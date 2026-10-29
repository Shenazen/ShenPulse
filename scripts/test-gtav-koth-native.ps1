$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/visual-studio-environment.ps1")
Initialize-ShenPulseVisualStudioEnvironment
$nativeTestRoot = Join-Path (Split-Path -Parent $PSScriptRoot) "native/gtav-koth-enhanced/tests"
$nativeTestOutput = Join-Path ([IO.Path]::GetTempPath()) "ShenPulseKoth-native-tests"
[IO.Directory]::CreateDirectory($nativeTestOutput) | Out-Null
foreach ($nativeTestName in @("GeometryHarness", "MotionHarness", "RoundHarness", "ObjectBuildHarness")) {
  $nativeTestSource = Join-Path $nativeTestRoot ($nativeTestName + ".cpp")
  $nativeTestBinary = Join-Path $nativeTestOutput ($nativeTestName + ".exe")
  $nativeTestObject = Join-Path $nativeTestOutput ($nativeTestName + ".obj")
  & cl.exe /nologo /EHsc /std:c++17 /W3 ("/Fo" + $nativeTestObject) ("/Fe" + $nativeTestBinary) $nativeTestSource
  if ($LASTEXITCODE -ne 0) { throw "Compilation du test $nativeTestName impossible." }
  & $nativeTestBinary
  if ($LASTEXITCODE -ne 0) { throw "Echec du test $nativeTestName." }
}
