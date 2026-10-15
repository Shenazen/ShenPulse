"use strict";

/**
 * QA locale du site public avec le Chromium déjà fourni par Electron.
 * Usage : node scripts/verify-public-site.js (après npm --prefix website run build).
 * Aucun profil ShenPulse, service distant, fichier client ou installateur n'est
 * ouvert : seul website/dist est servi sur un port éphémère de 127.0.0.1.
 * Les captures et le rapport restent dans .artifacts/public-site-qa/<horodatage>.
 */
if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(require("electron"), [__filename, ...process.argv.slice(2)], { stdio: "inherit", env: environment, windowsHide: true });
  if (child.error) process.stderr.write(`${child.error.message}\n`);
  process.exit(child.status ?? 1);
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const projectRoot = path.resolve(__dirname, "..");
const dist = path.join(projectRoot, "website", "dist");
const artifactDirectory = path.join(projectRoot, ".artifacts", "public-site-qa", new Date().toISOString().replace(/[:.]/g, "-"));
const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-public-site-qa-"));
const canonicalOrigin = "https://www.shenpulse.leuridan.fr";
const viewports = [[1440, 1000], [1920, 1080], [1280, 900], [1024, 900], [768, 1024], [375, 812], [320, 740]];
const otherRoutes = ["/cgu", "/cgv", "/mentions-legales", "/confidentialite", "/cookies", "/login", "/setup", "/admin", "/app", "/page-inconnue-qa"];
const publicRoutes = new Set(["/", "/docs", ...otherRoutes]);
const report = { startedAt: new Date().toISOString(), dist, profileDirectory, viewports, checks: [], interactions: [], tour: [], docsRegressions: [], failures: [], consoleErrors: [], runtimeErrors: [], blockedRequests: [], failedRequests: [], downloads: [] };
const mimeTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".webmanifest": "application/manifest+json" };
let testWindow, server, localOrigin, currentStage = "initialisation";
const idsByRoute = new Map();
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
fs.mkdirSync(artifactDirectory, { recursive: true });
app.setPath("userData", path.join(profileDirectory, "chromium"));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.commandLine.appendSwitch("force-prefers-reduced-motion", "reduce");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1");
const deadline = setTimeout(() => finish(new Error(`Délai global dépassé : ${currentStage}`)), 240000);

function writeReport() {
  fs.writeFileSync(path.join(artifactDirectory, "report.json"), JSON.stringify(report, null, 2));
}

/** Serveur statique borné à dist, y compris après résolution des liens symboliques. */
function serve(request, response) {
  try {
    if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    if (pathname.includes("\0") || pathname.includes("\\") || pathname.startsWith("/downloads/")) { response.writeHead(403); response.end(); return; }
    let target = path.resolve(dist, `.${pathname}`);
    const inside = (candidate) => candidate === dist || candidate.startsWith(`${dist}${path.sep}`);
    if (!inside(target)) { response.writeHead(403); response.end(); return; }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
    if (!fs.existsSync(target)) {
      if (path.extname(pathname)) { response.writeHead(404); response.end(); return; }
      target = path.join(dist, "index.html");
    }
    target = fs.realpathSync(target);
    if (!inside(target) || !fs.statSync(target).isFile()) { response.writeHead(403); response.end(); return; }
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(target).pipe(response);
  } catch { response.writeHead(400); response.end(); }
}

async function evaluate(callback, ...parameters) {
  return testWindow.webContents.executeJavaScript(`(${callback.toString()})(...${JSON.stringify(parameters)})`, true);
}

async function waitUntil(callback, timeoutMs = 12000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await callback()) return;
    await delay(40);
  }
  throw new Error(`Condition non atteinte : ${currentStage}`);
}

