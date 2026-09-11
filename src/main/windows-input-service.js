"use strict";

const { spawn } = require("node:child_process");

const MAX_EVENTS = 120;
const MAX_SEQUENCE_MS = 30_000;

const WINDOWS_INPUT_SCRIPT = String.raw`
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$Operation = [string]$env:SHENPULSE_INPUT_OPERATION
$ProcessName = [string]$env:SHENPULSE_INPUT_PROCESS
$EncodedEvents = [string]$env:SHENPULSE_INPUT_EVENTS
$ErrorActionPreference = 'Stop'

$target = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Select-Object -First 1
if (-not $target) {
  throw "Fortnite n'est pas ouvert ou sa fenêtre n'est pas encore prête."
}
$target.Refresh()
$window = [IntPtr]$target.MainWindowHandle
if ($window -eq [IntPtr]::Zero) {
  throw "La fenêtre Fortnite est introuvable."
}

if ($Operation -eq 'status') {
  @{ ok = $true; processId = $target.Id; processName = $target.ProcessName } |
    ConvertTo-Json -Compress |
    Write-Output
  exit 0
}

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class ShenPulseFortniteInput {
  private const uint INPUT_KEYBOARD = 1;
  private const uint KEYEVENTF_KEYUP = 0x0002;
  private const int SW_RESTORE = 9;

  [StructLayout(LayoutKind.Sequential)]
  private struct INPUT {
    public uint type;
    public InputUnion U;
  }

  [StructLayout(LayoutKind.Explicit)]
  private struct InputUnion {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
    [FieldOffset(0)] public HARDWAREINPUT hi;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct MOUSEINPUT {
    public int dx;
    public int dy;
    public uint mouseData;
    public uint dwFlags;
    public uint time;
    public UIntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public UIntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct HARDWAREINPUT {
    public uint uMsg;
    public ushort wParamL;
    public ushort wParamH;
  }

  [DllImport("user32.dll", SetLastError = true)]
  private static extern uint SendInput(
    uint numberOfInputs,
    INPUT[] inputs,
    int sizeOfInput
  );

  [DllImport("user32.dll")]
  private static extern bool SetForegroundWindow(IntPtr window);

  [DllImport("user32.dll")]
  private static extern bool BringWindowToTop(IntPtr window);

  [DllImport("user32.dll")]
  private static extern bool ShowWindowAsync(IntPtr window, int command);

  [DllImport("user32.dll")]
  private static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(
    IntPtr window,
    IntPtr processId
  );

  [DllImport("kernel32.dll")]
  private static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  private static extern bool AttachThreadInput(
    uint idAttach,
    uint idAttachTo,
    bool attach
  );

  public static bool Activate(IntPtr window) {
    ShowWindowAsync(window, SW_RESTORE);
    IntPtr foreground = GetForegroundWindow();
    uint currentThread = GetCurrentThreadId();
    uint foregroundThread = foreground == IntPtr.Zero
      ? 0
      : GetWindowThreadProcessId(foreground, IntPtr.Zero);
    bool attached = foregroundThread != 0 && foregroundThread != currentThread;
    if (attached) AttachThreadInput(currentThread, foregroundThread, true);
    try {
      BringWindowToTop(window);
      SetForegroundWindow(window);
    } finally {
      if (attached) AttachThreadInput(currentThread, foregroundThread, false);
    }
    return GetForegroundWindow() == window;
  }

  public static bool IsForeground(IntPtr window) {
    return GetForegroundWindow() == window;
  }

  public static void SendKey(ushort virtualKey, bool keyUp) {
    INPUT input = new INPUT();
    input.type = INPUT_KEYBOARD;
    input.U.ki.wVk = virtualKey;
    input.U.ki.wScan = 0;
    input.U.ki.dwFlags = keyUp ? KEYEVENTF_KEYUP : 0;
    input.U.ki.time = 0;
    input.U.ki.dwExtraInfo = UIntPtr.Zero;
    uint sent = SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT)));
    if (sent != 1) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
  }
}
'@

if (-not [ShenPulseFortniteInput]::Activate($window)) {
  throw "Windows n'a pas pu placer Fortnite au premier plan."
}
Start-Sleep -Milliseconds 120

$eventsJson = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String($EncodedEvents)
)
$events = $eventsJson | ConvertFrom-Json
$heldKeys = [Collections.Generic.HashSet[int]]::new()
try {
  foreach ($event in $events) {
    if ([int]$event.delayMs -gt 0) {
      Start-Sleep -Milliseconds ([int]$event.delayMs)
    }
    $target.Refresh()
    if ($target.HasExited) {
      throw "Fortnite s'est fermé pendant l'interaction."
    }
    if (-not [ShenPulseFortniteInput]::IsForeground($window)) {
      if (-not [ShenPulseFortniteInput]::Activate($window)) {
        throw "Fortnite a perdu le premier plan ; l'interaction a été arrêtée."
      }
    }
    $keyCode = [int]$event.keyCode
    $keyUp = [bool]$event.keyUp
    [ShenPulseFortniteInput]::SendKey([System.UInt16]$keyCode, $keyUp)
    if ($keyUp) {
      [void]$heldKeys.Remove($keyCode)
    } else {
      [void]$heldKeys.Add($keyCode)
    }
  }
} finally {
  if ($heldKeys.Count -gt 0 -and -not $target.HasExited) {
    if (-not [ShenPulseFortniteInput]::IsForeground($window)) {
      [void][ShenPulseFortniteInput]::Activate($window)
    }
    foreach ($keyCode in @($heldKeys)) {
      [ShenPulseFortniteInput]::SendKey([System.UInt16]$keyCode, $true)
    }
  }
}

@{ ok = $true; processId = $target.Id; eventsSent = $events.Count } |
  ConvertTo-Json -Compress |
  Write-Output
`;

