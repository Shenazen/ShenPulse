"use strict";
const audio = require("../../shared/action-audio");
const { readState } = require("../state-projection");

/** Une donnée de son, plusieurs vues ; une seule lecture par événement LIVE.
 * Les identifiants des répétitions restent distincts et les essais sont libres.
 */
class LinkedActionAudio {
  constructor(store, now = Date.now) { this.store = store; this.now = now; this.claims = new Map(); }
  resolve(action) {
    const reference = audio.descriptor(action)?.reference;
    const actions = reference ? (readState(this.store, ["rules"]).rules || []).flatMap(rule => rule.actions || []) : [];
    const sound = audio.resolve(action, actions);
    if (reference && !sound) throw new Error("Le son lié est introuvable ou crée une boucle. Modifiez le choix du son.");
    return sound;
  }
  claim(sound, context, destination = "live") {
    const event = context.event || context;
    if (!event.id || !sound?.sourceId || context.source === "manual-preview") return true;
    const scope = readState(this.store, ["settings.account.uid", "session.profileId", "session.startedAt"]);
    const key = JSON.stringify([scope, event.id, sound.sourceId, destination]);
    const now = this.now();
    for (const [entry, at] of this.claims) if (at < now - 120000) this.claims.delete(entry);
    if (this.claims.has(key)) return false;
    this.claims.set(key, now);
    if (this.claims.size > 2048) this.claims.delete(this.claims.keys().next().value);
    return true;
  }
}
module.exports = { LinkedActionAudio };