async function settleImages() {
  return evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 3000))]);
    const images = [...document.images].filter((image) => image.getAttribute("src"));
    for (const image of images) image.loading = "eager";
    await Promise.all(images.map(async (image) => {
      try { await Promise.race([image.decode(), new Promise((resolve) => setTimeout(resolve, 5000))]); } catch { /* Le détail de l'image invalide est rapporté par inspect. */ }
    }));
    // Une capture prise pendant le délai d'entrée peut être vide malgré un
    // décodage correct. Termine seulement les animations finies de présentation.
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().iterations !== Infinity) {
        try { animation.finish(); } catch { /* Certaines transitions ont déjà disparu. */ }
      }
    }
    // Une fenêtre offscreen sans animation peut cesser de demander des frames.
    await Promise.race([new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))), new Promise((resolve) => setTimeout(resolve, 120))]);
    return images.length;
  });
}

async function load(route, width, height) {
  testWindow.setContentSize(width, height);
  await testWindow.loadURL(`${localOrigin}${route}`);
  await waitUntil(() => evaluate(() => Boolean(document.querySelector("#main h1"))));
  await settleImages();
  await evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

function inspect() {
  const box = (element) => element ? { x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height } : null;
  const images = [...document.images].filter((image) => image.getAttribute("src")).map((image) => ({
    src: new URL(image.currentSrc || image.src).pathname, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
    widthAttribute: Number(image.getAttribute("width")), heightAttribute: Number(image.getAttribute("height")), box: box(image), alt: image.alt
  }));
  const hero = document.querySelector(".hero");
  return { viewport: { width: innerWidth, height: innerHeight }, page: document.documentElement.dataset.page, title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.href, ogUrl: document.querySelector('meta[property="og:url"]')?.content,
    robots: document.querySelector('meta[name="robots"]')?.content, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    clientWidth: document.documentElement.clientWidth, bodyClientWidth: document.body.clientWidth, bodyWidth: document.body.getBoundingClientRect().width,
    bodyScrollWidth: document.body.scrollWidth,
    heroActions: document.querySelector(".hero-actions") ? { box: box(document.querySelector(".hero-actions")), clientWidth: document.querySelector(".hero-actions").clientWidth, scrollWidth: document.querySelector(".hero-actions").scrollWidth, buttons: [...document.querySelectorAll(".hero-actions .button")].map(box) } : null,
    h1: box(document.querySelector("#main h1")), heroVisual: box(document.querySelector(".hero-visual")),
    heroColumns: hero ? getComputedStyle(hero).gridTemplateColumns.split(" ").length : 0,
    ids: [...document.querySelectorAll("[id]")].map((element) => element.id),
    links: [...document.querySelectorAll("a[href]")].filter((link) => !link.hasAttribute("download")).map((link) => ({ href: link.getAttribute("href"), local: link.origin === location.origin, pathname: link.pathname, hash: link.hash })),
    overflowElements: [...document.querySelectorAll("body *")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1) && getComputedStyle(element).position !== "fixed";
    }).slice(0, 12).map((element) => ({ tag: element.tagName, id: element.id, className: String(element.className).slice(0, 120), box: box(element) })),
    images, runtimeErrors: globalThis.publicSiteQaErrors || [] };
}

