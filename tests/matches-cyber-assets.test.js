"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const videoDirectory = path.join(__dirname, "..", "resources", "overlays", "media", "video");

/**
 * Les empreintes garantissent l'import sans recompression des six sources Cyber
 * fournies par l'utilisateur. Le coffre n'a pas été fourni : aucun autre média
 * ne doit être renommé pour remplir artificiellement cette entrée du catalogue.
 */
const cyberAssets = [
  ["guantes", "77aa67cf716e82fffba87d621115f8b9a5315b13ded651d3b8ac850fd4e8a181"],
  ["x2", "ed38ab2a274e7741db04673e1304952d234a1e1a52849a1931ff8eca67d84312"],
  ["x3", "9ed5fe6078b06f9ceadda81bcd36eafb64848b962851a5f8853c359ddb6e1ef9"],
  ["taptap", "f1d860f4c0d80ac8b52f20ff07d24d3339db127c70000dfe270c75b547fe69cd"],
  ["quiereme", "5ea2221b90db1b67981951900b4c9405491ce0ec670532c458e973a174c8e39e"],
  ["snipe", "ccf82d236ef539d738a290d4dc356cc795666741d8f4a01f3f7ab7abc60c4eb2"]
];

test("les six vidéos Cyber conservent exactement les sources fournies", () => {
  for (const [name, expectedHash] of cyberAssets) {
    const video = fs.readFileSync(path.join(videoDirectory, `${name}-cyber.webm`));
    assert.equal(createHash("sha256").update(video).digest("hex"), expectedHash, name);
    assert.equal(video.subarray(0, 4).toString("hex"), "1a45dfa3", name);
    assert.ok(video.includes(Buffer.from("V_VP9")), `${name} : codec VP9`);
    assert.ok(video.includes(Buffer.from("A_OPUS")), `${name} : piste Opus`);
  }
});

test("chaque vidéo Cyber dispose de son propre poster WebP transparent", () => {
  for (const [name] of cyberAssets) {
    const poster = fs.readFileSync(path.join(videoDirectory, "posters", `${name}-cyber.webp`));
    assert.equal(poster.subarray(0, 4).toString("ascii"), "RIFF", name);
    assert.equal(poster.subarray(8, 12).toString("ascii"), "WEBP", name);
    assert.equal(poster.subarray(12, 16).toString("ascii"), "VP8X", name);
    assert.ok(poster[20] & 0x10, `${name} : canal alpha WebP`);
    assert.equal(poster.readUIntLE(24, 3) + 1, 540, `${name} : largeur du poster`);
    assert.equal(poster.readUIntLE(27, 3) + 1, 960, `${name} : hauteur du poster`);
  }
});
