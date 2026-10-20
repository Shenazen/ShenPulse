"use strict";

const { createHash } = require("node:crypto");
const { safeString } = require("../utils");
const { shouldEmitTikTokEvent, tiktokGiftIsFinal } = require("./tiktok-protocol");

const MAX_TRACKED_GIFT_COMBOS = 10000;

/** Compte les nouvelles unités avant normalisation, sans attendre la fin du combo.
 * L'instance appartient au runtime LIVE et survit à ses reconnexions automatiques.
 */
class TikTokGiftDelivery {
  constructor({ maxCombos = MAX_TRACKED_GIFT_COMBOS } = {}) {
    this.maxCombos = maxCombos;
    this.combos = new Map();
    this.messageDedup = {};
  }

  accept(event, payload) {
    const comboId = safeString(event.groupId ?? event.group_id ?? "", 160).trim();
    const isCombo = Number(payload.giftType) === 1;
    // Sans identifiant de série fiable, conserver le total final historique :
    // déduire une série du seul couple viewer/cadeau confondrait deux combos.
    if (!isCombo || !comboId || comboId === "0") return this.finalDelivery(event, payload);

    const key = JSON.stringify([
      safeString(event.common?.roomId || payload.roomId || "", 160),
      payload.userId,
      payload.giftId,
      [...(payload.giftRecipientIds || [])].sort(),
      comboId
    ]);
    const previous = this.combos.get(key) || 0;
    const total = Math.floor(Number(event.repeatCount ?? event.repeat_count ?? payload.repeatCount));
    if (!Number.isSafeInteger(total) || total < 1 || total <= previous) return null;
    // Ne jamais évincer une série déjà partiellement livrée : un message tardif
    // rejouerait son cumul. À capacité, seules les nouvelles séries attendent
    // leur total final ; les séries connues continuent d'être livrées aussitôt.
    if (!previous && this.combos.size >= this.maxCombos) return this.finalDelivery(event, payload);

    this.combos.set(key, total);
    return {
      ...payload,
      // Le même msgId peut porter plusieurs compteurs. Les consommateurs aval
      // doivent distinguer les incréments, même sur les copies typed/decoded.
      id: `gift_combo_${createHash("sha256").update(key).digest("hex").slice(0, 32)}_${total}`,
      sourceMessageId: payload.id,
      repeatCount: total - previous,
      giftComboId: comboId,
      giftComboTotal: total,
      giftComboFinal: tiktokGiftIsFinal(event)
    };
  }

  finalDelivery(event, payload) {
    if (!tiktokGiftIsFinal(event)) return null;
    return shouldEmitTikTokEvent(this.messageDedup, "gift", event) ? payload : null;
  }
}

module.exports = { TikTokGiftDelivery, MAX_TRACKED_GIFT_COMBOS };
