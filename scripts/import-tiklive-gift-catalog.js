"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectDirectory = path.join(__dirname, "..");
const inputPath = path.resolve(
  process.argv[2] ||
    path.join(
      process.env.LOCALAPPDATA || "",
      "TikLive Games",
      "gifts.json"
    )
);
const outputPath = path.join(
  projectDirectory,
  "resources",
  "catalogs",
  "tiklive-gifts.json"
);

if (!fs.existsSync(inputPath)) {
  throw new Error(`Catalogue TikLive introuvable : ${inputPath}`);
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const values = Array.isArray(payload) ? payload : payload.gifts;
if (!Array.isArray(values)) {
  throw new Error("Le catalogue TikLive ne contient pas de liste de cadeaux.");
}

const gifts = [];
const seenIds = new Set();
for (const value of values) {
  const id = String(value?.id ?? value?.giftId ?? "").trim();
  const name = String(value?.name ?? value?.giftName ?? "").trim();
  const cost = Math.max(
    0,
    Number(value?.cost ?? value?.diamond_count ?? value?.diamondCount) || 0
  );
  const imageUrl = String(
    value?.imageUrl ?? value?.image_url ?? value?.giftPictureUrl ?? ""
  ).trim();
  if (!id || !name || seenIds.has(id)) continue;
  seenIds.add(id);
  gifts.push({
    id,
    name,
    cost,
    imageUrl: /^https:\/\//i.test(imageUrl) ? imageUrl : "",
    source: "tiklive"
  });
}

gifts.sort(
  (left, right) =>
    left.cost - right.cost ||
    left.name.localeCompare(right.name, "fr", {
      sensitivity: "base",
      numeric: true
    }) ||
    left.id.localeCompare(right.id, "en", { numeric: true })
);

const generatedAt = fs.statSync(inputPath).mtime.toISOString();
fs.writeFileSync(
  outputPath,
  `${JSON.stringify({ generatedAt, source: "tiklive-local-cache", gifts })}\n`,
  "utf8"
);

process.stdout.write(
  `Catalogue TikLive importé : ${gifts.length} cadeaux vers ${outputPath}\n`
);
