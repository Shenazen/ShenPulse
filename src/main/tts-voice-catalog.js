"use strict";

const voices = require("../shared/tts-voices");
const CATALOG_MIRROR = "https://f003.backblazeb2.com/file/shenpulse-media/tts/catalog/2026-11-03/voices.json";
const REFRESH_MS = 6 * 60 * 60 * 1000;

class TtsVoiceCatalog {
  constructor({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
    this.fetch = fetchImpl;
    this.now = now;
    this.updatedAt = 0;
    this.pending = null;
  }
  async list() {
    if (this.updatedAt && this.now() - this.updatedAt < REFRESH_MS) return voices.NATURAL_VOICES;
    if (!this.pending) this.pending = this.refresh().finally(() => { this.pending = null; });
    return this.pending;
  }
  async refresh() {
    const { MsEdgeTTS } = require("msedge-tts");
    for (const url of [MsEdgeTTS.VOICES_URL, CATALOG_MIRROR]) {
      try {
        const response = await this.fetch(url, { signal: AbortSignal.timeout(3500) });
        if (!response.ok) throw new Error("Catalogue indisponible");
        const text = await response.text();
        if (text.length > 2_000_000) throw new Error("Catalogue trop volumineux");
        const data = JSON.parse(text);
        if (!Array.isArray(data) || !data.length) throw new Error("Catalogue vide");
        const language = new Intl.DisplayNames("fr", { type: "language" });
        const entries = url === CATALOG_MIRROR ? data : data.map((entry) => ({
          name: entry.ShortName, lang: entry.Locale,
          label: `${String(entry.ShortName).slice(String(entry.Locale).length + 1).replace(/MultilingualNeural$/, " multilingue").replace(/Neural$/, "")} · ${language.of(entry.Locale)}`
        }));
        voices.installCatalog(entries);
        break;
      } catch { /* Le catalogue embarqué reste immédiatement utilisable hors ligne. */ }
    }
    this.updatedAt = this.now();
    return voices.NATURAL_VOICES;
  }
}
module.exports = { TtsVoiceCatalog, CATALOG_MIRROR };
