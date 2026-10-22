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
$KeyboardInputMode = [string]$env:SHENPULSE_INPUT_KEYBOARD_MODE
$ErrorActionPreference = 'Stop'

$targets = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
if ($targets.Count -eq 0) {
  # Certaines éditions GDK sont absentes de la recherche Get-Process par nom.
  $taskExeName = $ProcessName + '.exe'
  $targets = @(Get-CimInstance Win32_Process -Filter "Name = '$taskExeName'" -ErrorAction SilentlyContinue | ForEach-Object {
    try { [Diagnostics.Process]::GetProcessById([int]$_.ProcessId) } catch { }
  })
}
if ($targets.Count -eq 0) {
  throw "$ProcessName n'est pas ouvert."
}

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

public static class ShenPulseGameInput {
  private const uint INPUT_MOUSE = 0;
  private const uint INPUT_KEYBOARD = 1;
  private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
  private const uint KEYEVENTF_KEYUP = 0x0002;
  private const uint KEYEVENTF_SCANCODE = 0x0008;
  private const uint MAPVK_VK_TO_VSC_EX = 4;
  private const uint GW_OWNER = 4;
  private const uint SWP_NOSIZE = 0x0001;
  private const uint SWP_NOMOVE = 0x0002;
  private const uint SWP_SHOWWINDOW = 0x0040;
  private const uint MOUSEEVENTF_MOVE = 0x0001;
  private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  private const uint MOUSEEVENTF_LEFTUP = 0x0004;
  private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
  private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
  private const int SW_RESTORE = 9;
  private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

