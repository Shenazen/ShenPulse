"use strict";

const { spawn } = require("node:child_process");

async function releaseCrowdControlPort(
  incomingPort,
  {
    platform = process.platform,
    runPowerShell = runPowerShellScript
  } = {}
) {
  const port = Number(incomingPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("Le port local Crowd Control est invalide.");
  }
  if (platform !== "win32" || port === 0) {
    return { released: false, reason: "not-applicable" };
  }

  const output = String(
    await runPowerShell(buildCrowdControlPortReleaseScript(port))
  ).trim();
  const result = parseCrowdControlPortReleaseResult(output);
  if (result.status === "free") {
    return { released: false, reason: "free" };
  }
  if (result.status === "closed") {
    return {
      released: true,
      reason: "crowd-control-closed",
      processId: result.processId
    };
  }
  if (result.status === "busy") {
    throw new Error(
      `Le port local ${port} est déjà utilisé par ${result.name || "une autre application"}. Fermez cette application, puis réessayez.`
    );
  }
  throw new Error(
    `Le port local ${port} n’a pas pu être libéré. Fermez Crowd Control, puis réessayez.`
  );
}

function buildCrowdControlPortReleaseScript(port) {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$port = ${port}`,
    "$listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Sort-Object OwningProcess -Unique)",
    "if ($listeners.Count -eq 0) { Write-Output 'FREE'; exit 0 }",
    "$owners = @($listeners | ForEach-Object { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.OwningProcess) -ErrorAction SilentlyContinue })",
    "$client = $owners | Where-Object {",
    "  $_.Name -ieq 'CrowdControl.Client.Slim.exe' -and",
    "  $_.ExecutablePath -like '*\\CrowdControl-Apps\\Client\\*\\CrowdControl.Client.Slim.exe'",
    "} | Select-Object -First 1",
    "if (-not $client) {",
    "  $owner = $owners | Select-Object -First 1",
    "  $name = if ($owner.Name) { $owner.Name } else { 'une autre application' }",
    "  $pidValue = if ($owner.ProcessId) { [string]$owner.ProcessId } else { '0' }",
    "  Write-Output ('BUSY|' + $pidValue + '|' + $name)",
    "  exit 0",
    "}",
    "$ids = @([int]$client.ProcessId)",
    "$localRoot = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\\crowdcontrol'))",
    "Get-CimInstance Win32_Process -Filter \"Name='CrowdControl.exe'\" -ErrorAction SilentlyContinue | ForEach-Object {",
    "  if ($_.ExecutablePath) {",
    "    $full = [IO.Path]::GetFullPath($_.ExecutablePath)",
    "    if ($full.StartsWith($localRoot + '\\', [StringComparison]::OrdinalIgnoreCase)) { $ids += [int]$_.ProcessId }",
    "  }",
    "}",
    "$ids | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }",
    "$deadline = [DateTime]::UtcNow.AddSeconds(5)",
    "do {",
    "  Start-Sleep -Milliseconds 100",
    "  $remaining = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)",
    "} while ($remaining.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline)",
    "if ($remaining.Count -gt 0) { Write-Output 'BLOCKED'; exit 0 }",
    "Write-Output ('CLOSED|' + [string]$client.ProcessId)"
  ].join("\r\n");
}

function parseCrowdControlPortReleaseResult(output) {
  const line = String(output || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1) || "";
  if (line === "FREE") return { status: "free" };
  if (line === "BLOCKED") return { status: "blocked" };
  if (line.startsWith("CLOSED|")) {
    return {
      status: "closed",
      processId: Number(line.split("|")[1] || 0)
    };
  }
  if (line.startsWith("BUSY|")) {
    const [, processId, name] = line.split("|");
    return {
      status: "busy",
      processId: Number(processId || 0),
      name: String(name || "")
    };
  }
  return { status: "unknown" };
}

function runPowerShellScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script
      ],
      {
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new Error(
          stderr.trim() ||
            "Impossible de vérifier le port local Crowd Control."
        )
      );
    });
  });
}

module.exports = {
  buildCrowdControlPortReleaseScript,
  parseCrowdControlPortReleaseResult,
  releaseCrowdControlPort
};
