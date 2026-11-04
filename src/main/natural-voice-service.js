"use strict";

const { naturalVoice } = require("../shared/tts-voices");
const { TtsVoiceCatalog } = require("./tts-voice-catalog");
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const xml = (value) => String(value).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;

/** Génération à la demande, sans fichier ni journal de commentaire. Une seule
 * synthèse à la fois garde l'ordre des messages ; la file est bornée. */
class NaturalVoiceService {
  constructor({ createClient, timeoutMs = 5000, idleMs = 120000, catalog = new TtsVoiceCatalog() } = {}) {
    this.createClient = createClient || (() => {
      const { MsEdgeTTS } = require("msedge-tts");
      return new MsEdgeTTS({ connectionTimeoutMs: 3500, synthesisTimeoutMs: 5000 });
    });
    this.timeoutMs = timeoutMs;
    this.idleMs = idleMs;
    this.catalog = catalog;
    this.client = null;
    this.idleTimer = null;
    this.tail = Promise.resolve();
    this.pending = 0;
    this.unavailableUntil = 0;
  }
  listVoices() { return this.catalog.list(); }
  close() {
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.client?.close();
    this.client = null;
  }
  async synthesize(payload, { shouldExecute = () => true } = {}) {
    const voice = naturalVoice(payload.voice);
    if (!voice || !String(payload.text || "").trim()) return null;
    if (this.pending >= 20) throw new Error("La file de lecture vocale est pleine.");
    this.pending++;
    const job = this.tail.then(async () => {
      if (!shouldExecute()) return { cancelled: true };
      if (Date.now() < this.unavailableUntil) return { fallback: true };
      clearTimeout(this.idleTimer);
      const client = this.client || (this.client = this.createClient());
      let deadline, stream;
      try {
        const audio = await Promise.race([
          (async () => {
            await client.setMetadata(voice.name, "audio-24khz-48kbitrate-mono-mp3");
            if (!shouldExecute()) return null;
            ({ audioStream: stream } = client.toStream(xml(String(payload.text).slice(0, 1000)), {
              rate: bounded(payload.rate, .5, 2, 1),
              pitch: `${Math.round((bounded(payload.pitch, 0, 2, 1) - 1) * 50)}Hz`
            }));
            let size = 0;
            const chunks = [];
            for await (const chunk of stream) {
              size += chunk.length;
              if (size > MAX_AUDIO_BYTES) throw new Error("Audio trop volumineux.");
              chunks.push(chunk);
            }
            if (!size) throw new Error("Audio vide.");
            return Buffer.concat(chunks).toString("base64");
          })(),
          new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Délai vocal dépassé.")), this.timeoutMs); })
        ]);
        if (!shouldExecute() || !audio) return { cancelled: true };
        return { audioUrl: `data:audio/mpeg;base64,${audio}`, language: voice.lang };
      } catch {
        this.unavailableUntil = Date.now() + 30000;
        this.close();
        return shouldExecute() ? { fallback: true } : { cancelled: true };
      } finally {
        clearTimeout(deadline);
        stream?.destroy();
        if (this.client === client) {
          this.idleTimer = setTimeout(() => this.close(), this.idleMs);
          this.idleTimer.unref?.();
        }
      }
    });
    this.tail = job.catch(() => {});
    try { return await job; } finally { this.pending--; }
  }
}

module.exports = { NaturalVoiceService };