  private delegate bool EnumWindowsCallback(IntPtr window, IntPtr state);

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
  private static extern bool EnumWindows(
    EnumWindowsCallback callback,
    IntPtr state
  );

  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr window);

  [DllImport("user32.dll")]
  private static extern IntPtr GetWindow(IntPtr window, uint command);

  [DllImport("user32.dll")]
  private static extern IntPtr SetActiveWindow(IntPtr window);

  [DllImport("user32.dll")]
  private static extern IntPtr SetFocus(IntPtr window);

  [DllImport("user32.dll")]
  private static extern bool SetWindowPos(
    IntPtr window,
    IntPtr insertAfter,
    int x,
    int y,
    int width,
    int height,
    uint flags
  );

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(
    IntPtr window,
    IntPtr processId
  );

  [DllImport("user32.dll", EntryPoint = "GetWindowThreadProcessId")]
  private static extern uint GetWindowThreadProcessIdWithOwner(
    IntPtr window,
    out uint processId
  );

  [DllImport("user32.dll")]
  private static extern IntPtr GetKeyboardLayout(uint threadId);

  [DllImport("user32.dll")]
  private static extern uint MapVirtualKeyEx(
    uint code,
    uint mapType,
    IntPtr keyboardLayout
  );

  [DllImport("kernel32.dll")]
  private static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  private static extern bool AttachThreadInput(
    uint idAttach,
    uint idAttachTo,
    bool attach
  );

  public static IntPtr FindWindowForProcess(uint processId) {
    IntPtr visibleWindow = IntPtr.Zero;
    IntPtr fallbackWindow = IntPtr.Zero;
    EnumWindows(delegate(IntPtr candidate, IntPtr state) {
      uint ownerProcessId;
      GetWindowThreadProcessIdWithOwner(candidate, out ownerProcessId);
      if (ownerProcessId != processId) return true;
      if (GetWindow(candidate, GW_OWNER) != IntPtr.Zero) return true;
      if (fallbackWindow == IntPtr.Zero) fallbackWindow = candidate;
      if (IsWindowVisible(candidate)) {
        visibleWindow = candidate;
        return false;
      }
      return true;
    }, IntPtr.Zero);
    return visibleWindow != IntPtr.Zero ? visibleWindow : fallbackWindow;
  }

  public static bool Activate(IntPtr window) {
    for (int attempt = 0; attempt < 20; attempt++) {
      if (GetForegroundWindow() == window) return true;
      ShowWindowAsync(window, SW_RESTORE);
      IntPtr foreground = GetForegroundWindow();
      uint currentThread = GetCurrentThreadId();
      uint targetThread = GetWindowThreadProcessId(window, IntPtr.Zero);
      uint foregroundThread = foreground == IntPtr.Zero
        ? 0
        : GetWindowThreadProcessId(foreground, IntPtr.Zero);
      bool attachedForeground =
        foregroundThread != 0 && foregroundThread != currentThread &&
        AttachThreadInput(currentThread, foregroundThread, true);
      bool attachedTarget =
        targetThread != 0 && targetThread != currentThread &&
        AttachThreadInput(currentThread, targetThread, true);
      try {
        BringWindowToTop(window);
        SetWindowPos(
          window,
          HWND_TOPMOST,
          0,
          0,
          0,
          0,
          SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW
        );
        SetWindowPos(
          window,
          HWND_NOTOPMOST,
          0,
          0,
          0,
          0,
          SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW
        );
        SetForegroundWindow(window);
        SetActiveWindow(window);
        SetFocus(window);
      } finally {
        if (attachedTarget) {
          AttachThreadInput(currentThread, targetThread, false);
        }
        if (attachedForeground) {
          AttachThreadInput(currentThread, foregroundThread, false);
        }
      }
      Thread.Sleep(75);
    }
    return GetForegroundWindow() == window;
  }

  public static bool IsForeground(IntPtr window) {
    return GetForegroundWindow() == window;
  }

  public static void SendKey(
    IntPtr window,
    ushort virtualKey,
    bool keyUp,
    bool useScanCode,
    bool sendVirtualFallback
  ) {
    if (useScanCode) {
      SendSingleKey(window, virtualKey, keyUp, true);
      if (sendVirtualFallback) {
        SendSingleKey(window, virtualKey, keyUp, false);
      }
      return;
    }
    SendSingleKey(window, virtualKey, keyUp, false);
  }

  private static void SendSingleKey(
    IntPtr window,
    ushort virtualKey,
    bool keyUp,
    bool useScanCode
  ) {
    INPUT input = new INPUT();
    input.type = INPUT_KEYBOARD;
    uint flags = keyUp ? KEYEVENTF_KEYUP : 0;
    if (useScanCode) {
      uint targetThread = GetWindowThreadProcessId(window, IntPtr.Zero);
      IntPtr keyboardLayout = GetKeyboardLayout(targetThread);
      uint mappedScanCode = MapVirtualKeyEx(
        virtualKey,
        MAPVK_VK_TO_VSC_EX,
        keyboardLayout
      );
      if (mappedScanCode == 0) {
        throw new InvalidOperationException(
          "La touche physique demandée est introuvable."
        );
      }
      input.U.ki.wVk = 0;
      input.U.ki.wScan = (ushort)(mappedScanCode & 0xFF);
      flags |= KEYEVENTF_SCANCODE;
      if ((mappedScanCode & 0xFF00) != 0) {
        flags |= KEYEVENTF_EXTENDEDKEY;
      }
    } else {
      input.U.ki.wVk = virtualKey;
      input.U.ki.wScan = 0;
    }
    input.U.ki.dwFlags = flags;
    input.U.ki.time = 0;
    input.U.ki.dwExtraInfo = UIntPtr.Zero;
    uint sent = SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT)));
    if (sent != 1) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
  }

  public static void SendMouseButton(int button, bool buttonUp) {
    SendMouse(0, 0, MouseButtonFlags(button, buttonUp));
  }

  public static uint MouseButtonFlags(int button, bool buttonUp) {
    uint flags;
    switch (button) {
      case 0:
        flags = buttonUp ? MOUSEEVENTF_LEFTUP : MOUSEEVENTF_LEFTDOWN;
        break;
      case 1:
        flags = buttonUp ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_RIGHTDOWN;
        break;
      case 2:
        flags = buttonUp ? MOUSEEVENTF_MIDDLEUP : MOUSEEVENTF_MIDDLEDOWN;
        break;
      default:
        throw new ArgumentOutOfRangeException("button");
    }
    return flags;
  }

  public static void SendMouseMove(int dx, int dy) {
    SendMouse(dx, dy, MOUSEEVENTF_MOVE);
  }

  private static void SendMouse(int dx, int dy, uint flags) {
    INPUT input = new INPUT();
    input.type = INPUT_MOUSE;
    input.U.mi.dx = dx;
    input.U.mi.dy = dy;
    input.U.mi.mouseData = 0;
    input.U.mi.dwFlags = flags;
    input.U.mi.time = 0;
    input.U.mi.dwExtraInfo = UIntPtr.Zero;
    uint sent = SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT)));
    if (sent != 1) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
  }
}
'@

$target = $null
$window = [IntPtr]::Zero
$windowDeadline = [DateTime]::UtcNow.AddSeconds(4)
do {
  foreach ($candidate in $targets) {
    if ($candidate.HasExited) { continue }
    $candidate.Refresh()
    $candidateWindow = [IntPtr]$candidate.MainWindowHandle
    if ($candidateWindow -eq [IntPtr]::Zero) {
      $candidateWindow = [ShenPulseGameInput]::FindWindowForProcess(
        [uint32]$candidate.Id
      )
    }
    if ($candidateWindow -ne [IntPtr]::Zero) {
      $target = $candidate
      $window = $candidateWindow
      break
    }
  }
  if ($window -eq [IntPtr]::Zero) {
    Start-Sleep -Milliseconds 100
    $targets = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
  }
} while (
  $window -eq [IntPtr]::Zero -and
  [DateTime]::UtcNow -lt $windowDeadline
)

