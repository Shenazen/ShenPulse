"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  GiftCatalog,
  SOUND_CATALOG,
  createMediaCatalog,
  dedupeLocalizedGifts,
  extractMyInstantsSounds,
  normalizeWikimediaMediaPayload
} = require("../src/main/catalogs");

const resourcesDirectory = path.join(__dirname, "..", "resources");

test("centralise tous les sons importés depuis ShenazenOverlay", () => {
  assert.equal(SOUND_CATALOG.length, 134);
  assert.equal(
    SOUND_CATALOG.filter((sound) => sound.category === "shenpulse").length,
    22
  );
  assert.equal(
    SOUND_CATALOG.filter((sound) => sound.id.startsWith("essential:")).length,
    12
  );
  assert.equal(
    SOUND_CATALOG.filter((sound) => sound.id.startsWith("kenney:")).length,
    100
  );
  for (const sound of SOUND_CATALOG) {
    const relative = sound.url.replace(/^\/overlay\//, "overlays/");
    assert.equal(
      fs.existsSync(path.join(resourcesDirectory, relative)),
      true,
      sound.url
    );
  }
});

test("centralise les images, GIF, vidéos et animations réutilisables", () => {
  const catalog = createMediaCatalog(resourcesDirectory);
  assert.ok(catalog.length >= 100);
  assert.equal(
    catalog.filter((item) => item.source === "tikfinity").length,
    10
  );
  assert.ok(catalog.some((item) => item.kind === "image"));
  assert.ok(catalog.some((item) => item.kind === "video"));
  assert.ok(catalog.some((item) => item.kind === "animation"));
  for (const item of catalog.filter((entry) => entry.source === "included")) {
    const relative = item.url.replace(/^\/overlay\//, "overlays/");
    assert.equal(
      fs.existsSync(path.join(resourcesDirectory, relative)),
      true,
      item.url
    );
  }
  for (const item of catalog.filter((entry) => entry.source === "tikfinity")) {
    const relative = item.url.replace(/^\/overlay\//, "overlays/");
    const filePath = path.join(resourcesDirectory, relative);
    assert.equal(fs.existsSync(filePath), true, item.url);
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(filePath, "utf8")));
  }
});

test("importe les résultats sonores du catalogue web MyInstants", () => {
  const sounds = extractMyInstantsSounds(`
    <button onclick="share('Air Horn', '/fr/instant/air-horn/', '/media/sounds/air-horn.mp3', 'air-horn')"></button>
    <button onclick="share('Air Horn', '/fr/instant/air-horn/', '/media/sounds/air-horn.mp3', 'air-horn')"></button>
  `);
  assert.equal(sounds.length, 1);
  assert.equal(sounds[0].name, "Air Horn");
  assert.equal(sounds[0].source, "myinstants");
  assert.equal(
    sounds[0].url,
    "https://www.myinstants.com/media/sounds/air-horn.mp3"
  );
});

test("normalise les images et GIF du catalogue web Wikimedia Commons", () => {
  const media = normalizeWikimediaMediaPayload({
    query: {
      pages: [
        {
          pageid: 42,
          title: "File:Celebration_loop.gif",
          imageinfo: [
            {
              mime: "image/gif",
              url: "https://upload.wikimedia.org/celebration.gif",
              thumburl: "https://upload.wikimedia.org/celebration-preview.gif",
              descriptionurl:
                "https://commons.wikimedia.org/wiki/File:Celebration_loop.gif",
              extmetadata: {
                LicenseShortName: { value: "CC BY-SA 4.0" }
              }
            }
          ]
        }
      ]
    }
  });
  assert.equal(media.length, 1);
  assert.equal(media[0].kind, "gif");
  assert.equal(media[0].source, "wikimedia");
  assert.equal(
    media[0].url,
    "https://upload.wikimedia.org/celebration.gif"
  );
  assert.match(media[0].detail, /CC BY-SA 4\.0/);
});

test("le catalogue de secours reste limité aux cadeaux français/anglais", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  assert.equal(catalog.gifts.length, 27);
  const rose = catalog.search("Rose", 20);
  assert.ok(rose.gifts.some((gift) => /rose/i.test(gift.name)));
  assert.ok(rose.gifts.every((gift) => Number.isFinite(gift.cost)));
  const all = catalog.search("", 1000);
  assert.equal(all.gifts.length, 27);
  assert.equal(all.gifts[0].cost, 1);
  assert.equal(
    all.gifts.some((gift) =>
      /[\u0370-\u052f\u0590-\u08ff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(
        gift.name
      )
    ),
    false
  );
  for (let index = 1; index < all.gifts.length; index += 1) {
    const previous = all.gifts[index - 1];
    const current = all.gifts[index];
    assert.ok(previous.cost <= current.cost);
    if (previous.cost === current.cost) {
      assert.ok(
        previous.name.localeCompare(current.name, "fr", {
          sensitivity: "base",
          numeric: true
        }) <= 0
      );
    }
  }
});

test("remplace le secours par la liste TikTok localisée en fr-FR", async () => {
  const catalog = new GiftCatalog(resourcesDirectory, {
    fetchLocalizedGifts: async () => [
      {
        diamond_count: 1,
        icon: {
          url_list: ["https://example.com/rose.webp"]
        },
        id: 5655,
        name: "Rose"
      },
      {
        diamond_count: 5,
        id: 5487,
        name: "Finger Heart"
      },
      {
        diamond_count: 10,
        id: 9999,
        name: "日本語"
      }
    ]
  });

  await catalog.refreshLocalized("viewer");

  assert.deepEqual(
    catalog.search("", 100).gifts.map((gift) => gift.name),
    ["Rose", "Finger Heart"]
  );
  assert.equal(catalog.search("Rose", 10).gifts[0].id, "5655");
  assert.equal(
    catalog.search("Rose", 10).gifts[0].imageUrl,
    "https://example.com/rose.webp"
  );
  assert.equal(
    dedupeLocalizedGifts([{ id: 1, name: "Rose", diamond_count: 1 }])
      .length,
    1
  );
});
