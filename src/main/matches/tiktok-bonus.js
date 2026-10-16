"use strict";

const { battlePeriodTime } = require("./tiktok-time");

/** Contrat des tâches du SDK installé : START annonce une récompense possible,
 * sauf START_BONUS (type de cible 22), dont la fenêtre explicite est disponible.
 * TASK_SETTLE confirme le résultat de la tâche de la salle connectée.
 * Ni l'auteur d'un cadeau ni taskUpdate.fromUserUid n'est son bénéficiaire.
 * Le SDK ne fournit aucun identifiant de tâche : aucune identité n'est inventée.
 */
const timestamp = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? (number < 1e12 ? number * 1000 : number) : 0;
};
const firstTimestamp = (...values) => values.map(timestamp).find((value) => value > 0) || 0;
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const positiveInteger = (value) => {
  if (typeof value !== "number" && (typeof value !== "string" || !/^[1-9]\d*$/.test(value))) return 0;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};

function normalizeTikTokBattleBonus(data, { clockOffsetMs = 0 } = {}) {
  if (!object(data)) return null;
  const type = Number(data.battleTaskMessageType);
  const period = data.taskStart?.battleBonusConfig?.rewardPeriodConfig;
  const multiplier = [2, 3].includes(Number(period?.rewardMultiple)) ? Number(period.rewardMultiple) : null;
  const durationMs = Math.min(3600000, Math.max(0, Number(period?.duration) || 0) * 1000);
  const announced = battlePeriodTime({ timestamp: period?.rewardStartTimestamp, startTime: period?.rewardStartTime });
  // Un zéro protobuf absent ne remplace jamais un horodatage réellement reçu.
  const settled = battlePeriodTime({ timestamp: data.taskSettle?.rewardStartTimestamp, startTime: data.taskSettle?.rewardStartTime });
  const selected = type === 2 && (settled.startsAtMs || settled.startsBeforeEndMs) ? settled : announced;
  const offset = Number.isFinite(clockOffsetMs) && clockOffsetMs >= 0 && clockOffsetMs <= 30000 ? clockOffsetMs : 0;
  const base = { multiplier, startsAtMs: selected.startsAtMs ? selected.startsAtMs - offset : 0,
    ...(offset && selected.startsAtMs ? { sourceStartsAtMs: selected.startsAtMs } : {}),
    ...(selected.startsBeforeEndMs ? { startsBeforeEndMs: selected.startsBeforeEndMs } : {}),
    durationMs, result: "unknown", periodKey: "",
    createdAtMs: firstTimestamp(data.common?.createTime) ? firstTimestamp(data.common.createTime) - offset : 0 };
  if (type === 0 && object(data.taskStart)) {
    if (data.taskStart.battleBonusConfig?.taskPeriodConfig?.targetType === 22) {
      const duration = positiveInteger(period?.duration);
      if (![2, 3].includes(period?.rewardMultiple) || !duration || duration > 3600 ||
        !(base.startsAtMs > 1e12 || base.startsBeforeEndMs > 0)) return null;
      return { stage: "start-bonus", ...base, result: "available" };
    }
    return { stage: "announced", ...base };
  }
  if (type === 2 && object(data.taskSettle)) {
    const result = ({ 0: "success", 1: "failed", 2: "both" })[data.taskSettle.taskResult] || "unknown";
    return { stage: "settled", ...base, result };
  }
  if (type === 3 && object(data.rewardSettle)) return { stage: "ended", ...base };
  return null;
}

module.exports = { normalizeTikTokBattleBonus };
