"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { TtsVoiceCatalog, CATALOG_MIRROR } = require("../src/main/tts-voice-catalog");
const voices = require("../src/shared/tts-voices");
const bundled = require("../src/shared/tts-voice-catalog");

test("chaque installation possède le catalogue complet sans dépendre des langues Windows", () => {
  assert.ok(bundled.length >= 300);
  assert.ok(voices.NATURAL_VOICES.filter((voice) => voice.lang.startsWith("fr")).length >= 13);
  for (const voice of bundled) assert.equal(voices.naturalVoice(`natural:${voice.name}`).lang, voice.lang);
});

test("catalogue : rafraîchissement mutualisé, ajout automatique, entrées invalides exclues et cache six heures", async () => {
  let calls = 0;
  const catalog = new TtsVoiceCatalog({ fetchImpl: async () => {
    calls++;
    return { ok: true, text: async () => JSON.stringify([{ ShortName: "fr-FR-TestNeural", Locale: "fr-FR" }, { ShortName: "<script>", Locale: "fr-FR" }]) };
  } });
  await Promise.all([catalog.list(), catalog.list(), catalog.list()]);
  await catalog.list();
  assert.equal(calls, 1);
  assert.ok(voices.naturalVoice("natural:fr-FR-TestNeural"));
  assert.equal(voices.naturalVoice("natural:<script>"), undefined);
  voices.installCatalog(bundled);
});

test("catalogue : miroir Backblaze sans accès privé puis secours embarqué si Internet est indisponible", async () => {
  const urls = [];
  const catalog = new TtsVoiceCatalog({ fetchImpl: async (url) => {
    urls.push(url);
    if (url !== CATALOG_MIRROR) throw new Error("Hors ligne");
    return { ok: true, text: async () => JSON.stringify(bundled) };
  } });
  assert.ok((await catalog.list()).length >= 300);
  assert.equal(urls[1], CATALOG_MIRROR);
  const offline = new TtsVoiceCatalog({ fetchImpl: async () => { throw new Error("Hors ligne"); } });
  assert.ok((await offline.list()).length >= 300);
});
