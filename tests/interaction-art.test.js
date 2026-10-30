"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { inflateSync } = require("node:zlib");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { interactionArtwork } = require("../src/main/game-catalog/interaction-art");
const root = path.resolve(__dirname, ".."), resources = path.join(root, "resources");

// Decode actual PNG pixels so an empty crop or an unused atlas cell cannot
// satisfy coverage merely by existing on disk. Thumbnails are RGBA8 PNGs.
function pixelRange(png) {
  const chunks = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at), type = png.toString("ascii", at + 4, at + 8);
    if (type === "IDAT") chunks.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), stride = width * 4;
  assert.equal(png[24], 8); assert.equal(png[25], 6); assert.equal(png[28], 0);
  const data = inflateSync(Buffer.concat(chunks));
  let previous = Buffer.alloc(stride), at = 0, min = 255, max = 0;
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let row = 0; row < height; row++) {
    const filter = data[at++], current = Buffer.allocUnsafe(stride);
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? current[x - 4] : 0, up = previous[x], diagonal = x >= 4 ? previous[x - 4] : 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : paeth(left, up, diagonal);
      const value = current[x] = (data[at++] + prediction) & 255;
      if (x % 4 !== 3) { min = Math.min(min, value); max = Math.max(max, value); }
    }
    previous = current;
  }
  return max - min;
}

test("chaque interaction du catalogue possède une image existante", () => {
  const missing = [];
  for (const pack of loadShenazenGameCatalog(resources)) for (const effect of pack.effects) {
    if (effect.image?.startsWith("data:image/svg+xml,")) {
      const svg=decodeURIComponent(effect.image.slice("data:image/svg+xml,".length));
      assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      assert.ok(svg.includes('data-effect="'+effect.id+'"'));
      assert.doesNotMatch(svg, /<script|onload=/i);
      continue;
    }
    if (!effect.image || (!/^https?:\/\//.test(effect.image) && !fs.existsSync(path.resolve(root, "src/renderer", effect.image))))
      missing.push(`${pack.id}/${effect.id}`);
  }
  assert.deepEqual(missing, []);
});

test("les 737 nouvelles illustrations sont des images individuelles, non vides et vérifiées", () => {
  const art = JSON.parse(fs.readFileSync(path.join(resources, "catalogs/game-interaction-art.json"), "utf8"));
  assert.equal(art.generator, "image_gen built-in");
  assert.equal(art.entries.length, 737);
  assert.equal(new Set(art.entries.map(entry => entry.gameId)).size, 20);
  const keys = new Set(), hashes = new Set();
  for (const entry of art.entries) {
    const key = `${entry.gameId}/${entry.effectId}`;
    assert.ok(!keys.has(key), key); keys.add(key);
    assert.equal(entry.file, key + ".png");
    const bytes = fs.readFileSync(path.join(resources, "game-interaction-art", entry.file));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), 256); assert.equal(bytes.readUInt32BE(20), 256);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    assert.ok(!hashes.has(entry.sha256), `Duplicate image: ${key}`); hashes.add(entry.sha256);
    assert.ok(pixelRange(bytes) > 80, `Empty or blank atlas cell: ${key}`);
    if (entry.sheet) {
      const sheet = art.sheets[entry.sheet]; assert.ok(sheet?.prompt);
      assert.ok(entry.cell.column >= 0 && entry.cell.column < sheet.columns);
      assert.ok(entry.cell.row >= 0 && entry.cell.row < sheet.rows);
    } else assert.ok(entry.prompt);
  }
});

test("la résolution des images conserve les visuels existants et ignore les chemins invalides", t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-art-resolution-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  fs.mkdirSync(path.join(temporary, "catalogs")); fs.mkdirSync(path.join(temporary, "game-interaction-art/game"), { recursive: true });
  fs.writeFileSync(path.join(temporary, "game-interaction-art/game/heal.png"), "fixture");
  fs.writeFileSync(path.join(temporary, "catalogs/game-interaction-art.json"), JSON.stringify({ entries: [
    { gameId: "game", effectId: "heal", file: "game/heal.png" },
    { gameId: "game", effectId: "bad", file: "../../private.png" },
    { gameId: "game", effectId: "missing", file: "game/missing.png" }
  ] }));
  const pack = { id: "game", effects: [{ id: "heal", code: "heal", parameters: [{ id: "amount" }] }, { id: "bad" }, { id: "missing" }] };
  const original = structuredClone(pack), resolve = interactionArtwork(temporary);
  const next = resolve(pack);
  assert.equal(next.effects[0].image, "../../resources/game-interaction-art/game/heal.png");
  assert.equal(next.effects[1].image, undefined); assert.equal(next.effects[2].image, undefined);
  assert.deepEqual(pack, original);
  next.effects[0].image = "changed";
  assert.notEqual(resolve(pack).effects[0].image, "changed");
  assert.equal(resolve({ id: "game", effects: [{ id: "heal", image: "existing.webp" }] }).effects[0].image, "existing.webp");
});

test("les 42 effets Supermarket ont des illustrations distinctes et optimisées", () => {
  const plan = require("../docs/supermarket-interaction-art.prompts.json");
  const pack = loadShenazenGameCatalog(resources).find(item => item.id === "supermarket-simulator");
  assert.equal(plan.tool, "built-in image_gen");
  assert.equal(plan.entries.length, 42);
  const hashes = new Set();
  for (const effect of pack.effects) {
    const entry = plan.entries.find(item => item.id === effect.id);
    assert.equal(entry.code, effect.code);
    assert.ok(entry.prompt);
    assert.equal(effect.image, "../../resources/overlays/media/game-interactions/supermarket-simulator/" + effect.id + ".png");
    const bytes = fs.readFileSync(path.resolve(root, "src/renderer", effect.image));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), 384); assert.equal(bytes.readUInt32BE(20), 384);
    const hash = createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash, entry.sha256);
    assert.ok(!hashes.has(hash), effect.id); hashes.add(hash);
    assert.ok(bytes.length < 500000);
  }
  assert.equal(hashes.size, 42);
});
