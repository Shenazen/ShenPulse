param(
  [string] $SourceArchive = '',
  [string] $CecilPackage = '',
  [string] $OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (!$OutputPath) { $OutputPath = Join-Path $repo 'resources/installer-assets/the-mortuary-assistant/1.0.0/the-mortuary-assistant-shenpulse-1.0.0.zip' }
$work = Join-Path $repo ('.tmp/mortuary-build-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($work) | Out-Null
function AssertHash([string] $file, [string] $hash) {
  if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $hash) { throw ('Unexpected input SHA256: ' + $file) }
}
function AllTypes($types) { foreach ($type in $types) { $type; AllTypes $type.NestedTypes } }
function EffectBodies($types) {
  $bodies = @{}
  foreach ($type in $types) {
    if ($type.Namespace -notmatch '\.Delegates\.Effects') { continue }
    foreach ($method in $type.Methods) {
      if (!$method.HasBody) { continue }
      $key = $method.FullName.Replace('CrowdControl.TheMortuaryAssistant', 'ShenPulse.TheMortuaryAssistant')
      $body = ($method.Body.Instructions | ForEach-Object { $_.ToString().Replace('CrowdControl.TheMortuaryAssistant', 'ShenPulse.TheMortuaryAssistant') }) -join "`n"
      $bodies[$key] = $body
    }
  }
  return $bodies
}
function ReplaceBody($method, [bool] $result, [bool] $returnsValue) {
  $method.Body.Instructions.Clear()
  $method.Body.ExceptionHandlers.Clear()
  $method.Body.Variables.Clear()
  if ($returnsValue) {
    $op = [Mono.Cecil.Cil.OpCodes]::Ldc_I4_0
    if ($result) { $op = [Mono.Cecil.Cil.OpCodes]::Ldc_I4_1 }
    $method.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create($op))
  }
  $method.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ret))
}
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  if (!$SourceArchive) {
    $SourceArchive = Join-Path $work 'upstream.zip'
    Invoke-WebRequest -UseBasicParsing 'https://one-click.crowdcontrol.live/TheMortuaryAssistant/TheMortuaryAssistant-CC.zip' -OutFile $SourceArchive
  }
  AssertHash $SourceArchive '034a072e9beac59359b4893d0bbb680b457753bca219b80dec0ae0c9112e4be4'
  if (!$CecilPackage) {
    $CecilPackage = Join-Path $work 'cecil.zip'
    Invoke-WebRequest -UseBasicParsing 'https://api.nuget.org/v3-flatcontainer/mono.cecil/0.11.6/mono.cecil.0.11.6.nupkg' -OutFile $CecilPackage
  }
  AssertHash $CecilPackage 'd2a23832aaa948ba9a01acc42b5726e34c5f995958f1b30d45c0e7c70b3a72d5'
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path $CecilPackage).Path, (Join-Path $work 'cecil'))
  [Reflection.Assembly]::Load([IO.File]::ReadAllBytes((Join-Path $work 'cecil/lib/net40/Mono.Cecil.dll'))) | Out-Null
  $payload = Join-Path $work 'payload'
  [IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path $SourceArchive).Path, $payload)
  $original = Join-Path $payload 'Mods/CrowdControl.TheMortuaryAssistant.dll'
  AssertHash $original 'd9b04bbf8f1e9d7c96f3978ab1d790116dd5523573ba9591d0a9db6cdf883089'
  $resolver = [Mono.Cecil.DefaultAssemblyResolver]::new()
  $resolver.AddSearchDirectory((Join-Path $payload 'UserLibs'))
  $resolver.AddSearchDirectory((Join-Path $payload 'MelonLoader/net6'))
  $reader = [Mono.Cecil.ReaderParameters]::new()
  $reader.AssemblyResolver = $resolver
  $module = [Mono.Cecil.ModuleDefinition]::ReadModule($original, $reader)
  $types = @(AllTypes $module.Types)
  $effectBodies = EffectBodies $types
  $network = $types | Where-Object FullName -eq 'CrowdControl.TheMortuaryAssistant.NetworkClient'
  $found = @($network.Methods | Where-Object Name -eq 'get_CrowdControlClientFound')
  $title = @($types | Where-Object FullName -eq 'CrowdControl.TheMortuaryAssistant.Harmony.TitleScreenVersionPatch' | ForEach-Object Methods | Where-Object Name -eq 'Postfix')
  if ($found.Count -ne 1 -or $title.Count -ne 1) { throw 'Unexpected mod structure.' }
  # No process/semaphore dependency. The native WebSocket connects straight to ShenPulse.
  ReplaceBody $found[0] $true $true
  foreach ($method in ($network.Methods | Where-Object { $_.Name -in @('IsCrowdControlSemaphorePresent', 'IsCrowdControlProcessRunning') })) {
    ReplaceBody $method $false $true
  }
  # The game title must stay the native game title.
  ReplaceBody $title[0] $false $false
  $replaced = 0
  foreach ($type in $types) {
    foreach ($field in $type.Fields) {
      if ($field.HasConstant -and $field.Constant -is [string]) {
        $field.Constant = [regex]::Replace($field.Constant, '(?i)crowd\s*control', 'ShenPulse')
      }
    }
    foreach ($method in $type.Methods) {
      if (!$method.HasBody) { continue }
      foreach ($instruction in $method.Body.Instructions) {
        if ($instruction.OpCode.Name -ne 'ldstr') { continue }
        $text = [string] $instruction.Operand
        if ($text -match '(?i)crowd\s*control') {
          $text = [regex]::Replace($text, '(?i)crowd\s*control', 'ShenPulse')
          $text = $text.Replace('com.warpworld.shenpulse.', 'com.shenpulse.')
          $instruction.Operand = $text
          $replaced++
        }
      }
    }
  }
  if ($replaced -lt 25) { throw 'Expected branding replacements were not found.' }
  $indicator = $types | Where-Object Name -eq 'Plugin' | ForEach-Object Methods | Where-Object Name -eq 'DrawIndicator'
  foreach ($instruction in $indicator.Body.Instructions) {
    if ($instruction.OpCode.Name -eq 'ldstr') {
      $instruction.Operand = ([string] $instruction.Operand).Replace('Waiting for app', 'En attente').Replace('Connected', 'Connecte')
    }
  }
  $info = $module.Assembly.CustomAttributes | Where-Object { $_.AttributeType.FullName -eq 'MelonLoader.MelonInfoAttribute' }
  # Preserve the original author credit; change the product name and remove its URL.
  $info.ConstructorArguments[1] = [Mono.Cecil.CustomAttributeArgument]::new($module.TypeSystem.String, 'ShenPulse - The Mortuary Assistant')
  $info.ConstructorArguments[4] = [Mono.Cecil.CustomAttributeArgument]::new($module.TypeSystem.String, '')
  $module.Assembly.Name.Name = 'ShenPulse.TheMortuaryAssistant'
  $module.Name = 'ShenPulse.TheMortuaryAssistant.dll'
  foreach ($type in @($module.GetTypeReferences()) + $types) {
    if ($type.Namespace.StartsWith('CrowdControl.TheMortuaryAssistant')) {
      $type.Namespace = $type.Namespace.Replace('CrowdControl.TheMortuaryAssistant', 'ShenPulse.TheMortuaryAssistant')
    }
  }
  $module.Write((Join-Path $payload 'Mods/ShenPulse.TheMortuaryAssistant.dll'))
  $module.Dispose()
  $verified = [Mono.Cecil.ModuleDefinition]::ReadModule((Join-Path $payload 'Mods/ShenPulse.TheMortuaryAssistant.dll'), $reader)
  try {
    $writtenTypes = @(AllTypes $verified.Types)
    $writtenBodies = EffectBodies $writtenTypes
    if ($writtenBodies.Count -ne $effectBodies.Count) { throw 'Effect implementation count changed.' }
    foreach ($key in $effectBodies.Keys) {
      if ($effectBodies[$key] -cne $writtenBodies[$key]) { throw ('Effect implementation changed: ' + $key) }
    }
    $gate = $writtenTypes | Where-Object Name -eq 'NetworkClient' | ForEach-Object Methods | Where-Object Name -eq 'get_CrowdControlClientFound'
    if (($gate.Body.Instructions.OpCode.Name -join ',') -ne 'ldc.i4.1,ret') { throw 'Companion-app dependency was not removed.' }
    if ($verified.Assembly.Name.Name -ne 'ShenPulse.TheMortuaryAssistant') { throw 'Unexpected assembly identity.' }
    Write-Host ('Verified ' + $writtenBodies.Count + ' effect methods unchanged and direct local connection enabled.')
  } finally { $verified.Dispose() }
  Remove-Item -LiteralPath $original
  Remove-Item -LiteralPath (Join-Path $payload 'Mods/ccver')
  # This notice is technical provenance, outside the product UI.
  $notice = @'
