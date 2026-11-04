"use strict";

/** SE.Live stocke chaque canevas séparément des collections OBS classiques.
 * Format vérifié dans obs-streamelements-core (SEVideoComposition / SEObsSceneManager).
 * Toute écriture se fait OBS fermé ; seules nos sources du canevas choisi changent. */
const fs = require("node:fs"), path = require("node:path");
const { stableId, layout, customLayout, sourceViewport, OVERLAY_RENDER_SIZE, WINS_VIEWPORT, writeJson } = require("./layout");
const { settings, sourceName } = require("./obs");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const compositionFolder = root => path.join(root, "plugin_config", "obs-streamelements-core", "scoped_config_storage", "streamelements_multi-streaming", "compositions");
function validateComposition(doc, id) {
  if (!doc || doc.id !== id || !UUID.test(id) || doc.isObsNativeComposition !== false || doc.view !== "custom" ||
      !Array.isArray(doc.scenes) || doc.scenes.length > 1000 || !Array.isArray(doc.streamingVideoEncoders) ||
      ![doc.videoFrame?.width, doc.videoFrame?.height].every(n => Number.isInteger(n) && n >= 16 && n <= 16384) ||
      doc.scenes.some(scene => !scene || typeof scene.name !== "string" || !Array.isArray(scene.sources) || scene.sources.length > 2000)) {
    throw new Error("Ce canevas SE.Live utilise un format non reconnu. Aucune scène n’a été modifiée.");
  }
  return doc;
}
function readComposition(root, id) {
  if (!UUID.test(id)) throw new Error("Canevas SE.Live invalide.");
  const folder = compositionFolder(root), file = path.join(folder, id + ".json");
  let text;
  try {
    if (path.dirname(fs.realpathSync(file)) !== fs.realpathSync(folder) || fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 20_000_000) throw new Error();
    text = fs.readFileSync(file, "utf8");
    return { file, text, document: validateComposition(JSON.parse(text.replace(/^\uFEFF/, "")), id) };
  } catch { throw new Error("Le canevas SE.Live sélectionné est introuvable ou incompatible. Actualisez les destinations."); }
}
function obsDestinations(target) {
  const result = [{ id: "obs-main", kind: "obs", name: "OBS classique · canevas principal" }];
  let files; try { files = fs.readdirSync(compositionFolder(target.configRoot)); } catch { return result; }
  for (const file of files.slice(0, 200)) {
    const id = file.replace(/\.json$/, ""); if (!UUID.test(id)) continue;
    try {
      const { document: doc } = readComposition(target.configRoot, id);
      result.push({ id: "selive:" + id, kind: "selive", name: String(doc.name || "Canevas SE.Live").slice(0, 120),
        width: doc.videoFrame.width, height: doc.videoFrame.height, scenes: doc.scenes.length });
    } catch { /* Les sauvegardes et formats inconnus ne deviennent jamais une autre cible. */ }
  }
  return result;
}
function prepareSELive(original, plan, camera = {}) {
  const doc = structuredClone(validateComposition(original, original?.id));
  const owner = stableId(plan.identity + ":selive-scene"), name = plan.sceneName + " · " + owner.slice(0, 8);
  let scene = doc.scenes.find(entry => entry.auxiliaryData?.shenpulseId === owner || entry.name === name);
  if (!scene) {
    scene = { id: "shenpulse-" + owner, name, active: false, videoCompositionId: doc.id, auxiliaryData: { shenpulseId: owner }, sources: [] };
    doc.scenes.push(scene);
  }
  const area = layout(doc.videoFrame.width, doc.videoFrame.height,plan);
  const inheritedCamera = doc.scenes.flatMap(entry => entry.sources).find(entry => entry.class === "dshow_input");
  const kinds = plan.overlayOnly ? ["wins"] : ["game", "camera", "overlay", ...(plan.winsOverlayUrl ? ["wins"] : [])];
  const created = [];
  for (const kind of kinds) {
    const key = stableId(plan.identity + ":" + kind), label = sourceName(plan, kind);
    let source = scene.sources.find(entry => entry.auxiliaryData?.shenpulseId === key || entry.name === label);
    if (!source) {
      source = { id: "shenpulse-" + key, sceneId: scene.id, videoCompositionId: doc.id, name: label,
        class: { game: "game_capture", camera: "dshow_input", overlay: "browser_source", wins: "browser_source" }[kind],
        settings: kind === "camera" ? structuredClone(inheritedCamera?.settings || camera) : settings(plan, kind),
        filters: [], auxiliaryData: { shenpulseId: key }, visible: true, selected: false, locked: false, order: scene.sources.length };
      scene.sources.push(source);
    } else if (kind !== "camera") source.settings = { ...source.settings, ...settings(plan, kind) };
    const box = area[kind], size = kind === "wins" ? sourceViewport(plan,"wins") : kind === "overlay" ? sourceViewport(plan,"overlay") : { width: 1920, height: 1080 };
    source.composition = { alignment: "top_left", boundsAlignment: "center", boundsType: "scale_to_inner_rect",
      position: { x: box.x, y: box.y }, bounds: { x: box.width, y: box.height }, scale: { x: 1, y: 1 },
      rotationDegrees: 0, crop: { left: 0, right: 0, top: 0, bottom: 0 }, srcWidth: size.width, srcHeight: size.height };
    created.push(source.name);
  }
  return { document: doc, sceneName: scene.name, sources: created, destinationName: "SE.Live · " + String(doc.name || "Canevas"), launchArgs: [] };
}
async function installSELive(target, plan, isRunning) {
  const id = String(plan.destinationId || "").replace(/^selive:/, ""), record = readComposition(target.configRoot, id);
  const result = prepareSELive(record.document, plan);
  plan.assertScope();
  if (await isRunning(target.process)) throw new Error("Fermez OBS avant d’installer la scène dans le canevas SE.Live.");
  plan.assertScope();
  if (fs.readFileSync(record.file, "utf8") !== record.text) throw new Error("Le canevas a changé pendant l’installation. Actualisez les destinations.");
  writeJson(record.file, result.document);
  const verified = readComposition(target.configRoot, id).document.scenes.find(scene => scene.name === result.sceneName);
  if (!verified || !result.sources.every(name => verified.sources.some(source => source.name === name))) throw new Error("La scène SE.Live n’a pas pu être vérifiée.");
  return { ...result, document: undefined };
}
module.exports = { compositionFolder, obsDestinations, prepareSELive, installSELive };
