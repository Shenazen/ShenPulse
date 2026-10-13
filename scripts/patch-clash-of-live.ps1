[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $SourceDirectory,

  [Parameter(Mandatory = $true)]
  [string] $DestinationDirectory,

  [Parameter(Mandatory = $true)]
  [string] $MonoCecilPath,

  [Parameter(Mandatory = $true)]
  [string] $RceditPath,

  [Parameter(Mandatory = $true)]
  [string] $IconPath,

  [Parameter(Mandatory = $true)]
  [string] $BrandImagePath,

  [Parameter(Mandatory = $true)]
  [string] $UnityPyDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-AbsolutePath([string] $Value) {
  return [IO.Path]::GetFullPath($Value)
}

function Get-AllCecilTypes($Type) {
  $Type
  foreach ($Nested in $Type.NestedTypes) {
    Get-AllCecilTypes $Nested
  }
}

function Replace-UnitySerializedString(
  [string] $FilePath,
  [string] $OldValue,
  [string] $NewValue
) {
  $Bytes = [IO.File]::ReadAllBytes($FilePath)
  $OldBytes = [Text.Encoding]::UTF8.GetBytes($OldValue)
  $NewBytes = [Text.Encoding]::UTF8.GetBytes($NewValue)
  $OldFootprint = [int]([Math]::Ceiling($OldBytes.Length / 4.0) * 4)
  $NewFootprint = [int]([Math]::Ceiling($NewBytes.Length / 4.0) * 4)
  if ($OldFootprint -ne $NewFootprint) {
    throw "Serialized strings must keep the same aligned footprint: '$OldValue' -> '$NewValue'."
  }

  $Matches = [Collections.Generic.List[int]]::new()
  for ($Index = 4; $Index -le $Bytes.Length - $OldBytes.Length; $Index += 1) {
    if ([BitConverter]::ToInt32($Bytes, $Index - 4) -ne $OldBytes.Length) {
      continue
    }
    $Equal = $true
    for ($Offset = 0; $Offset -lt $OldBytes.Length; $Offset += 1) {
      if ($Bytes[$Index + $Offset] -ne $OldBytes[$Offset]) {
        $Equal = $false
        break
      }
    }
    if ($Equal) {
      $Matches.Add($Index)
    }
  }
  if ($Matches.Count -eq 0) {
    throw "Could not find serialized '$OldValue' in $FilePath."
  }

  foreach ($Start in $Matches) {
    [BitConverter]::GetBytes([int]$NewBytes.Length).CopyTo($Bytes, $Start - 4)
    for ($Offset = 0; $Offset -lt $OldFootprint; $Offset += 1) {
      $Bytes[$Start + $Offset] = 0
    }
    $NewBytes.CopyTo($Bytes, $Start)
  }
  [IO.File]::WriteAllBytes($FilePath, $Bytes)
}

function Replace-EncodedBytesSameLength(
  [string] $FilePath,
  [string] $OldValue,
  [string] $NewValue,
  [Text.Encoding] $Encoding = [Text.Encoding]::UTF8,
  [switch] $AllowMissing
) {
  $OldBytes = $Encoding.GetBytes($OldValue)
  $NewBytes = $Encoding.GetBytes($NewValue)
  if ($OldBytes.Length -ne $NewBytes.Length) {
    throw "Byte replacements must keep the same length: '$OldValue' -> '$NewValue'."
  }

  $Bytes = [IO.File]::ReadAllBytes($FilePath)
  $Count = 0
  for ($Index = 0; $Index -le $Bytes.Length - $OldBytes.Length; $Index += 1) {
    $Equal = $true
    for ($Offset = 0; $Offset -lt $OldBytes.Length; $Offset += 1) {
      if ($Bytes[$Index + $Offset] -ne $OldBytes[$Offset]) {
        $Equal = $false
        break
      }
    }
    if (-not $Equal) {
      continue
    }
    $NewBytes.CopyTo($Bytes, $Index)
    $Index += $OldBytes.Length - 1
    $Count += 1
  }
  if ($Count -eq 0 -and -not $AllowMissing) {
    throw "Could not find '$OldValue' in $FilePath."
  }
  if ($Count -gt 0) {
    [IO.File]::WriteAllBytes($FilePath, $Bytes)
  }
  return $Count
}

function New-SameLengthPlaceholder([string] $Value, [string] $Prefix) {
  if ($Prefix.Length -gt $Value.Length) {
    throw "Placeholder prefix is longer than '$Value'."
  }
  return $Prefix + ("_" * ($Value.Length - $Prefix.Length))
}

function Convert-BrandString([string] $Value) {
  switch ($Value) {
    "https://tiklive.eu/api/validate-license.php" { return "disabled://local-license" }
    "https://tiklive.eu/api/game-launch-verify.php" { return "disabled://local-launch" }
    "https://tiklive.eu/api/game-session.php" { return "disabled://local-session" }
    "support@tiklive.eu" { return "Support ShenPulse" }
    "TIKLIVE_TICKET" { return "SHENPULSE_LOCAL" }
    "-tlticket" { return "-shenpulse-local" }
    "clash-of-live" { return "shenpulse-clash" }
    "CLASH OF LIVE" { return "CLASH OF SHENPULSE" }
  }

  $Value = $Value.Replace("support@tiklive.eu", "Support ShenPulse")
  $Value = $Value.Replace("clash-of-live", "shenpulse-clash")
  $Value = $Value.Replace("CLASH OF LIVE", "CLASH OF SHENPULSE")

  if (
    $Value -match "TikLiveRoue|TikLive\.Roue|tikliveroue[/\\]"
  ) {
    return $Value
  }

  if ($Value -cmatch "TikLive|TIKLIVE|Tiklive") {
    $Replacement = $Value.Replace("TIKLIVE", "SHENPULSE")
    $Replacement = $Replacement.Replace("TikLive", "ShenPulse")
    return $Replacement.Replace("Tiklive", "ShenPulse")
  }
  return $Value
}

$Source = Resolve-AbsolutePath $SourceDirectory
$Destination = Resolve-AbsolutePath $DestinationDirectory
$Cecil = Resolve-AbsolutePath $MonoCecilPath
$Rcedit = Resolve-AbsolutePath $RceditPath
$Icon = Resolve-AbsolutePath $IconPath

if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
  throw "Clash Of Live source directory not found: $Source"
}
foreach ($RequiredPath in @(
  (Join-Path $Source "CLASH OF LIVE.exe"),
  (Join-Path $Source "CLASH OF LIVE_Data"),
  $Cecil,
  $Rcedit,
  $Icon
)) {
  if (-not (Test-Path -LiteralPath $RequiredPath)) {
    throw "Required file or directory not found: $RequiredPath"
  }
}
if ([string]::Equals($Source, $Destination, [StringComparison]::OrdinalIgnoreCase)) {
  throw "The destination must differ from the original game directory."
}
if (Test-Path -LiteralPath $Destination) {
  throw "The destination already exists. Refusing to overwrite it: $Destination"
}

