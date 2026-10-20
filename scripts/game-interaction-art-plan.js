"use strict";

// Préparation reproductible des visuels. La génération est faite avec l’outil
// image_gen intégré, une image par interaction ; ce script n’appelle aucune API.
const fs = require("node:fs");
const path = require("node:path");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const root = path.resolve(__dirname, "..");
const styles = {
  "crash-bandicoot-n-sane-trilogy": "Polished colorful 3D Crash Bandicoot N. Sane Trilogy tropical platforming world, orange bandicoot hero, carved wooden crates, Wumpa fruits, jungle platforms, warm sunlight, lush green and orange palette.",
  unturned: "Unturned survival game aesthetic: simple blocky low-poly 3D survivors and zombies, square heads, toy-like wilderness, pine forests and abandoned towns, muted forest greens. Keep the image readable and non-graphic.",
  "the-mortuary-assistant": "The Mortuary Assistant supernatural horror aesthetic: realistic dim mortuary, cold clinical light, embalming equipment, restrained red accents and eerie spectral shadows. No gore, no graphic bodies; express horror through atmosphere and props.",
  "find-the-needle-demo": "Find The Needle rural hay-collecting game aesthetic: cozy stylized 3D farm courtyard, golden hay, haystacks, conveyor belts and agricultural machines, warm daylight.",
  thiercelieux: "Les Loups-Garous de Thiercelieux social deduction board-game aesthetic: hand-painted storybook medieval French village, wolves and villagers, indigo moonlight, amber lanterns, mysterious illustrated card-art mood.",
  "coin-pusher": "Polished 3D arcade coin pusher machine, bright gold coins, layered metallic shelves, glass, jewel-like reward accents, attractive arcade lighting.",
  "connect-four": "Polished friendly 3D Connect Four arena, deep-blue upright grid and glossy red and yellow circular counters, clean tabletop background.",
  "deal-or-no-deal": "Glossy 3D television game-show aesthetic, metallic prize briefcases, warm gold stage lighting, dark blue studio background, prize selection suspense.",
  "diamond-bridge": "ShenPulse Diamond Bridge voxel platforming world, floating block bridge above a void, turquoise diamond blocks, square stepping stones, colorful sky.",
  "diamond-drop": "ShenPulse Diamond Drop jewel arcade aesthetic: faceted colorful diamonds, glossy falling gems and a clean dark arcade board, luminous cyan and purple accents.",
  "color-strike": "ShenPulse Color Strike 3D paint-battle arcade aesthetic: glossy stylized paint weapons, red-versus-blue teams, bold wet paint splashes, compact colorful arena. Preserve the exact red or blue team specified by the interaction.",
  "tiklive-climb": "ShenPulse Climb 3D vertical platforming arcade aesthetic: a colorful ball climbing bright geometric platforms and obstacles suspended high in a sky arena, dynamic upward composition.",
  "tiklive-cube-wars": "ShenPulse Cube Wars toy-like 3D voxel battle arena: red and blue cube armies, blocky bases and towers. Clearly show the team or side specified by the interaction.",
  "tiklive-stack-tower": "ShenPulse Stack Tower polished 3D arcade aesthetic: brightly colored flat blocks stacked into a tall tower, clean dark-sky background, visible floor layers and playful physical motion.",
  "clash-of-live": "ShenPulse Clash of Live colorful 3D medieval battle arena: toy-like knights, skeletons, barbarians, giants, dragons and stone towers. Red and blue factions; use the precise unit and faction in the interaction.",
  "pokemon-red-blue": "Pokémon Red and Blue Kanto aesthetic: charming crisp Game Boy-inspired pixel-art illustration with clearly readable chunky pixels and restrained colors. Accurately depict the specific original-generation Pokémon, item, status or stat named in the interaction. For giving/removing, show the exact item with a small green plus or red minus cue. No screenshot UI.",
  "super-mario-kart": "Super Mario Kart SNES-inspired colorful 16-bit pixel-art illustration, original kart-racing characters, shells, mushrooms and racing track scenery. Depict the exact racer, item or racing mechanic named in the interaction; clear chunky pixel shapes, no screenshot UI.",
  fortnite: "Fortnite-inspired vibrant polished 3D battle royale island aesthetic: stylized survivor, pickaxe, building walls, loot and bright daylight. Match the actual interaction, not generic battle artwork.",
  "rocket-league": "Rocket League polished futuristic 3D car-football aesthetic: rocket-powered sports cars, large soccer ball, neon stadium lights, dynamic but clear action. Match the actual driving or control interaction.",
  demonologist: "Demonologist realistic paranormal investigation horror aesthetic: abandoned gothic interiors, occult investigation instruments, spectral apparition, cold blue-green light and candlelight. No gore; use the specific action or prop requested."
};
const template = [
  "Use case: stylized-concept.",
  "Asset type: ONE square illustration for a ShenPulse game interaction thumbnail.",
  "Game: {game}. Theme and medium: {style}",
  "Interaction to illustrate precisely: {name}. Meaning: {description}. Category: {category}. Internal action code for disambiguation: {code}.",
  "Create one concrete scene that clearly communicates this exact action and belongs to this game's world. For opposite effects, distinguish the action visibly: adding/healing uses a small green plus or gaining motion; removing/damage uses a small red minus or losing motion; acceleration and slowdown must have different poses and motion cues. Only use such cues where relevant.",
  "One dominant subject, large central silhouette, strong contrast, minimal background details, legible at 80 by 80 pixels. Attractive finished game illustration. Full-bleed square composition. No labels, words, captions, watermark, branded logo, border, UI frame, collage, contact sheet or multiple panels. Do not replace the subject with a generic abstract symbol."
].join("\n");

