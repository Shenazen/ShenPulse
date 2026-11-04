"use strict";

/** Publication limitée au rendu des alertes ; préserve tous les autres assets LIVE. */
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), zlib = require("node:zlib");
const presentationOnly = process.argv.includes("--presentation-only"), copyFitOnly = process.argv.includes("--copy-fit-only");
const files = copyFitOnly ? ["/game-pack.html", "/runtime/game-pack.js"] : presentationOnly ? ["/game-pack-layout.js", "/game-pack.html", "/game-wins.html", "/runtime/game-pack.js", "/runtime/game-wins.js"] : ["/index.html", "/runtime/loader.js", "/runtime/alerts-feed.js", "/runtime/transport.js", "/styles/core.css", "/runtime-version.json", "/overlay-catalog.js", "/game-pack-layout.js", "/game-pack.html", "/game-wins.html", "/runtime/game-pack.js", "/runtime/game-wins.js", "/styles/game-pack.css", "/styles/game-wins.css"];
const site = "shenpulse-overlays", base = "https://firebasehosting.googleapis.com/v1beta1/";
async function main() {
  const auth = require(path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib/auth.js"));
  const account = auth.getProjectDefaultAccount(process.cwd());
  if (!account?.tokens?.refresh_token) throw new Error("Connexion Firebase CLI requise.");
  const access = await auth.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]);
  if (!access.access_token) throw new Error("Accès Firebase indisponible.");
  const headers = { Authorization: `Bearer ${access.access_token}` };
  async function api(resource, method = "GET", body) {
    const response = await fetch(base + resource, { method, headers: { ...headers, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(`Hosting ${response.status} : ${result.error?.message || "échec"}`);
    return result;
  }
  const channelPath = `projects/-/sites/${site}/channels/live`;
  const channel = await api(channelPath), source = channel.release?.version?.name;
  if (!source) throw new Error("Version LIVE introuvable.");
  const current = await api(source), existing = {};
  let page = "";
  do {
    const listing = await api(`${source}/files?pageSize=1000${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`);
    for (const file of listing.files || []) existing[file.path] = file.hash;
    page = listing.nextPageToken || "";
  } while (page);
  const hashes = { ...existing }, uploads = new Map();
  for (const file of files) {
    const bytes = zlib.gzipSync(fs.readFileSync(path.join("resources/overlays", file.slice(1))), { level: 9 });
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    hashes[file] = hash; uploads.set(hash, bytes);
  }
  if (!process.argv.includes("--publish")) return console.log(JSON.stringify({ site, source, updatedFiles: files, preservedFiles: Object.keys(existing).filter(file => !files.includes(file)).length }));
  const previousRuntime = await fetch(`https://${site}.web.app/runtime-version.json?verify=${Date.now()}`).then(response => response.json());
  if (!["2.1.3-alert-text1", "2.1.3-action-style1", "2.1.3-viewer-layout1", "2.1.3-viewer-layout2", "2.1.3-viewer-style3"].includes(previousRuntime.version)) throw new Error("Le runtime public a évolué : vérifier avant de publier.");
  const version = await api(`projects/-/sites/${site}/versions`, "POST", { config: current.config || {} });
  const entries = Object.entries(hashes);
  for (let offset = 0; offset < entries.length; offset += 1000) {
    const needed = await api(`${version.name}:populateFiles`, "POST", { files: Object.fromEntries(entries.slice(offset, offset + 1000)) });
    for (const hash of needed.uploadRequiredHashes || []) {
      const bytes = uploads.get(hash);
      if (!bytes) throw new Error("Un asset LIVE préservé manque dans le stockage.");
      const response = await fetch(`${needed.uploadUrl}/${hash}`, { method: "POST", headers: { ...headers, "Content-Type": "application/octet-stream" }, body: bytes });
      if (!response.ok) throw new Error(`Upload Hosting ${response.status}`);
    }
  }
  await api(`${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  const latest = await api(channelPath);
  if (latest.release?.version?.name !== source) throw new Error("La version LIVE a changé pendant la préparation ; publication annulée.");
  const release = await api(`${channelPath}/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: copyFitOnly ? "Cadrage des cartes dans le lien manuel des interactions" : presentationOnly ? "Aperçu privé des réglages de présentation dans la popup du jeu" : "Réglages de taille du texte et de contour des alertes viewer" });
  const verified = [];
  for (const file of files) {
    const response = await fetch(`https://${site}.web.app${file}?verify=${Date.now()}`);
    if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(fs.readFileSync(path.join("resources/overlays", file.slice(1))))) throw new Error(`Vérification publique impossible : ${file}`);
    verified.push(file);
  }
  const report = { source, version: version.name, release: release.name, verified, preservedFiles: Object.keys(existing).filter(file => !files.includes(file)).length };
  fs.mkdirSync(".artifacts/viewer-layout-release", { recursive: true });
  fs.writeFileSync(copyFitOnly ? ".artifacts/viewer-layout-release/copy-fit-hosting.json" : presentationOnly ? ".artifacts/viewer-layout-release/presentation-hosting.json" : ".artifacts/viewer-layout-release/hosting.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