[IO.Directory]::CreateDirectory($Destination) | Out-Null
Get-ChildItem -LiteralPath $Source -Force |
  Copy-Item -Destination $Destination -Recurse -Force

$OriginalDataDirectory = Join-Path $Destination "CLASH OF LIVE_Data"
$AssemblyPath = Join-Path $OriginalDataDirectory "Managed\Assembly-CSharp.dll"
$GlobalManagersPath = Join-Path $OriginalDataDirectory "globalgamemanagers"
$LevelPath = Join-Path $OriginalDataDirectory "level0"
$SharedAssetsPath = Join-Path $OriginalDataDirectory "sharedassets0.assets"
$AppInfoPath = Join-Path $OriginalDataDirectory "app.info"

Add-Type -Path $Cecil
$Resolver = [Mono.Cecil.DefaultAssemblyResolver]::new()
$Resolver.AddSearchDirectory((Split-Path -Parent $AssemblyPath))
$ReaderParameters = [Mono.Cecil.ReaderParameters]::new()
$ReaderParameters.AssemblyResolver = $Resolver
$ReaderParameters.ReadSymbols = $false
$Assembly = [Mono.Cecil.AssemblyDefinition]::ReadAssembly(
  $AssemblyPath,
  $ReaderParameters
)
try {
  $LicenceType = $Assembly.MainModule.Types |
    Where-Object { $_.FullName -eq "TikLiveLicence" } |
    Select-Object -First 1
  if ($null -eq $LicenceType) {
    throw "TikLiveLicence type not found in Assembly-CSharp.dll."
  }
  $Bootstrap = $LicenceType.Methods |
    Where-Object { $_.Name -eq "Demarrer" -and $_.IsStatic } |
    Select-Object -First 1
  if ($null -eq $Bootstrap -or -not $Bootstrap.HasBody) {
    throw "TikLiveLicence.Demarrer bootstrap method not found."
  }

  $Bootstrap.Body.Instructions.Clear()
  $Bootstrap.Body.ExceptionHandlers.Clear()
  $Bootstrap.Body.Variables.Clear()
  $Bootstrap.Body.InitLocals = $false
  $Bootstrap.Body.GetILProcessor().Append(
    [Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ret)
  )

  $Constants = @{
    GAME_ID = "shenpulse-clash"
    URL = "disabled://local-license"
  }
  foreach ($Entry in $Constants.GetEnumerator()) {
    $Field = $LicenceType.Fields |
      Where-Object { $_.Name -eq $Entry.Key } |
      Select-Object -First 1
    if ($null -eq $Field -or -not $Field.HasConstant) {
      throw "TikLiveLicence.$($Entry.Key) constant not found."
    }
    $Field.Constant = $Entry.Value
  }

  $ChangedStrings = 0
  foreach ($RootType in $Assembly.MainModule.Types) {
    foreach ($Type in Get-AllCecilTypes $RootType) {
      foreach ($Method in $Type.Methods) {
        if (-not $Method.HasBody) {
          continue
        }
        foreach ($Instruction in $Method.Body.Instructions) {
          if ($Instruction.OpCode.Code -ne [Mono.Cecil.Cil.Code]::Ldstr) {
            continue
          }
          $Current = [string] $Instruction.Operand
          $Replacement = Convert-BrandString $Current
          if ($Replacement -cne $Current) {
            $Instruction.Operand = $Replacement
            $ChangedStrings += 1
          }
        }
      }
    }
  }

  $PatchedAssemblyPath = "$AssemblyPath.patched"
  $Assembly.Write($PatchedAssemblyPath)
} finally {
  $Assembly.Dispose()
  $Resolver.Dispose()
}
Move-Item -LiteralPath $PatchedAssemblyPath -Destination $AssemblyPath -Force

