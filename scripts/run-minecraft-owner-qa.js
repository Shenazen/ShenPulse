"use strict";

// Serveur d'essai isolé et contrôlable uniquement sur la boucle locale.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const root = path.join(__dirname, "..");
const qa = path.join(root, ".artifacts/minecraft-owner-20261103");
const mineflayer = require(path.join(qa, "harness/node_modules/mineflayer"));
const mode = process.argv.includes("--box") ? "minecraft-box-cyber" : "minecraft-diamond-rush";
const port = mode.endsWith("box-cyber") ? 25687 : 25686;
const directory = path.join(qa, "servers", mode);
const log = fs.createWriteStream(path.join(qa, `${mode}-server.log`), { flags: "a" });
const server = spawn("C:/Program Files/Amazon Corretto/jdk21.0.8_9/bin/java.exe", ["-Xms512M", "-Xmx1536M", "-jar", "paper.jar", "nogui"], { cwd: directory, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
let tail = "", ready = false, bot = null;
const pending = [];
function command(value) { server.stdin.write(String(value).replace(/[\r\n]/g, " ").slice(0, 2000) + "\n"); }
function snapshot() {
  return new Promise((resolve, reject) => {
    const entry = { resolve, reject, timer: setTimeout(() => { pending.splice(pending.indexOf(entry), 1); reject(new Error("La sonde ne répond pas")); }, 10000) };
    pending.push(entry); command("shenpulseqa");
  });
}
function receive(data) {
  log.write(data); tail += String(data);
  const lines = tail.split(/\r?\n/); tail = lines.pop();
  for (const line of lines) {
    if (/Done \(.+\)! For help/.test(line)) ready = true;
    const match = line.match(/SHENPULSE_QA (\{.+\})/);
    if (match) { const entry = pending.shift(); if (entry) { clearTimeout(entry.timer); entry.resolve(JSON.parse(match[1])); } }
    if (/SHENPULSE_QA_ERROR|Error occurred while enabling|Could not load/.test(line)) process.stderr.write(line + "\n");
  }
}
server.stdout.on("data", receive); server.stderr.on("data", receive);
server.on("error", (error) => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
server.on("close", () => { log.end(); if (bot) bot.quit(); api.close(); setTimeout(() => process.exit(process.exitCode || 0), 300).unref(); });
const api = http.createServer(async (request, response) => {
  try {
    let result;
    if (request.url === "/state") result = { mode, port, ready, bot: Boolean(bot?.entity) };
    else if (request.url === "/snapshot") result = await snapshot();
    else if (request.method === "POST" && request.url === "/command") {
      let body = ""; for await (const chunk of request) { body += chunk; if (body.length > 4096) throw new Error("Commande trop longue"); }
      const incoming = JSON.parse(body); command(incoming.command); result = { sent: true };
    } else if (request.method === "POST" && request.url === "/dig") {
      const { Vec3 } = require(path.join(qa, "harness/node_modules/vec3"));
      const target = bot.blockAt(new Vec3(3, 31, 0));
      if (!target) throw new Error("Bloc inaccessible");
      await bot.dig(target, true); result = { dug: true, block: target.name };
    } else if (request.method === "POST" && request.url === "/walk") {
      bot.setControlState("forward",true); await new Promise(resolve=>setTimeout(resolve,300)); bot.setControlState("forward",false); result={walked:true};
    } else if (request.method === "POST" && request.url === "/rejoin") {
      const guest=mineflayer.createBot({host:"127.0.0.1",port,username:"ShenPulseGuest",auth:"offline",version:"1.20.4",hideErrors:true});
      guest.on("error",()=>{}); await once(guest,"spawn"); await new Promise(resolve=>setTimeout(resolve,1500)); guest.quit(); result={joined:true};
    } else if (request.method === "POST" && request.url === "/stop") { command("stop"); result = { stopping: true }; }
    else { response.writeHead(404); response.end(); return; }
    response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(result));
  } catch (error) { response.writeHead(500, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: error.message })); }
});
api.listen(18686, "127.0.0.1");
async function start() {
  const deadline = Date.now() + 180000;
  while (!ready && server.exitCode === null && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
  if (!ready) throw new Error("Démarrage Minecraft non confirmé");
  bot = mineflayer.createBot({ host: "127.0.0.1", port, username: "ShenPulseQA", auth: "offline", version: "1.20.4", hideErrors: true });
  bot.on("error", (error) => process.stderr.write("Bot: " + error.message + "\n"));
  bot.on("kicked", (reason) => process.stderr.write("Bot refusé: " + JSON.stringify(reason) + "\n"));
  await Promise.race([once(bot, "spawn"), new Promise((_, reject) => setTimeout(() => reject(new Error("Le joueur d’essai ne rejoint pas")), 45000).unref())]);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  process.stdout.write(JSON.stringify({ mode, ready, snapshot: await snapshot() }) + "\n");
}
start().catch((error) => { process.stderr.write(error.stack + "\n"); command("stop"); process.exitCode = 1; });