async function checkpoint(name, route, expectedPage, { top = true } = {}) {
  await settleImages();
  const metrics = await evaluate(inspect);
  idsByRoute.set(route.split(/[?#]/)[0], metrics.ids);
  const checks = [];
  const check = (condition, message) => { if (!condition) checks.push(message); };
  check(metrics.page === expectedPage, `Route rendue : ${metrics.page}, attendu ${expectedPage}`);
  check(metrics.scrollWidth <= metrics.viewport.width + 1, `Débordement horizontal : ${metrics.scrollWidth} > ${metrics.viewport.width}`);
  check(metrics.scrollWidth <= metrics.clientWidth + 1, `Débordement de la zone utile hors barre de défilement : ${metrics.scrollWidth} > ${metrics.clientWidth}`);
  if (top && ["home", "docs"].includes(expectedPage)) check(metrics.h1?.y >= 0 && metrics.h1.y < 250, `Titre principal hors du début de page : ${metrics.h1?.y}`);
  if (metrics.heroColumns === 2) check(metrics.heroVisual?.height < 700, `Visuel hero trop haut : ${metrics.heroVisual?.height}`);
  const canonical = `${canonicalOrigin}${route.split(/[?#]/)[0].replace(/\/+$/, "") || "/"}`;
  check(metrics.canonical === canonical && metrics.ogUrl === canonical, "Canonical et og:url incorrects");
  if (expectedPage === "not-found") check(metrics.robots === "noindex,follow", "Une route retirée/inconnue doit être noindex");
  for (const image of metrics.images) {
    check(image.complete && image.naturalWidth > 0 && image.naturalHeight > 0, `Image non décodée : ${image.src}`);
    check(Boolean(image.alt), `Alternative d'image absente : ${image.src}`);
    const metadata = report.screenshots[image.src];
    if (metadata) {
      check(image.naturalWidth === metadata.width && image.naturalHeight === metadata.height, `Dimensions naturelles différentes du manifeste : ${image.src}`);
      check(image.widthAttribute === metadata.width && image.heightAttribute === metadata.height, `Attributs de dimensions différents du manifeste : ${image.src}`);
    }
    if (image.box.width > 0 && image.box.height > 0 && image.naturalHeight > 0) {
      const distortion = Math.abs((image.box.width / image.box.height) / (image.naturalWidth / image.naturalHeight) - 1);
      check(distortion <= 0.01, `Ratio d'image déformé de ${(distortion * 100).toFixed(2)} % : ${image.src}`);
    }
  }
  check(new Set(metrics.ids).size === metrics.ids.length, "Identifiants HTML dupliqués");
  for (const link of metrics.links.filter((entry) => entry.local)) {
    check(publicRoutes.has(link.pathname), `Route interne non connue : ${link.href}`);
    if (!link.hash) continue;
    const ids = idsByRoute.get(link.pathname) || [];
    check(ids.includes(decodeURIComponent(link.hash.slice(1))), `Ancre absente : ${link.href}`);
  }
  report.runtimeErrors.push(...metrics.runtimeErrors.map((error) => ({ stage: name, error })));
  const screenshot = `${name}-${metrics.viewport.width}x${metrics.viewport.height}.png`;
  fs.writeFileSync(path.join(artifactDirectory, screenshot), (await testWindow.webContents.capturePage()).toPNG());
  report.checks.push({ name, route, screenshot, ...metrics, errors: checks });
  report.failures.push(...checks.map((error) => ({ stage: name, error })));
  writeReport();
  return metrics;
}

async function scenario(name, callback) {
  currentStage = name;
  report.currentStage = name;
  writeReport();
  try { await callback(); report.interactions.push({ name, ok: true }); writeReport(); }
  catch (error) { report.failures.push({ stage: name, error: error.stack || String(error) }); writeReport(); }
}

async function key(keyCode, modifiers = []) {
  // L'émulation de focus/CDP évite de montrer ou focaliser une fenêtre native
  // au détriment de l'application de l'utilisateur. Les défauts Chromium
  // (Tab, activation Entrée, fermeture Échap) restent réellement exécutés.
  const keys = { Enter: ["Enter", 13], Escape: ["Escape", 27], Tab: ["Tab", 9], Right: ["ArrowRight", 39], Left: ["ArrowLeft", 37], Home: ["Home", 36], End: ["End", 35], K: ["k", 75] };
  const [keyName, keyNumber] = keys[keyCode];
  const data = { key: keyName, code: keyCode === "K" ? "KeyK" : keyName, windowsVirtualKeyCode: keyNumber, nativeVirtualKeyCode: keyNumber, modifiers: modifiers.includes("control") ? 2 : 0 };
  if (keyCode === "Enter") data.text = "\r";
  await testWindow.webContents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", ...data });
  await testWindow.webContents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", ...data });
  await delay(40);
}

async function verifyMenu() {
  const mobile = await evaluate(() => getComputedStyle(document.querySelector(".menu-toggle")).display !== "none");
  if (!mobile) return;
  await evaluate(() => document.querySelector(".menu-toggle").focus());
  await key("Enter");
  assert.equal(await evaluate(() => document.querySelector(".menu-toggle").getAttribute("aria-expanded")), "true", "Menu accessible au clavier");
  assert.equal(await evaluate(() => getComputedStyle(document.querySelector("#site-nav")).display !== "none"), true);
  await key("Tab");
  assert.equal(await evaluate(() => document.activeElement.closest("#site-nav") !== null), true, "Le focus entre dans le menu");
  await evaluate(() => document.querySelector(".menu-toggle").click());
  assert.equal(await evaluate(() => document.querySelector(".menu-toggle").getAttribute("aria-expanded")), "false");
}

async function verifyZoom(selector, name) {
  await evaluate((query) => { const button = document.querySelector(query); button.scrollIntoView({ block: "center" }); button.focus(); }, selector);
  await key("Enter");
  assert.equal(await evaluate(() => document.querySelector(".screenshot-dialog").open), true, "Entrée ouvre l'aperçu");
  await settleImages();
  const modal = await evaluate(() => { const dialog = document.querySelector(".screenshot-dialog"); const image = dialog.querySelector("img"); return { width: dialog.getBoundingClientRect().width, scrollWidth: dialog.scrollWidth, clientWidth: dialog.clientWidth, focusInside: dialog.contains(document.activeElement), ratio: image.getBoundingClientRect().width / image.getBoundingClientRect().height, naturalRatio: image.naturalWidth / image.naturalHeight }; });
  assert.ok(modal.width <= (await evaluate(() => innerWidth)) && modal.scrollWidth <= modal.clientWidth + 1, "La modale tient dans l'écran");
  assert.ok(modal.focusInside && Math.abs(modal.ratio / modal.naturalRatio - 1) <= 0.01, "Focus et ratio de la modale");
  fs.writeFileSync(path.join(artifactDirectory, `${name}-zoom.png`), (await testWindow.webContents.capturePage()).toPNG());
  await key("Escape");
  await waitUntil(() => evaluate(() => !document.querySelector(".screenshot-dialog").open));
  assert.equal(await evaluate((query) => document.activeElement === document.querySelector(query), selector), true, "Échap rend le focus au bouton d'origine");
}

async function verifySkipLink() {
  await evaluate(() => document.querySelector(".skip-link").focus());
  await key("Enter");
  await waitUntil(() => evaluate(() => document.activeElement === document.querySelector("#main")));
  assert.equal(await evaluate(() => document.querySelector("#main").getAttribute("tabindex")), "-1", "Le contenu principal accepte le focus programmatique");
  await key("Tab");
  assert.equal(await evaluate(() => Boolean(document.activeElement.closest("#main"))), true, "Après le lien d'évitement, Tab poursuit dans le contenu et non vers le logo");
}

async function verifyTour(width) {
  const ids = await evaluate(() => [...document.querySelectorAll("[data-tour-tab]")].map((tab) => tab.dataset.tourTab));
  assert.equal(ids.length, 11, "Le parcours présente les onze espaces actuels");
  for (const id of ids) {
    await evaluate((value) => document.querySelector(`[data-tour-tab="${value}"]`).click(), id);
    await settleImages();
    assert.equal(await evaluate((value) => document.querySelector(`[data-tour-tab="${value}"]`).getAttribute("aria-selected"), id), "true");
    assert.equal(await evaluate(() => document.querySelectorAll('[data-tour-tab][tabindex="0"]').length), 1, "Un seul onglet entre dans l'ordre de tabulation");
    const image = await evaluate(() => {
      const panel = document.querySelector("#product-tour-panel");
      const img = panel.querySelector("img");
      const rect = img.getBoundingClientRect();
      panel.scrollIntoView({ block: "start", behavior: "instant" });
      return { src: new URL(img.src).pathname, width: img.naturalWidth, height: img.naturalHeight, widthAttribute: Number(img.getAttribute("width")), heightAttribute: Number(img.getAttribute("height")), ratio: rect.width / rect.height, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth };
    });
    const metadata = report.screenshots[image.src];
    assert.ok(metadata && image.width === metadata.width && image.height === metadata.height && image.widthAttribute === metadata.width && image.heightAttribute === metadata.height, `Capture de l'onglet ${id}`);
    assert.ok(Math.abs(image.ratio / (image.width / image.height) - 1) <= 0.01, `Ratio de l'onglet ${id}`);
    assert.ok(image.overflow <= 1, `Débordement de l'onglet ${id}`);
    const screenshot = `tour-${id}-${width}.png`;
    fs.writeFileSync(path.join(artifactDirectory, screenshot), (await testWindow.webContents.capturePage()).toPNG());
    report.tour.push({ id, viewportWidth: width, screenshot, ...image });
  }
  await evaluate(() => document.querySelector("[data-tour-tab]").focus());
  await key("Home");
  for (let index = 1; index <= ids.length; index += 1) {
    await key("Right");
    assert.equal(await evaluate(() => document.activeElement.dataset.tourTab), ids[index % ids.length], "Flèche droite : focus et boucle des onglets");
    assert.equal(await evaluate(() => document.activeElement.getAttribute("aria-selected")), "true");
  }
  await key("Left");
  assert.equal(await evaluate(() => document.activeElement.dataset.tourTab), ids.at(-1));
  await key("Home");
  assert.equal(await evaluate(() => document.activeElement.dataset.tourTab), ids[0]);
  await key("End");
  assert.equal(await evaluate(() => document.activeElement.dataset.tourTab), ids.at(-1));
  await settleImages();
  await verifyZoom("#product-tour-panel [data-screenshot-open]", `tour-${width}`);
}

async function verifyDocs(width) {
  const datasets = await evaluate(async () => {
    const { APP_TABS, POPUP_GROUPS } = await import("/content.js");
    const normalized = (value) => JSON.stringify(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const entries = [...APP_TABS, ...POPUP_GROUPS];
    const invalid = entries.filter((entry) => document.getElementById(entry.id)?.dataset.search !== normalized(entry)).map((entry) => entry.id);
    const diagnostic = [...document.querySelectorAll(".troubleshooting-grid .doc-searchable")].map((element) => {
      try { const value = JSON.parse(element.dataset.search); return Array.isArray(value) && value.length === 2 && Array.isArray(value[1]) && value[1].length > 0; }
      catch { return false; }
    });
    return { checked: entries.length, invalid, diagnostic: diagnostic.length, validDiagnostic: diagnostic.every(Boolean) };
  });
  assert.deepEqual(datasets.invalid, [], "Les datasets JSON des onglets/fenêtres doivent être complets et correctement échappés");
  assert.ok(datasets.checked >= 32 && datasets.diagnostic > 0 && datasets.validDiagnostic, "Les datasets de diagnostic conservent les étapes complètes");
  await key("K", ["control"]);
  assert.equal(await evaluate(() => document.activeElement.id), "docs-search", "Ctrl+K ouvre la recherche documentaire");
  const search = async (selector, value) => evaluate((query, text) => { const input = document.querySelector(query); input.value = text; input.dispatchEvent(new Event("input", { bubbles: true })); }, selector, value);
  await search("#docs-search", "expressioninexistanteqa987654");
  assert.equal(await evaluate(() => document.querySelector("#docs-empty").hidden), false, "Recherche sans résultat");
  await search("#docs-search", "commandes");
  assert.equal(await evaluate(() => document.querySelector("#docs-empty").hidden), true);
  assert.equal(await evaluate(() => document.querySelector("#commandes").hidden), false, "La recherche Commandes retrouve bien sa fiche");
  await evaluate(() => { globalThis.publicSiteQaSearchNode = document.querySelector("#docs-search"); });
  for (let index = 0; index < 2; index += 1) {
    await evaluate(() => document.querySelector('.docs-sidebar a[href="#onglets"]').click());
    await waitUntil(() => evaluate(() => document.activeElement.id === "onglets"));
    assert.equal(await evaluate(() => document.querySelector("#docs-search") === globalThis.publicSiteQaSearchNode && document.querySelector("#docs-search").value === "commandes" && !document.querySelector("#commandes").hidden), true, "Une ancre, y compris le même hash, ne recrée pas la page et préserve son filtre");
  }
  await search("#docs-search", "jusqu’à huit alias");
  assert.equal(await evaluate(() => document.querySelector("#popup-commande").hidden), false, "La recherche dans un champ retrouve la fenêtre de commande");
  await search("#docs-search", "Aucune clé Backblaze personnelle");
  assert.equal(await evaluate(() => document.querySelector("#medias-imports").hidden), false, "Une section sans carte reste trouvable");
  assert.equal(await evaluate(() => document.querySelector("#docs-empty").hidden), true, "Une section trouvée ne doit pas afficher Aucun résultat");
  await search("#docs-search", "Spotify");
  await search("#game-search", "Rocket");
  assert.equal(await evaluate(() => document.querySelector("#medias-imports").hidden), true, "La précondition masque bien la cible du sommaire");
  await evaluate(() => document.querySelector('.docs-sidebar a[href="#medias-imports"]').click());
  await waitUntil(() => evaluate(() => document.activeElement.id === "medias-imports" && !document.querySelector("#medias-imports").closest("[hidden]")));
  assert.equal(await evaluate(() => document.querySelector("#docs-search").value === "" && document.querySelector("#game-search").value === ""), true, "Une ancre vers une cible masquée efface les deux filtres pour la révéler");
  await search("#docs-search", "Minecraft");
  const minecraftMatches = await evaluate(() => [...document.querySelectorAll(".game-doc:not([hidden])")].map((element) => element.id));
  assert.ok(minecraftMatches.length > 0, "La recherche globale retrouve Minecraft");
  await search("#game-search", "Rocket");
  assert.equal(await evaluate(() => document.querySelectorAll(".game-doc:not([hidden])").length), 0, "Les recherches globale et jeux se combinent en ET");
  assert.equal(await evaluate(() => document.querySelector("#game-count").textContent), "0");
  await search("#game-search", "");
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll(".game-doc:not([hidden])")].map((element) => element.id)), minecraftMatches, "Vider le filtre de jeux conserve la recherche globale Minecraft");
  const labels = await evaluate(() => ["docs-search", "game-search"].map((id) => document.getElementById(id).getAttribute("aria-label")));
  assert.ok(labels[0]?.toLowerCase().includes("documentation") && labels[1]?.toLowerCase().includes("jeux"), "Les deux recherches ont des noms accessibles descriptifs");
  await search("#docs-search", "");
  await search("#game-search", "expressioninexistanteqa987654");
  assert.equal(await evaluate(() => document.querySelector("#game-count").textContent), "0");
  const first = await evaluate(() => ({ title: document.querySelector(".game-doc h3").textContent, id: document.querySelector(".game-doc").id }));
  await search("#game-search", first.title);
  assert.ok(Number(await evaluate(() => document.querySelector("#game-count").textContent)) > 0, "Filtre du catalogue avec résultat");
  await search("#game-search", "");
  assert.equal(await evaluate(() => document.querySelectorAll(".game-doc:not([hidden])").length), Number(await evaluate(() => document.querySelector("#game-count").textContent)));
  await evaluate((id) => document.querySelector(`a[href="#${id}"]`).click(), first.id);
  await waitUntil(() => evaluate((id) => document.getElementById(id)?.open, first.id));
  assert.equal(await evaluate(() => document.documentElement.dataset.page), "docs");
  await verifyZoom(".docs-content [data-screenshot-open]", `docs-${width}`);
  report.docsRegressions.push({ viewportWidth: width, ...datasets, commandCard: true, commandPopup: true, sectionOnlySearch: true, sameHashPreservesFilter: true, skipLinkFocus: true, anchorRevealsHiddenTarget: true, combinedFilters: true, accessibleSearchLabels: labels });
}

async function run() {
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "Construire website/dist avant le smoke");
  server = http.createServer(serve);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  localOrigin = `http://127.0.0.1:${server.address().port}`;
  report.localOrigin = localOrigin;
  report.currentStage = "serveur local prêt";
  writeReport();
  const preload = path.join(profileDirectory, "preload.js");
  fs.writeFileSync(preload, 'globalThis.publicSiteQaErrors=[];addEventListener("error",event=>publicSiteQaErrors.push(String(event.error?.stack||event.message)));addEventListener("unhandledrejection",event=>publicSiteQaErrors.push(String(event.reason?.stack||event.reason)));');
  testWindow = new BrowserWindow({ width: 1440, height: 1000, show: false, backgroundColor: "#070815", webPreferences: { preload, contextIsolation: false, nodeIntegration: false, sandbox: false, webSecurity: true, offscreen: true, backgroundThrottling: false, partition: "public-site-qa-isolated" } });
  testWindow.webContents.setAudioMuted(true);
  testWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const session = testWindow.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.on("will-download", (event, item) => { event.preventDefault(); report.downloads.push(item.getFilename()); });
  session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const permitted = url.origin === localOrigin || ["data:", "blob:", "about:"].includes(url.protocol);
    if (!permitted) report.blockedRequests.push({ stage: currentStage, url: `${url.origin}${url.pathname}` });
    callback({ cancel: !permitted });
  });
  session.webRequest.onErrorOccurred((details) => { if (details.error !== "net::ERR_ABORTED") report.failedRequests.push({ stage: currentStage, url: details.url, error: details.error }); });
  session.webRequest.onCompleted((details) => { if (details.statusCode >= 400) report.failedRequests.push({ stage: currentStage, url: details.url, status: details.statusCode }); });
  testWindow.webContents.on("console-message", (details) => { if (details.level === "error") report.consoleErrors.push({ stage: currentStage, error: details.message }); });
  await load("/docs", 1440, 1000);
  // Le premier document doit exister avant d'envoyer une commande CDP.
  // Un BrowserWindow offscreen encore vide n'a pas forcément de cible renderer.
  testWindow.webContents.debugger.attach("1.3");
  await testWindow.webContents.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
  await testWindow.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  report.screenshots = await evaluate(async () => (await import("/app/screenshots.js")).SCREENSHOTS);
  idsByRoute.set("/docs", await evaluate(() => [...document.querySelectorAll("[id]")].map((element) => element.id)));
  for (const [width, height] of viewports) {
    await scenario(`home-${width}`, async () => { await load("/", width, height); await checkpoint("home", "/", "home"); await verifyMenu(); await verifySkipLink(); await verifyZoom(".hero [data-screenshot-open]", `hero-${width}`); await verifyTour(width); });
    await scenario(`docs-${width}`, async () => { await load("/docs", width, height); await checkpoint("docs", "/docs", "docs"); await verifyMenu(); await verifySkipLink(); await verifyDocs(width); });
  }
  for (const [width, height] of [viewports[0], viewports[5]]) {
    for (const route of otherRoutes) await scenario(`${route}-${width}`, async () => {
      await load(route, width, height);
      const expectedPage = ["/cgu", "/cgv", "/mentions-legales", "/confidentialite", "/cookies"].includes(route) ? "legal" : "not-found";
      await checkpoint(route.slice(1), route, expectedPage);
      await verifyMenu();
    });
  }
  for (const name of ["consoleErrors", "runtimeErrors", "blockedRequests", "failedRequests", "downloads"]) {
    if (report[name].length) report.failures.push({ stage: "contrôles globaux", error: `${name} : ${report[name].length}`, details: report[name] });
  }
  finish();
}

function finish(error = null) {
  clearTimeout(deadline);
  if (error) report.failures.push({ stage: currentStage, error: error.stack || String(error) });
  report.finishedAt = new Date().toISOString();
  report.ok = report.failures.length === 0;
  writeReport();
  process.stdout.write(JSON.stringify({ ok: report.ok, captures: report.checks.length, failures: report.failures.length, report: path.join(artifactDirectory, "report.json") }, null, 2) + "\n");
  testWindow?.destroy();
  server?.close();
  app.exit(report.ok ? 0 : 1);
}

app.whenReady().then(run).catch(finish);
