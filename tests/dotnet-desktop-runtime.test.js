"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  installDotNetDesktopRuntime,
  isDotNetDesktopRuntimeInstalled,
  waitForDotNetDesktopRuntime
} = require("../src/main/dotnet-desktop-runtime");

test("détecte le runtime .NET demandé dans une installation Windows", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-dotnet-"));
  try {
    fs.mkdirSync(
      path.join(root, "shared", "Microsoft.NETCore.App", "8.0.31"),
      { recursive: true }
    );
    assert.equal(
      await isDotNetDesktopRuntimeInstalled(8, { roots: [root] }),
      true
    );
    assert.equal(
      await isDotNetDesktopRuntimeInstalled(7, { roots: [root] }),
      false
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("installe silencieusement le runtime officiel et accepte le redémarrage Windows", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-dotnet-"));
  const installer = path.join(root, "runtime.exe");
  fs.writeFileSync(installer, "test");
  try {
    const result = await installDotNetDesktopRuntime(installer, {
      platform: "win32",
      major: 8,
      roots: [root],
      runInstaller: async (_file, args) => {
        assert.deepEqual(args, ["/install", "/quiet", "/norestart"]);
        fs.mkdirSync(
          path.join(root, "shared", "Microsoft.WindowsDesktop.App", "8.0.31"),
          { recursive: true }
        );
        return 3010;
      }
    });
    assert.deepEqual(result, {
      installed: true,
      major: 8,
      restartRequired: true
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("refuse un échec de l’installateur .NET", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-dotnet-"));
  const installer = path.join(root, "runtime.exe");
  fs.writeFileSync(installer, "test");
  try {
    await assert.rejects(
      installDotNetDesktopRuntime(installer, {
        platform: "win32",
        major: 8,
        roots: [root],
        runInstaller: async () => 1603
      }),
      /code 1603/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("attend la fin d’un installateur .NET qui rend la main trop tôt", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-dotnet-"));
  try {
    setTimeout(() => {
      fs.mkdirSync(
        path.join(root, "shared", "Microsoft.WindowsDesktop.App", "8.0.31"),
        { recursive: true }
      );
    }, 20);
    assert.equal(
      await waitForDotNetDesktopRuntime(8, {
        roots: [root],
        timeoutMs: 500,
        pollIntervalMs: 10
      }),
      true
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