function plan() {
  const packs = loadShenazenGameCatalog(path.join(root, "resources"));
  const known = new Set();
  const rows = [];
  for (const pack of packs) for (const effect of pack.effects) {
    if (effect.image && !effect.image.includes("/game-interaction-art/")) continue;
    if (!styles[pack.id]) throw new Error(`Missing game art direction: ${pack.id}`);
    if (!/^[a-z0-9-]+$/i.test(pack.id) || !/^[a-z0-9_-]+$/i.test(effect.id)) throw new Error(`Unsafe artwork identifier: ${effect.id}`);
    const key = `${pack.id}/${effect.id}`;
    if (known.has(key)) throw new Error(`Duplicate effect: ${key}`);
    known.add(key);
    const values = { game: pack.name, style: styles[pack.id], name: effect.name, description: effect.description || effect.name, category: effect.category || "Interaction", code: effect.code || effect.id };
    rows.push({ gameId: pack.id, effectId: effect.id, name: effect.name, description: values.description, file: `${key}.png`, prompt: template.replace(/\{([a-z]+)\}/g, (_, field) => values[field]) });
  }
  return { schemaVersion: 1, generator: "image_gen built-in", template, styles, entries: rows };
}
function sheetPlan({ missingOnly = true } = {}) {
  const registryPath = path.join(root, "resources/catalogs/game-interaction-art.json");
  const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : { entries: [] };
  const done = new Set(registry.entries.map(entry => `${entry.gameId}/${entry.effectId}`));
  const groups = new Map();
  for (const entry of plan().entries) {
    if (missingOnly && done.has(`${entry.gameId}/${entry.effectId}`)) continue;
    if (!groups.has(entry.gameId)) groups.set(entry.gameId, []);
    groups.get(entry.gameId).push(entry);
  }
  const sheets = [];
  for (const [gameId, entries] of groups) {
    const limit = ["pokemon-red-blue", "super-mario-kart"].includes(gameId) ? 36 : 42;
    for (let start = 0; start < entries.length; start += limit) {
      const jobs = entries.slice(start, start + limit);
      const columns = Math.ceil(Math.sqrt(jobs.length)), rows = Math.ceil(jobs.length / columns);
      const id = `${gameId}-${Math.floor(start / limit) + 1}`;
      const prompt = [
        "Use case: stylized-concept. Asset: ONE game sprite atlas for ShenPulse; its cells will be cropped into individual interaction thumbnails.",
        `Canvas ${columns * 320} by ${rows * 320} pixels: EXACTLY ${columns} equal-width columns and ${rows} equal-height rows, edge-to-edge grid, no outer margin, gutters, labels, text, numbers, frames or watermark. Each cell is a separate square illustration; subjects stay inside the central 80% of their cell, backgrounds reach all edges.`,
        `Art direction: ${styles[gameId]}`,
        "Each action must be recognizable at 80x80 pixels through a concrete subject. Differentiate opposite effects. No generic category icon. No gore or graphic injury.",
        "STRICT row-major cell assignments:",
        ...jobs.map((job, index) => `Row ${Math.floor(index / columns) + 1}, column ${index % columns + 1}: ${job.name}. ${job.description}`),
        "Any unused cells at the end of the final row must be plain dark navy; they will be discarded."
      ].join("\n");
      sheets.push({ id, gameId, columns, rows, entries: jobs.map(({ gameId: game, effectId, file, name }) => ({ gameId: game, effectId, file, name })), prompt });
    }
  }
  return sheets;
}
if (require.main === module) {
  const sheets = process.argv.includes("--sheets");
  const output = sheets ? sheetPlan({ missingOnly: !process.argv.includes("--all") }) : plan();
  if (process.argv[2] && !process.argv[2].startsWith("--")) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(sheets ? { sheets: output.length, images: output.reduce((count, sheet) => count + sheet.entries.length, 0) } : { games: new Set(output.entries.map(e => e.gameId)).size, images: output.entries.length }));
}
module.exports = { plan, sheetPlan };