if (-not $target -or $window -eq [IntPtr]::Zero) {
  throw "$ProcessName est ouvert, mais sa fenêtre de jeu n'est pas encore prête."
}

if ($Operation -eq 'status') {
  @{ ok = $true; processId = $target.Id; processName = $target.ProcessName } |
    ConvertTo-Json -Compress |
    Write-Output
  exit 0
}

if (-not [ShenPulseGameInput]::Activate($window)) {
  throw "Windows n'a pas pu placer $ProcessName au premier plan."
}
Start-Sleep -Milliseconds 120

if ($Operation -eq 'activate') {
  @{ ok = $true; processId = $target.Id; processName = $target.ProcessName } |
    ConvertTo-Json -Compress |
    Write-Output
  exit 0
}

$eventsJson = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String($EncodedEvents)
)
$events = $eventsJson | ConvertFrom-Json
$useScanCodes = @('scan-code', 'hybrid') -contains $KeyboardInputMode
$sendVirtualFallback = $KeyboardInputMode -eq 'hybrid'
$heldKeys = [Collections.Generic.HashSet[int]]::new()
$heldMouseButtons = [Collections.Generic.HashSet[int]]::new()
try {
  foreach ($event in $events) {
    $delayMs = [int]$event.delayMs
    if (
      $sendVirtualFallback -and
      [string]$event.kind -eq 'keyboard' -and
      [string]$event.action -eq 'up' -and
      $delayMs -gt 0 -and
      $delayMs -lt 80
    ) {
      $delayMs = 80
    }
    if ($delayMs -gt 0) {
      Start-Sleep -Milliseconds $delayMs
    }
    $target.Refresh()
    if ($target.HasExited) {
      throw "$ProcessName s'est fermé pendant l'interaction."
    }
    if (-not [ShenPulseGameInput]::IsForeground($window)) {
      if (-not [ShenPulseGameInput]::Activate($window)) {
        throw "$ProcessName a perdu le premier plan ; l'interaction a été arrêtée."
      }
    }
    if ([string]$event.kind -eq 'keyboard') {
      $keyCode = [int]$event.keyCode
      $action = [string]$event.action
      if ($action -eq 'press') {
        [ShenPulseGameInput]::SendKey($window, [System.UInt16]$keyCode, $false, $useScanCodes, $sendVirtualFallback)
        Start-Sleep -Milliseconds 40
        [ShenPulseGameInput]::SendKey($window, [System.UInt16]$keyCode, $true, $useScanCodes, $sendVirtualFallback)
      } else {
        $keyUp = $action -eq 'up'
        [ShenPulseGameInput]::SendKey($window, [System.UInt16]$keyCode, $keyUp, $useScanCodes, $sendVirtualFallback)
        if ($keyUp) {
          [void]$heldKeys.Remove($keyCode)
        } else {
          [void]$heldKeys.Add($keyCode)
        }
      }
    } elseif ([string]$event.kind -eq 'mouse-button') {
      $button = [int]$event.button
      $action = [string]$event.action
      if ($action -eq 'press') {
        [ShenPulseGameInput]::SendMouseButton($button, $false)
        Start-Sleep -Milliseconds 40
        [ShenPulseGameInput]::SendMouseButton($button, $true)
      } else {
        $buttonUp = $action -eq 'up'
        [ShenPulseGameInput]::SendMouseButton($button, $buttonUp)
        if ($buttonUp) {
          [void]$heldMouseButtons.Remove($button)
        } else {
          [void]$heldMouseButtons.Add($button)
        }
      }
    } elseif ([string]$event.kind -eq 'mouse-move') {
      [ShenPulseGameInput]::SendMouseMove([int]$event.dx, [int]$event.dy)
    }
  }
} finally {
  if (($heldKeys.Count -gt 0 -or $heldMouseButtons.Count -gt 0) -and -not $target.HasExited) {
    if (-not [ShenPulseGameInput]::IsForeground($window)) {
      [void][ShenPulseGameInput]::Activate($window)
    }
    foreach ($keyCode in @($heldKeys)) {
      [ShenPulseGameInput]::SendKey($window, [System.UInt16]$keyCode, $true, $useScanCodes, $sendVirtualFallback)
    }
    foreach ($button in @($heldMouseButtons)) {
      [ShenPulseGameInput]::SendMouseButton([int]$button, $true)
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

  async activate(processName, { assertAccess = () => {} } = {}) {
    const normalizedProcess = normalizeProcessName(processName);
    assertAccess();
    return this.#enqueue(normalizedProcess, () => {
      assertAccess();
      return this.execute("activate", normalizedProcess, []);
    });
  }

  async play(
    processName,
    sequence,
    keyLayout = "wasd",
    keyboardInputMode = "virtual-key",
    { assertAccess = () => {} } = {}
  ) {
    const normalizedProcess = normalizeProcessName(processName);
    const events = applyKeyboardLayout(
      normalizeWindowsInputSequence(sequence),
      keyLayout
    );
    assertAccess();
    return this.#enqueue(normalizedProcess, () => {
      assertAccess();
      return this.execute(
        "play",
        normalizedProcess,
        events,
        normalizeKeyboardInputMode(keyboardInputMode)
      );
    });
  }

  async #enqueue(normalizedProcess, operation) {
    const previous = this.queues.get(normalizedProcess) || Promise.resolve();
    const current = previous
      .catch(() => {})
      .then(operation);
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
  const layout = String(keyLayout || "").toLowerCase();
  if (!["azerty", "zsqd"].includes(layout)) return events;
  const azertyMovementKeys = new Map(layout === "zsqd"
    ? [[87, 90], [65, 83], [83, 81]]
    : [[87, 90], [65, 81]]);
  return events.map((event) =>
    event.kind === "keyboard"
      ? {
          ...event,
          keyCode: azertyMovementKeys.get(event.keyCode) || event.keyCode
        }
      : event
  );
}

