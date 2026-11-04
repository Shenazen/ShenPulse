"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { NaturalVoiceService } = require("../src/main/natural-voice-service");
const voices = require("../src/shared/tts-voices");
const { normalizeTtsSettings } = require("../src/main/state/defaults/preferences");

test("voix : priorité viewer, modérateur, abonné, équipe, règle et défaut ; choix stable", () => {
  const settings = { voice: "default", assignments: { roles: { moderator: "mod", subscriber: "sub", team: "team" }, viewers: [{ username: "@Alice", voice: "personal" }] } };
  assert.equal(voices.resolveVoice(settings, { voice: "rule" }, { name: "ALICE", moderator: true }), "personal");
  assert.equal(voices.resolveVoice(settings, {}, { moderator: true, subscriber: true }), "mod");
  assert.equal(voices.resolveVoice(settings, {}, { subscriber: true }), "sub");
  assert.equal(voices.resolveVoice(settings, {}, { teamLevel: 1 }), "team");
  assert.equal(voices.resolveVoice(settings, { voice: "rule" }, {}), "rule");
  assert.equal(voices.resolveVoice(settings, {}, {}), "default");
  const id = voices.resolveVoice({ voice: "random:fr" }, {}, { id: "alice" });
  assert.ok(voices.naturalVoice(id));
  assert.equal(id, voices.resolveVoice({ voice: "random:fr" }, {}, { id: "alice", displayName: "Changed" }));
});

test("préférences vocales par profil : héritage conservé et listes bornées", () => {
  const fallback = { voice: "old", volume: .6, assignments: { roles: { moderator: "Denise" }, viewers: Array.from({ length: 150 }, (_, i) => ({ username: `@u${i}`, voice: "voice" })) } };
  const next = normalizeTtsSettings({ pitch: .8 }, fallback);
  assert.equal(next.voice, "old"); assert.equal(next.volume, .6); assert.equal(next.pitch, .8);
  assert.equal(next.assignments.viewers.length, 100);
  assert.equal(voices.normalizeAssignments({ viewers: [{ username: "@Alice", voice: "A" }, { username: "alice", voice: "B" }] }).viewers[0].voice, "B");
});

test("synthèse : XML échappé, audio borné, débit réglé et connexion réutilisée puis fermée", async () => {
  const calls = [];
  let opened = 0;
  const service = new NaturalVoiceService({ createClient: () => { opened++; return {
    setMetadata: async (...args) => calls.push(args),
    toStream: (text, prosody) => { calls.push([text, prosody]); return { audioStream: Readable.from([Buffer.from("mp3")]) }; },
    close: () => calls.push("close")
  }; } });
  const audio = await service.synthesize({ voice: "natural:fr-FR-DeniseNeural", text: '<voice name="bad">&', rate: 20, pitch: -2 });
  assert.equal(audio.audioUrl, "data:audio/mpeg;base64,bXAz");
  assert.match(calls[1][0], /^&lt;voice name=&quot;bad&quot;&gt;&amp;$/);
  assert.equal(calls[1][1].rate, 2); assert.equal(calls[1][1].pitch, "-50Hz");
  assert.equal(calls.includes("close"), false, "Une connexion chaude évite la négociation pour chaque commentaire.");
  await service.synthesize({ voice: "natural:fr-FR-DeniseNeural", text: "Deuxième commentaire" });
  assert.equal(opened, 1);
  assert.equal(calls.includes("close"), false);
  service.close();
  assert.equal(calls.at(-1), "close");
});

test("une connexion inactive est fermée puis recréée pour la lecture suivante", async () => {
  let opened = 0, closed = 0;
  const service = new NaturalVoiceService({ idleMs: 5, createClient: () => {
    opened++;
    return { setMetadata: async () => {}, toStream: () => ({ audioStream: Readable.from([Buffer.from("mp3")]) }), close: () => closed++ };
  } });
  const payload = { voice: "natural:fr-FR-DeniseNeural", text: "Bonjour" };
  await service.synthesize(payload);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(closed, 1);
  await service.synthesize(payload);
  assert.equal(opened, 2);
  service.close();
  assert.equal(closed, 2);
});

test("délai dépassé : secours Windows, circuit temporaire et aucune deuxième connexion", async () => {
  let opened = 0, closed = 0;
  const service = new NaturalVoiceService({ timeoutMs: 10, createClient: () => { opened++; return { setMetadata: () => new Promise(() => {}), close: () => closed++ }; } });
  const payload = { voice: "natural:fr-FR-HenriNeural", text: "Bonjour" };
  assert.deepEqual(await service.synthesize(payload), { fallback: true });
  assert.deepEqual(await service.synthesize(payload), { fallback: true });
  assert.equal(opened, 1); assert.equal(closed, 1);
});

test("changement de profil pendant une synthèse : aucun audio ne sort", async () => {
  let current = true;
  const service = new NaturalVoiceService({ createClient: () => ({
    setMetadata: async () => { current = false; }, close() {},
    toStream() { throw new Error("Ne doit pas être appelé"); }
  }) });
  assert.deepEqual(await service.synthesize({ voice: "natural:fr-FR-DeniseNeural", text: "Bonjour" }, { shouldExecute: () => current }), { cancelled: true });
});


test("le relais public conserve l’audio TTS entier et garde les autres champs bornés", () => {
  const { createRelayMessage } = require("../src/shared/public-overlay-protocol");
  const audioUrl = "data:audio/mpeg;base64," + Buffer.alloc(22000, 1).toString("base64");
  const result = createRelayMessage("tts", { audioUrl, text: "x".repeat(15000), voice: "natural:fr-FR-DeniseNeural" });
  assert.equal(result.payload.audioUrl, audioUrl);
  assert.equal(result.payload.text.length, 10000);
  assert.equal(createRelayMessage("other", { audioUrl }).payload.audioUrl.length, 10000);
  const invalid = createRelayMessage("tts", { audioUrl: "https://bad.test", voice: "natural:fr-FR-DeniseNeural" });
  assert.equal(invalid.payload.audioUrl, undefined); assert.equal(invalid.payload.voice, "");
});
