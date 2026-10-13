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
  [string] $IconPath
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

function Convert-BrandString([string] $Value) {
  switch ($Value) {
    "https://tiklive.eu/api/game-launch-verify.php" { return "disabled://local-launch" }
    "https://tiklive.eu/api/game-session.php" { return "disabled://local-session" }
    "support@tiklive.eu" { return "Support ShenPulse" }
    "TIKLIVE_TICKET" { return "SHENPULSE_LOCAL" }
    "-tlticket" { return "-shenpulse-local" }
    "tiklive-cubewars" { return "shenpulse-cubewars" }
  }

  $Value = $Value.Replace("support@tiklive.eu", "Support ShenPulse")
  $Value = $Value.Replace("tiklive-cubewars", "shenpulse-cubewars")

  if (
    $Value -match "TikLiveRoue|TikLive\.Roue|TikLive\.Party|tikliveroue[/\\]"
  ) {
    return $Value
  }

  if ($Value -cmatch "TikLive|TIKLIVE|Tiklive") {
    $Replacement = $Value.Replace("TIKLIVE CUBE WARS", "SHENPULSE CUBE WARS")
    $Replacement = $Replacement.Replace("TIKLIVE", "SHENPULSE")
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
  throw "TikLive Cube Wars source directory not found: $Source"
}
foreach ($RequiredPath in @(
  (Join-Path $Source "TIKLIVE CUBE WARS.exe"),
  (Join-Path $Source "TIKLIVE CUBE WARS_Data"),
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

$OriginalDataDirectory = Join-Path $Destination "TIKLIVE CUBE WARS_Data"
$AssemblyPath = Join-Path $OriginalDataDirectory "Managed\Assembly-CSharp.dll"
$GlobalManagersPath = Join-Path $OriginalDataDirectory "globalgamemanagers"
$ResourcesPath = Join-Path $OriginalDataDirectory "resources.assets"
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
    URL_VERIF = "disabled"
    URL_SESSION = "disabled"
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
foreach ($Pair in @(
  @("https://tiklive.eu/api/game-launch-verify.php", "DISABLED_____________________________________"),
  @("https://tiklive.eu/api/game-session.php", "DISABLED_______________________________"),
  @("support@tiklive.eu", "Support ShenPulse!"),
  @("TIKLIVE_TICKET", "SHENPULSELOCAL")
)) {
  if ($Pair[0].Length -ne $Pair[1].Length) {
    throw "Invalid scrub replacement length for '$($Pair[0])'."
  }
  $ScrubbedNetworkStrings += Replace-EncodedBytesSameLength `
    $AssemblyPath $Pair[0] $Pair[1] ([Text.Encoding]::UTF8) -AllowMissing
  $ScrubbedNetworkStrings += Replace-EncodedBytesSameLength `
    $AssemblyPath $Pair[0] $Pair[1] ([Text.Encoding]::Unicode) -AllowMissing
}

Replace-UnitySerializedString $GlobalManagersPath "TikLive" "SPulse"
Replace-UnitySerializedString $GlobalManagersPath "TIKLIVE CUBE WARS" "SHENPULSE CUBE WARS"
[void] (Replace-EncodedBytesSameLength $ResourcesPath "TikLive" "Shen SP")
[void] (Replace-EncodedBytesSameLength $ResourcesPath "TIKLIVE CUBE WARS" "SHPULSE CUBE WARS" -AllowMissing)
[IO.File]::WriteAllText(
  $AppInfoPath,
  "ShenPulse`nSHENPULSE CUBE WARS`n",
  [Text.UTF8Encoding]::new($false)
)

$LicenceKey = Join-Path $Destination "license.key"
if (Test-Path -LiteralPath $LicenceKey -PathType Leaf) {
  Remove-Item -LiteralPath $LicenceKey -Force
}
$TikLiveLauncher = Join-Path $Destination "_tiklive_lancer.vbs"
if (Test-Path -LiteralPath $TikLiveLauncher -PathType Leaf) {
  Remove-Item -LiteralPath $TikLiveLauncher -Force
}

$OriginalExecutable = Join-Path $Destination "TIKLIVE CUBE WARS.exe"
$Executable = Join-Path $Destination "ShenPulse Cube Wars.exe"
Move-Item -LiteralPath $OriginalExecutable -Destination $Executable
& $Rcedit $Executable `
  --set-icon $Icon `
  --set-version-string CompanyName "ShenPulse" `
  --set-version-string FileDescription "ShenPulse Cube Wars" `
  --set-version-string InternalName "ShenPulse Cube Wars" `
  --set-version-string OriginalFilename "ShenPulse Cube Wars.exe" `
  --set-version-string ProductName "ShenPulse Cube Wars"
if ($LASTEXITCODE -ne 0) {
  throw "rcedit failed with exit code $LASTEXITCODE."
}

$DataDirectory = Join-Path $Destination "ShenPulse Cube Wars_Data"
Move-Item -LiteralPath $OriginalDataDirectory -Destination $DataDirectory

$Result = [ordered]@{
  source = $Source
  destination = $Destination
  executable = $Executable
  dataDirectory = $DataDirectory
  patchedLicenceBootstrap = $true
  patchedBrandStrings = $ChangedStrings
  scrubbedNetworkStrings = $ScrubbedNetworkStrings
  removedLicenceKey = -not (Test-Path -LiteralPath $LicenceKey)
  removedTikLiveLauncher = -not (Test-Path -LiteralPath $TikLiveLauncher)
  originalLicenceKeyPreserved = Test-Path -LiteralPath (Join-Path $Source "license.key")
}
$Result | ConvertTo-Json -Depth 3