function normalizeProcessName(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\.exe$/i, "");
  if (!normalized || !/^[a-z0-9_][a-z0-9_. -]{0,119}$/i.test(normalized)) {
    throw new Error("Le processus Windows ciblé est invalide.");
  }
  return normalized;
}

function normalizeKeyboardInputMode(value) {
  const normalized = String(value || "").toLowerCase();
  return ["scan-code", "hybrid"].includes(normalized)
    ? normalized
    : "virtual-key";
}

function normalizeWindowsInputSequence(sequence) {
  const source = String(sequence || "").trim();
  if (!source) throw new Error("La séquence d’entrée est vide.");
  const events = source.split(";").map((rawEvent, index) => {
    const [kind, rawDelay, rawValueA, rawValueB, ...extra] = rawEvent.split(",");
    const delayMs = Number(rawDelay);
    const valueA = Number(rawValueA);
    const valueB = Number(rawValueB);
    const invalid = () => {
      throw new Error(`Événement d’entrée invalide à la position ${index + 1}.`);
    };
    if (
      extra.length ||
      !Number.isInteger(delayMs) ||
      delayMs < 0 ||
      delayMs > 15_000
    ) {
      invalid();
    }
    if (kind === "k") {
      if (
        !Number.isInteger(valueA) ||
        valueA < 1 ||
        valueA > 254 ||
        ![0, 1, 2].includes(valueB)
      ) {
        invalid();
      }
      return {
        kind: "keyboard",
        delayMs,
        keyCode: valueA,
        action: ["down", "up", "press"][valueB]
      };
    }
    if (kind === "b") {
      if (![0, 1, 2].includes(valueA) || ![0, 1, 2].includes(valueB)) {
        invalid();
      }
      return {
        kind: "mouse-button",
        delayMs,
        button: valueA,
        action: ["down", "up", "press"][valueB]
      };
    }
    if (kind === "r") {
      if (
        !Number.isInteger(valueA) ||
        !Number.isInteger(valueB) ||
        Math.abs(valueA) > 2000 ||
        Math.abs(valueB) > 2000
      ) {
        invalid();
      }
      return { kind: "mouse-move", delayMs, dx: valueA, dy: valueB };
    }
    invalid();
  });
  if (events.length > MAX_EVENTS) {
    throw new Error("La séquence d’entrée contient trop d’événements.");
  }
  if (events.reduce((total, event) => total + event.delayMs, 0) > MAX_SEQUENCE_MS) {
    throw new Error("La séquence d’entrée est trop longue.");
  }
  return events;
}

function executeWindowsInput(
  operation,
  processName,
  events,
  keyboardInputMode = "virtual-key"
) {
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
          SHENPULSE_INPUT_EVENTS: encodedEvents,
          SHENPULSE_INPUT_KEYBOARD_MODE:
            normalizeKeyboardInputMode(keyboardInputMode)
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
              `La séquence d’entrée n’a pas pu être envoyée à ${processName}.`
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
        reject(new Error("Réponse Windows invalide après l’interaction de jeu."));
      }
    });
  });
}

module.exports = {
  WindowsInputService,
  applyKeyboardLayout,
  executeWindowsInput,
  normalizeKeyboardInputMode,
  normalizeProcessName,
  normalizeWindowsInputSequence
};