class WindowsInputService {
  constructor({ execute = executeWindowsInput } = {}) {
    this.execute = execute;
    this.queues = new Map();
  }

  async status(processName) {
    const normalizedProcess = normalizeProcessName(processName);
    return this.execute("status", normalizedProcess, []);
  }

  async play(processName, sequence, keyLayout = "wasd") {
    const normalizedProcess = normalizeProcessName(processName);
    const events = applyKeyboardLayout(
      normalizeWindowsInputSequence(sequence),
      keyLayout
    );
    const previous = this.queues.get(normalizedProcess) || Promise.resolve();
    const current = previous
      .catch(() => {})
      .then(() => this.execute("play", normalizedProcess, events));
    this.queues.set(normalizedProcess, current);
    try {
      return await current;
    } finally {
      if (this.queues.get(normalizedProcess) === current) {
        this.queues.delete(normalizedProcess);
      }
    }
  }
}

function applyKeyboardLayout(events, keyLayout) {
  if (String(keyLayout || "").toLowerCase() !== "azerty") return events;
  const azertyMovementKeys = new Map([
    [87, 90],
    [65, 81]
  ]);
  return events.map((event) => ({
    ...event,
    keyCode: azertyMovementKeys.get(event.keyCode) || event.keyCode
  }));
}

function normalizeProcessName(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\.exe$/i, "");
  if (!normalized || !/^[a-z0-9_.-]+$/i.test(normalized)) {
    throw new Error("Le processus Windows ciblé est invalide.");
  }
  return normalized;
}

function normalizeWindowsInputSequence(sequence) {
  const source = String(sequence || "").trim();
  if (!source) throw new Error("La séquence clavier est vide.");
  const events = source.split(";").map((rawEvent, index) => {
    const [kind, rawDelay, rawKeyCode, rawState, ...extra] = rawEvent.split(",");
    const delayMs = Number(rawDelay);
    const keyCode = Number(rawKeyCode);
    const state = Number(rawState);
    if (
      kind !== "k" ||
      extra.length ||
      !Number.isInteger(delayMs) ||
      delayMs < 0 ||
      delayMs > 15_000 ||
      !Number.isInteger(keyCode) ||
      keyCode < 1 ||
      keyCode > 254 ||
      ![0, 1].includes(state)
    ) {
      throw new Error(`Événement clavier invalide à la position ${index + 1}.`);
    }
    return { delayMs, keyCode, keyUp: state === 1 };
  });
  if (events.length > MAX_EVENTS) {
    throw new Error("La séquence clavier contient trop d’événements.");
  }
  if (events.reduce((total, event) => total + event.delayMs, 0) > MAX_SEQUENCE_MS) {
    throw new Error("La séquence clavier est trop longue.");
  }
  return events;
}

function executeWindowsInput(operation, processName, events) {
  const encodedEvents = Buffer.from(JSON.stringify(events), "utf8").toString(
    "base64"
  );
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_INPUT_SCRIPT
      ],
      {
        env: {
          ...process.env,
          SHENPULSE_INPUT_OPERATION: operation,
          SHENPULSE_INPUT_PROCESS: processName,
          SHENPULSE_INPUT_EVENTS: encodedEvents
        },
        windowsHide: true,
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
      if (code !== 0) {
        const errorMessage = stderr
          .trim()
          .split(/\r?\n/)
          .find(Boolean);
        reject(
          new Error(
            errorMessage ||
              "La séquence clavier Fortnite n’a pas pu être envoyée."
          )
        );
        return;
      }
      const output = stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .at(-1);
      try {
        resolve(output ? JSON.parse(output) : { ok: true });
      } catch {
        reject(new Error("Réponse Windows invalide après l’interaction Fortnite."));
      }
    });
  });
}

module.exports = {
  WindowsInputService,
  applyKeyboardLayout,
  executeWindowsInput,
  normalizeProcessName,
  normalizeWindowsInputSequence
};