ShenPulse local bridge adaptation, 2026-10-20.
Game effect implementation: Warp World, original version 1.0.45.
Upstream archive SHA256: 034a072e9beac59359b4893d0bbb680b457753bca219b80dec0ae0c9112e4be4
Changes: direct loopback connection; no companion-app detection; ShenPulse UI;
disabled title-screen branding. Game guards, handlers and effect timing retained.
MelonLoader and its dependencies retain their supplied documentation and licenses.
'@
  [IO.File]::WriteAllText((Join-Path $payload 'MelonLoader/Documentation/ShenPulse-NOTICES.txt'), $notice, [Text.UTF8Encoding]::new($false))
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))) | Out-Null
  $stream = [IO.File]::Open($OutputPath, [IO.FileMode]::Create)
  $zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in (Get-ChildItem -LiteralPath $payload -Recurse -File | Sort-Object FullName)) {
      $relative = $file.FullName.Substring($payload.Length + 1).Replace('\', '/')
      $entry = $zip.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
      $entryStream = $entry.Open()
      try { $bytes = [IO.File]::ReadAllBytes($file.FullName); $entryStream.Write($bytes, 0, $bytes.Length) }
      finally { $entryStream.Dispose() }
    }
  } finally { $zip.Dispose(); $stream.Dispose() }
  Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256
  (Get-Item -LiteralPath $OutputPath).Length
} finally {
  if ($module) { $module.Dispose() }
  if ($resolver) { $resolver.Dispose() }
  $resolvedWork = [IO.Path]::GetFullPath($work)
  $allowedRoot = [IO.Path]::GetFullPath((Join-Path $repo '.tmp')) + [IO.Path]::DirectorySeparatorChar
  if (!$resolvedWork.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe temporary directory.' }
  Remove-Item -LiteralPath $resolvedWork -Recurse -Force
}
