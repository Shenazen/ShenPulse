"use strict";

/** Même calcul de volume pour le PC, les sources locales et les sources HTTPS. */
(function exposeAudioControl(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShenPulseAudio = { ...api, runtime: new api.AudioMixer() };
})(typeof globalThis === "object" ? globalThis : this, root => {
  const channels = ["master", "sounds", "tts", "matches", "overlays"];
  function volume(value, fallback = 1) {
    if (value === null || value === undefined || String(value).trim() === "") return fallback;
    const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  }
  function normalizeSettings(value = {}) {
    return Object.fromEntries(channels.map(key => [key, volume(value?.[key])]));
  }
  function normalizeControl(value = {}) {
    const actions = {};
    for (const [id, raw] of Object.entries(value.actions || {}).slice(0, 2000)) {
      if (id && id.length <= 160 && Number.isFinite(Number(raw)) && raw !== null) actions[id] = volume(raw);
    }
    return { settings: normalizeSettings(value.settings), actions };
  }
  function stateControl(state = {}) {
    const actions = {};
    const packId = state.session?.game?.packId;
    const rules = [...(state.rules || []), ...(state.game?.interactionRulesByPack?.[packId] || [])];
    for (const rule of rules) for (const action of rule.actions || []) {
      if (action.id && action.config?.volume !== undefined && ["audio.play", "tts.speak", "overlay.match", "overlay.alert", "overlay.media"].includes(action.type)) actions[action.id] = volume(action.config?.volume);
    }
    for (const item of state.settings?.matches?.automations || []) {
      const reactions = item.reaction?.type === "bundle" ? item.reaction.reactions || [] : [item.reaction];
      for (const reaction of reactions) if (item.id && reaction?.volume !== undefined && ["animation", "sound", "media"].includes(reaction.type)) {
        actions[`match_${item.id}_${reaction.type}`] = volume(reaction.volume);
      }
    }
    return normalizeControl({ settings: state.settings?.audioMixer, actions });
  }
  class AudioMixer {
    constructor() { this.control = normalizeControl(); this.entries = new Set(); }
    update(value) {
      if (!value || typeof value !== "object") return;
      const next = normalizeControl(value);
      next.actions = Object.fromEntries(Object.entries({ ...this.control.actions, ...next.actions }).slice(-2000));
      this.control = next;
      for (const entry of [...this.entries]) entry.apply();
    }
    level(kind, payload = {}, sourceVolume = 1) {
      const action = String(payload.originActionId || "");
      const base = action && Object.hasOwn(this.control.actions, action) && !payload.previewScope
        ? this.control.actions[action] : volume(payload.volume);
      return this.control.settings.master * (this.control.settings[kind] ?? 1) * base * volume(typeof sourceVolume === "function" ? sourceVolume() : sourceVolume);
    }
    track(apply) {
      const entry = { apply }; this.entries.add(entry); apply();
      return () => this.entries.delete(entry);
    }
    media(element, kind, payload = {}, sourceVolume = 1) {
      const release = this.track(() => { element.volume = this.level(kind, payload, sourceVolume); });
      element.addEventListener("ended", release, { once: true });
      element.addEventListener("error", release, { once: true });
      return release;
    }
    gain(context, kind = "overlays", payload = {}, sourceVolume = 1) {
      const node = context.createGain();
      const release = this.track(() => { node.gain.setValueAtTime(this.level(kind, payload, sourceVolume), context.currentTime); });
      node.connect(context.destination);
      return { node, release };
    }
    /** Le moteur Windows fige le volume d'une phrase : reprendre au dernier mot
     * annoncé permet de régler la voix en cours, sans relire tout le commentaire. */
    speak(payload, { onEnd = () => {}, sourceVolume = 1 } = {}) {
      const synth = root.speechSynthesis;
      if (!synth || !root.SpeechSynthesisUtterance) { onEnd(); return () => {}; }
      let utterance, offset = 0, boundary = 0, generation = 0, closed = false, last = -1;
      let release = () => {};
      const stop = () => { if (closed) return; closed = true; generation++; release(); synth.cancel(); onEnd(); };
      const start = () => {
        const token = ++generation;
        utterance = new root.SpeechSynthesisUtterance(String(payload.text || "").slice(offset));
        utterance.rate = Number(payload.rate || 1); utterance.pitch = Number(payload.pitch ?? 1);
        utterance.volume = last;
        const voice = synth.getVoices().find(entry => entry.name === payload.voice);
        if (voice) utterance.voice = voice;
        utterance.lang = voice?.lang || payload.language || "fr-FR";
        utterance.onboundary = event => { if (token === generation) boundary = offset + Math.max(0, Number(event.charIndex) || 0); };
        const done = () => { if (token !== generation || closed) return; closed = true; release(); onEnd(); };
        utterance.onend = done; utterance.onerror = done;
        synth.speak(utterance);
      };
      release = this.track(() => {
        const next = this.level("tts", payload, sourceVolume);
        if (next === last || closed) return;
        last = next;
        if (utterance) { generation++; synth.cancel(); offset = boundary; }
        start();
      });
      if (closed) release();
      return stop;
    }
  }
  return { channels, volume, normalizeSettings, normalizeControl, stateControl, AudioMixer };
});