$ScrubbedNetworkStrings = 0
foreach ($OldValue in @(
  "https://tiklive.eu/api/validate-license.php",
  "https://tiklive.eu/api/game-launch-verify.php",
  "https://tiklive.eu/api/game-session.php",
  "TIKLIVE_TICKET"
)) {
  $NewValue = New-SameLengthPlaceholder $OldValue "DISABLED"
  $ScrubbedNetworkStrings += Replace-EncodedBytesSameLength `
    $AssemblyPath $OldValue $NewValue ([Text.Encoding]::UTF8) -AllowMissing
  $ScrubbedNetworkStrings += Replace-EncodedBytesSameLength `
    $AssemblyPath $OldValue $NewValue ([Text.Encoding]::Unicode) -AllowMissing
}

$TikLivePresents = "TIKLIVE PR$([char]0x00C9)SENTE"
Replace-UnitySerializedString $GlobalManagersPath "TikLive" "SPulse"
Replace-UnitySerializedString $GlobalManagersPath "CLASH OF LIVE" "CLASH SHENPULSE"
Replace-UnitySerializedString $LevelPath $TikLivePresents "SHENPULSE PRESENTE"
[IO.File]::WriteAllText(
  $AppInfoPath,
  "ShenPulse`nCLASH OF SHENPULSE`n",
  [Text.UTF8Encoding]::new($false)
)

$PatchedFloorLogo = $false
$BrandImage = Resolve-AbsolutePath $BrandImagePath
$UnityPy = Resolve-AbsolutePath $UnityPyDirectory
foreach ($RequiredPath in @($BrandImage, $UnityPy)) {
  if (-not (Test-Path -LiteralPath $RequiredPath)) {
    throw "Branding dependency not found: $RequiredPath"
  }
}
$PreviousPythonPath = $env:PYTHONPATH
try {
  $env:PYTHONPATH = $UnityPy
  & py (Join-Path $PSScriptRoot "patch-unity-texture.py") `
    --asset $SharedAssetsPath `
    --texture LogoTikLive `
    --image $BrandImage
  if ($LASTEXITCODE -ne 0) {
    throw "Unity texture patch failed with exit code $LASTEXITCODE."
  }
  $PatchedFloorLogo = $true
} finally {
  $env:PYTHONPATH = $PreviousPythonPath
}

foreach ($ObsoletePath in @(
  (Join-Path $Destination "license.key"),
  (Join-Path $Destination "_tiklive_lancer.vbs")
)) {
  if (Test-Path -LiteralPath $ObsoletePath) {
    Remove-Item -LiteralPath $ObsoletePath -Force
  }
}

$OriginalExecutable = Join-Path $Destination "CLASH OF LIVE.exe"
$Executable = Join-Path $Destination "Clash Of ShenPulse.exe"
Move-Item -LiteralPath $OriginalExecutable -Destination $Executable
& $Rcedit $Executable `
  --set-icon $Icon `
  --set-version-string CompanyName "ShenPulse" `
  --set-version-string FileDescription "Clash Of ShenPulse" `
  --set-version-string InternalName "Clash Of ShenPulse" `
  --set-version-string OriginalFilename "Clash Of ShenPulse.exe" `
  --set-version-string ProductName "Clash Of ShenPulse"
if ($LASTEXITCODE -ne 0) {
  throw "rcedit failed with exit code $LASTEXITCODE."
}

$DataDirectory = Join-Path $Destination "Clash Of ShenPulse_Data"
Move-Item -LiteralPath $OriginalDataDirectory -Destination $DataDirectory

$Result = [ordered]@{
  source = $Source
  destination = $Destination
  executable = $Executable
  dataDirectory = $DataDirectory
  patchedLicenceBootstrap = $true
  patchedBrandStrings = $ChangedStrings
  scrubbedNetworkStrings = $ScrubbedNetworkStrings
  patchedFloorLogo = $PatchedFloorLogo
  removedLicenceKey = -not (Test-Path -LiteralPath (Join-Path $Destination "license.key"))
  removedTikLiveLauncher = -not (Test-Path -LiteralPath (Join-Path $Destination "_tiklive_lancer.vbs"))
  originalLicenceKeyPreserved = Test-Path -LiteralPath (Join-Path $Source "license.key")
}
$Result | ConvertTo-Json -Depth 3
