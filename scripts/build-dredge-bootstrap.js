"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-dredge-bootstrap-"));
const output = path.join(temporary, "BepInEx.Bootstrap.dll");
try {
  const csc = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET/Framework64/v4.0.30319/csc.exe");
  execFileSync(csc, ["/nologo", "/target:library", "/optimize+", `/out:${output}`, path.join(root, "native/dredge/Bootstrap.cs")], { windowsHide: true, stdio: "pipe" });
  const destination = path.join(root, ".artifacts/game-pack-builds/dredge/1.0.0/BepInEx.Bootstrap.dll");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(output, destination);
  console.log("Bootstrap DREDGE compilé.");
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
