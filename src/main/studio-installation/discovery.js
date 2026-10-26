"use strict";
const fs = require("node:fs"), path = require("node:path"), { execFile } = require("node:child_process");
const { promisify } = require("node:util"); const run = promisify(execFile);
const DEFINITIONS = [
  { id: "tiktok", name: "TikTok LIVE Studio", process: "TikTok LIVE Studio.exe", root: "TikTok LIVE Studio" },
  { id: "obs", name: "OBS Studio", process: "obs64.exe", root: "obs-studio" },
  { id: "streamlabs", name: "Streamlabs Desktop", process: "Streamlabs OBS.exe", root: "slobs-client" }
];
function exists(file) { try { return fs.statSync(file).isFile(); } catch { return false; } }
async function running(processName, platform = process.platform) {
  if (platform !== "win32") return false;
  const { stdout } = await run("tasklist.exe", ["/FI", "IMAGENAME eq " + processName, "/FO", "CSV", "/NH"], { windowsHide: true, timeout: 6000 });
  return stdout.toLowerCase().includes('"' + processName.toLowerCase() + '",');
}
function discover(env = process.env) {
  const roots = [env.ProgramW6432, env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA].filter(Boolean);
  return DEFINITIONS.map(def => {
    const candidates = [];
    for (const root of roots) {
      if (def.id === "tiktok") {
        const base = path.join(root, "TikTok LIVE Studio"); candidates.push(path.join(base, def.process));
        try { for (const entry of fs.readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory() && /^\d+\./.test(e.name)).sort((a,b) => b.name.localeCompare(a.name, undefined, { numeric: true }))) candidates.push(path.join(base, entry.name, def.process)); } catch { /* Absent installation. */ }
      } else if (def.id === "obs") candidates.push(path.join(root, "obs-studio", "bin", "64bit", def.process));
      else for (const dir of ["Streamlabs OBS", "Streamlabs Desktop", "slobs-client"]) candidates.push(path.join(root, dir, def.process));
    }
    const executable = candidates.find(exists) || "";
    return { ...def, executable, installed: Boolean(executable), configRoot: path.join(env.APPDATA || "", def.root) };
  });
}
async function discoverInstalled() {
  const rows=discover(); if(process.platform!=="win32")return rows;
  const script=String.raw`[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $roots=@('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'); @(Get-ItemProperty -Path $roots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'TikTok.*LIVE.*Studio|OBS Studio|Streamlabs' } | Select-Object DisplayName,InstallLocation,DisplayIcon) | ConvertTo-Json -Compress`;
  try {
    const {stdout}=await run("powershell.exe",["-NoProfile","-NonInteractive","-Command",script],{windowsHide:true,timeout:8000});
    const values=JSON.parse(stdout||"[]");
    for(const record of Array.isArray(values)?values:[values]){
      const id=/Streamlabs/i.test(record.DisplayName)?"streamlabs":/TikTok/i.test(record.DisplayName)?"tiktok":"obs";
      const target=rows.find(s=>s.id===id); if(!target||target.installed)continue;
      const root=String(record.InstallLocation||"").replace(/^"|"$/g,"");
      const icon=String(record.DisplayIcon||"").match(/^"([^"]+)"|^(.+?\.exe)/i);const iconPath=icon?.[1]||icon?.[2]||"";
      const candidates=[path.join(root,target.process),path.join(root,"bin","64bit",target.process)];
      if(path.basename(iconPath).toLowerCase()===target.process.toLowerCase())candidates.push(iconPath);
      if(id==="tiktok")try{for(const name of fs.readdirSync(root).filter(n=>/^\d+\./.test(n)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})))candidates.push(path.join(root,name,target.process));}catch{/* No version directory. */}
      const executable=candidates.find(exists);if(executable){target.executable=executable;target.installed=true;}
    }
  }catch{/* Standard installation paths remain available if the registry cannot be read. */}
  return rows;
}
module.exports = { discover, discoverInstalled, running, DEFINITIONS };
