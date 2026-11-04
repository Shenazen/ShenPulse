"use strict";

// Une série TikTok peut être livrée en plusieurs incréments. La politique est
// propre à chaque déclencheur, sans toucher aux statistiques ou aux dons reçus.
class GiftComboPolicy {
  constructor({ now = Date.now } = {}) { this.now = now; this.combos = new Map(); this.nextCleanup = 0; }
  clear() { this.combos.clear(); this.nextCleanup = 0; }
  count(event, target, repeat, proposed = 1) {
    if (event?.type !== "gift") return proposed;
    const count = Math.max(0, Math.floor(Number(proposed) || 0));
    if (!count) return 0;
    const raw = event.data?.raw || {}, comboId = raw.giftComboId ?? event.data?.giftComboId ?? raw.groupId ?? raw.group_id;
    if (!comboId || String(comboId) === "0") return repeat === true ? count : 1;
    const now = this.now();
    if (now >= this.nextCleanup) {
      this.nextCleanup = now + 60_000;
      for (const [key, value] of this.combos) if (now - value.at > 24 * 60 * 60 * 1000) this.combos.delete(key);
    }
    const key = JSON.stringify([event.source, raw.roomId ?? raw.common?.roomId, event.user?.id || event.user?.name,
      event.data?.giftId || raw.giftId || event.data?.giftName, [...(raw.giftRecipientIds || [])].sort(), String(comboId)]);
    let entry = this.combos.get(key);
    if (!entry) {
      // Même borne que le connecteur, par série et non par action. Ne jamais
      // évincer une série active, ce qui pourrait rejouer son total tardif.
      if (this.combos.size >= 10000) return repeat === true ? count : raw.giftComboFinal === true || raw.repeatEnd === true ? 1 : 0;
      entry = { at: now, targets: new Set() }; this.combos.set(key, entry);
    }
    entry.at = now;
    const seen = entry.targets.has(target); entry.targets.add(target);
    return repeat === true ? count : seen ? 0 : 1;
  }
}
module.exports = { GiftComboPolicy };
