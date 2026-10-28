"use strict";

/** Les annonces TikTok décrivent une possibilité, pas un bonus gagné.
 * SETTLE réussi arme le défi ordinaire ; START_BONUS disponible exige une
 * fenêtre explicite et l'UID vérifié du diffuseur dans le match courant.
 * L'UID du donateur de TASK_UPDATE n'est jamais une identité de bénéficiaire.
 * Mémoire bornée et éphémère : ni secret, ni écriture durable, ni polling. */
const countdownEnd = (current) => Number.isSafeInteger(current.bonusEndsAtMs) &&
  current.bonusEndsAtMs > Math.max(1e12, current.startedAtMs || 0) && current.bonusEndsAtMs <= current.endsAtMs
  ? current.bonusEndsAtMs : current.endsAtMs;
const ownerScope = (current) => JSON.stringify([current.identity, current.battleId, current.ownerUserId,
  current.roomId, current.ownerTeams, current.startedAtMs]);
const pendingStartKey = (input, identity) => JSON.stringify([identity, input.battleId,
  input.bonus?.sourceStartsAtMs || input.bonus?.startsAtMs || `remaining:${input.bonus?.startsBeforeEndMs || 0}`]);
const blockedStartBattleKey = (battleId, identity) => JSON.stringify([identity, battleId, "cancelled-battle"]);
const samePendingContext = (expected, actual) => Boolean(actual &&
  ["roomId", "channelUsername", "liveStartedAt"].every((key) => expected[key] === actual[key]) &&
  (!expected.ownerUserId || expected.ownerUserId === actual.ownerUserId));

class MatchBonuses {
  constructor({ now, current, captureContext, timer, clearTimer, onChange, onStart, onObservation, publish }) {
    Object.assign(this, { now, current, captureContext, timer, clearTimer, onChange, onStart, onObservation, publish });
    this.periods = new Map(); this.activeKey = ""; this.sequence = 0; this.giftProof = null; this.giftValues = new Set();
    this.pendingStarts = new Map(); this.blockedStarts = new Set();
  }
  reset() {
    this.clearTimer("start"); this.clearTimer("end"); this.clearTimer("pending-start");
    this.periods.clear(); this.activeKey = ""; this.sequence = 0; this.giftProof = null; this.giftValues.clear();
    this.pendingStarts.clear(); this.blockedStarts.clear();
  }
  isActive(key) {
    const period = this.periods.get(key), current = this.current();
    if (!current || current.endsAtMs && current.endsAtMs <= this.now()) return false;
    const proof = this.giftProof;
    if (key && proof?.key === key) return Boolean(current && current.ownerVerified === true &&
      proof.identity === current.identity && proof.battleId === current.battleId && proof.ownerUserId === current.ownerUserId &&
      proof.ownerRoomId === current.roomId && proof.ownerTeams === current.ownerTeams &&
      proof.startedAtMs === current.startedAtMs && this.now() < proof.expiresAtMs);
    return Boolean(key && this.activeKey === key && current && period && period.result === "success" &&
      period.identity === current.identity && period.battleId === current.battleId && period.ownerUserId === current.ownerUserId &&
      (!period.ownerRoomId || period.ownerRoomId === current.roomId) &&
      (!period.requiresVerifiedOwner || current.ownerVerified === true) &&
      (!period.requiresVerifiedOwner || period.matchStartedAtMs === current.startedAtMs) &&
      (period.requiresVerifiedOwner ? period.ownerTeams === current.ownerTeams : !period.ownerTeams || period.ownerTeams === current.ownerTeams) &&
      (!period.captureScope || samePendingContext(period.captureScope, this.captureContext?.())) &&
      (!period.durationMs || period.startsAtMs + period.durationMs > this.now()));
  }
  expirePendingStarts() {
    const now = this.now();
    this.clearTimer("pending-start");
    for (const [key, row] of this.pendingStarts) if (row.expiresAtMs <= now) this.pendingStarts.delete(key);
    const next = Math.min(...[...this.pendingStarts.values()].map((row) => row.expiresAtMs));
    if (Number.isFinite(next)) this.timer("pending-start", next - now, () => this.expirePendingStarts());
  }
  discardPendingStarts(battleId, identity, terminal = false) {
    if (terminal === "battle") this.blockedStarts.add(blockedStartBattleKey(battleId, identity));
    for (const [key, row] of this.pendingStarts) if (row.identity === identity && row.input.battleId === battleId) {
      this.pendingStarts.delete(key);
      if (terminal) this.blockedStarts.add(key);
    }
    while (this.blockedStarts.size > 32) this.blockedStarts.delete(this.blockedStarts.values().next().value);
    this.expirePendingStarts();
  }
  bufferStartBonus(input, identity) {
    // Keep only an explicit native START_BONUS proof, never a predicted first
    // gift/20-second bonus. Binding and activation wait for the real OPEN.
    this.expirePendingStarts();
    const bonus = input.bonus, context = this.captureContext?.(), at = this.now();
    const relative = bonus.startsAtMs === 0 && Number.isSafeInteger(bonus.startsBeforeEndMs) &&
      bonus.startsBeforeEndMs > 0 && bonus.startsBeforeEndMs <= 7200000;
    const absolute = Number.isSafeInteger(bonus.startsAtMs) && bonus.startsAtMs > 1e12;
    if (!context || input.source !== "source_tiktok" || input.test === true ||
      typeof input.id !== "string" || !input.id || input.id.length > 160 || input.id === "0" ||
      typeof input.battleId !== "string" || !/^[1-9]\d{0,19}$/.test(input.battleId) ||
      BigInt(input.battleId) > 18446744073709551615n || input.roomId !== context.roomId ||
      typeof input.channelUsername !== "string" || input.channelUsername.replace(/^@+/, "").toLowerCase() !== context.channelUsername ||
      !Number.isSafeInteger(input.receivedAtMs) || input.receivedAtMs < at - 5000 || input.receivedAtMs > at + 1000 ||
      bonus.result !== "available" || ![2, 3].includes(bonus.multiplier) ||
      !Number.isSafeInteger(bonus.durationMs) || bonus.durationMs <= 0 || bonus.durationMs > 3600000 ||
      (!absolute && !relative) || absolute && bonus.startsAtMs + bonus.durationMs <= at ||
      bonus.sourceStartsAtMs && (!Number.isSafeInteger(bonus.sourceStartsAtMs) || bonus.sourceStartsAtMs <= 1e12) ||
      bonus.createdAtMs && (!Number.isSafeInteger(bonus.createdAtMs) || bonus.createdAtMs < at - 30000 || bonus.createdAtMs > at + 1000)) return;
    const key = pendingStartKey(input, identity), previous = this.pendingStarts.get(key);
    if (this.blockedStarts.has(key) || this.blockedStarts.has(blockedStartBattleKey(input.battleId, identity)) ||
      previous && !samePendingContext(previous.context, context)) return;
    const saved = { source: input.source, id: input.id, battleId: input.battleId, roomId: input.roomId,
      channelUsername: input.channelUsername, receivedAtMs: input.receivedAtMs, bonus: {} };
    for (const field of ["stage", "multiplier", "startsAtMs", "sourceStartsAtMs", "startsBeforeEndMs", "durationMs", "result", "createdAtMs"]) {
      if (Object.hasOwn(bonus, field)) saved.bonus[field] = bonus[field];
    }
    this.pendingStarts.set(key, { identity, context: { ...context }, input: saved, expiresAtMs: previous?.expiresAtMs || at + 30000 });
    while (this.pendingStarts.size > 8) this.pendingStarts.delete(this.pendingStarts.keys().next().value);
    this.expirePendingStarts();
  }
  replayPendingStarts(battleId, identity) {
    this.expirePendingStarts();
    if (!this.pendingStarts.size) return;
    const current = this.current(), context = this.captureContext?.();
    if (!current || !current.openObserved || current.ownerVerified !== true || current.identity !== identity || current.battleId !== battleId) return;
    for (const [key, row] of this.pendingStarts) if (row.identity === identity && row.input.battleId === battleId) {
      this.pendingStarts.delete(key);
      if (samePendingContext(row.context, context) && context.ownerUserId === current.ownerUserId && current.roomId === context.roomId) {
        this.accept(row.input, identity, false, { ...context });
      }
    }
    this.expirePendingStarts();
  }
  observeGift(input, identity) {
    const current = this.current(), bonus = input.giftBonus, at = this.now();
    const exactId = (value) => typeof value === "string" && /^[1-9]\d{0,119}$/.test(value);
    if (!current || current.identity !== identity || current.ownerVerified !== true ||
      !exactId(current.ownerUserId) || !current.battleId || typeof current.roomId !== "string" || !current.roomId ||
      input.roomId !== current.roomId || input.battleId && input.battleId !== current.battleId ||
      !Number.isSafeInteger(current.startedAtMs) || current.startedAtMs <= 1e12 ||
      !Number.isSafeInteger(current.endsAtMs) || current.endsAtMs <= Math.max(current.startedAtMs, at) ||
      !Number.isSafeInteger(input.receivedAtMs) || input.receivedAtMs < at - 5000 || input.receivedAtMs > at ||
      !Number.isSafeInteger(input.createdAtMs) || input.createdAtMs < at - 5000 || input.createdAtMs > at + 1000 ||
      input.createdAtMs < current.startedAtMs - 1000 || !bonus || ![2, 3].includes(bonus.multiplier) ||
      !Array.isArray(bonus.recipientIds) || !bonus.recipientIds.length || bonus.recipientIds.length > 16 ||
      !bonus.recipientIds.every((id) => exactId(id) && id === current.ownerUserId)) return false;
    // A real gift proves only the multiplier applied to that gift, not a new
    // thirty-second period. It covers the first unannounced boost once per
    // value in the battle; known task periods keep their independent identity.
    this.reconcile();
    // The credited gift proves activation only inside one already-announced
    // window bound to this broadcaster. Its end still comes from TikTok.
    const candidates = [...this.periods.values()].filter((row) => row.identity === identity && row.battleId === current.battleId &&
      ["pending", "success"].includes(row.result) && row.multiplier === bonus.multiplier && row.durationMs > 0 &&
      row.ownerUserId === current.ownerUserId && row.ownerRoomId === current.roomId &&
      row.ownerTeams === current.ownerTeams && row.matchStartedAtMs === current.startedAtMs &&
      row.startsAtMs >= current.startedAtMs && row.startsAtMs <= input.createdAtMs && row.startsAtMs <= at &&
      row.startsAtMs + row.durationMs > at && row.startsAtMs + row.durationMs <= current.endsAtMs);
    if (candidates.length === 1 && candidates[0].result === "pending" &&
      this.periods.get(this.activeKey)?.multiplier !== bonus.multiplier) {
      Object.assign(candidates[0], { result: "success", awaitingSettlement: true, requiresVerifiedOwner: true, mergeScope: ownerScope(current) });
      this.reconcile(); return true;
    }
    // Unknown duration: keep a labelled observation separate from active state.
    // It never creates a reward period, nor keeps an automation alive.
    if (!this.activeKey) this.onObservation?.({ value: bonus.multiplier, observedAtMs: input.createdAtMs });
    const valueKey = JSON.stringify([identity, current.battleId, bonus.multiplier]);
    if (this.giftValues.has(valueKey)) return false;
    if ([...this.periods.values()].some((row) => row.identity === identity && row.battleId === current.battleId &&
      (row.fired && row.multiplier === bonus.multiplier || row.result === "success" && [2, 3].includes(row.multiplier) && row.startsAtMs > 0 && row.startsAtMs <= at &&
        (!row.durationMs || row.startsAtMs + row.durationMs > at) &&
        (!row.ownerUserId || row.ownerUserId === current.ownerUserId) &&
        (!row.ownerRoomId || row.ownerRoomId === current.roomId) &&
        (!row.ownerTeams || row.ownerTeams === current.ownerTeams)))) return false;
    const expiresAtMs = Math.min(input.receivedAtMs + 5000, input.createdAtMs + 5000, current.endsAtMs);
    if (expiresAtMs <= at) return false;
    this.giftProof = { key: `${current.battleId}:gift-observed:${bonus.multiplier}`, identity, battleId: current.battleId,
      ownerUserId: current.ownerUserId, ownerRoomId: current.roomId, ownerTeams: current.ownerTeams,
      startedAtMs: current.startedAtMs, expiresAtMs };
    this.giftValues.add(valueKey);
    while (this.giftValues.size > 64) this.giftValues.delete(this.giftValues.values().next().value);
    this.onStart(bonus.multiplier, this.giftProof.key);
    return true;
  }
  attachBattle(battleId, identity, startedAtMs) {
    for (const period of this.periods.values()) if (period.battleId === battleId && period.identity === identity && period.buffered) {
      if (startedAtMs > period.announcedAtMs + 30000) period.result = "ended";
      period.buffered = false;
    }
    this.replayPendingStarts(battleId, identity);
  }
  mergeVisualPeriod(period) {
    const current = this.current();
    const bound = (row) => row && row.result === "success" && [2, 3].includes(row.multiplier) && row.durationMs > 0 &&
      row.identity === current?.identity && row.battleId === current.battleId &&
      row.ownerUserId === current.ownerUserId && row.ownerRoomId === current.roomId && row.ownerTeams === current.ownerTeams &&
      row.mergeScope === ownerScope(current) &&
      (!row.requiresVerifiedOwner || row.matchStartedAtMs === current.startedAtMs);
    if (!current || current.ownerVerified !== true || !current.roomId || !current.ownerUserId || !bound(period)) return period;
    const incomingVisual = period.origin === "visual" && !period.formalBound;
    const other = [...this.periods.values()].find((row) => row !== period && bound(row) &&
      (incomingVisual ? row.origin !== "visual" || row.formalBound : row.origin === "visual" && !row.formalBound) &&
      row.multiplier === period.multiplier &&
      Math.abs(row.startsAtMs + row.durationMs - period.startsAtMs - period.durationMs) <= 2000 &&
      Math.max(row.startsAtMs, period.startsAtMs) < Math.min(row.startsAtMs + row.durationMs, period.startsAtMs + period.durationMs) &&
      (incomingVisual ? row.startsAtMs <= (period.visualStartsAtMs || period.startsAtMs) + 1000 :
        period.startsAtMs <= (row.visualStartsAtMs || row.startsAtMs) + 1000));
    if (!other) return period;
    const visual = incomingVisual ? period : other, formal = incomingVisual ? other : period;
    // Retain the first fired key: a queued visual effect's async guard must
    // remain valid after the exact formal period arrives. A pending forecast
    // never enters this merge, and two formal cycles are never combined.
    const retained = visual.fired ? visual : formal.fired ? formal : visual;
    const removed = retained === visual ? formal : visual;
    const visualStartsAtMs = visual.visualStartsAtMs || visual.startsAtMs;
    for (const alias of removed.aliases) retained.aliases.add(alias);
    Object.assign(retained, { multiplier: formal.multiplier, startsAtMs: formal.startsAtMs, durationMs: formal.durationMs,
      startsBeforeEndMs: 0, result: "success", formalBound: true, visualStartsAtMs,
      ownerUserId: visual.ownerUserId, ownerRoomId: visual.ownerRoomId, ownerTeams: visual.ownerTeams,
      requiresVerifiedOwner: true, matchStartedAtMs: visual.matchStartedAtMs, fired: visual.fired || formal.fired });
    if (formal.captureScope || visual.captureScope) retained.captureScope = formal.captureScope || visual.captureScope;
    if (this.activeKey === removed.key) this.activeKey = retained.key;
    this.periods.delete(removed.key);
    return retained;
  }
  accept(input, identity, buffered = false, captureScope = null) {
    const bonus = input.bonus;
    if (!bonus || !["announced", "settled", "ended", "available", "start-bonus"].includes(bonus.stage) || !input.battleId) return;
    if (buffered && (bonus.stage === "ended" || bonus.stage === "settled" && bonus.result === "failed")) this.discardPendingStarts(input.battleId, identity, true);
    if (bonus.stage === "start-bonus") {
      if (this.blockedStarts.has(pendingStartKey(input, identity)) || this.blockedStarts.has(blockedStartBattleKey(input.battleId, identity))) return;
      if (buffered) { this.bufferStartBonus(input, identity); return; }
    }
    const at = this.now(), battleId = String(input.battleId);
    const beforeEnd = Number.isSafeInteger(bonus.startsBeforeEndMs) && bonus.startsBeforeEndMs > 0 && bonus.startsBeforeEndMs <= 7200000 ? bonus.startsBeforeEndMs : 0;
    let availableOwner;
    let startBonusAtMs = 0;
    if (bonus.stage === "start-bonus") {
      availableOwner = this.current();
      if (buffered || !availableOwner || availableOwner.identity !== identity || availableOwner.battleId !== battleId ||
        availableOwner.ownerVerified !== true ||
        typeof availableOwner.ownerUserId !== "string" || !availableOwner.ownerUserId ||
        typeof availableOwner.roomId !== "string" || !availableOwner.roomId || input.roomId !== availableOwner.roomId ||
        bonus.result !== "available" || ![2, 3].includes(bonus.multiplier) ||
        !Number.isSafeInteger(bonus.durationMs) || bonus.durationMs <= 0 || bonus.durationMs > 3600000 ||
        !Number.isSafeInteger(availableOwner.startedAtMs) || availableOwner.startedAtMs <= 1e12 ||
        !Number.isSafeInteger(availableOwner.endsAtMs) || availableOwner.endsAtMs <= availableOwner.startedAtMs) return;
      startBonusAtMs = Number.isSafeInteger(bonus.startsAtMs) && bonus.startsAtMs > 1e12 ? bonus.startsAtMs :
        bonus.startsAtMs === 0 && beforeEnd ? countdownEnd(availableOwner) - beforeEnd : 0;
      const end = startBonusAtMs + bonus.durationMs;
      if (!Number.isSafeInteger(startBonusAtMs) || startBonusAtMs < availableOwner.startedAtMs ||
        !Number.isSafeInteger(end) || end > availableOwner.endsAtMs || end <= at) return;
    }
    if (bonus.stage === "available") {
      availableOwner = this.current();
      const end = bonus.startsAtMs + bonus.durationMs;
      if (buffered || !availableOwner || availableOwner.identity !== identity || availableOwner.battleId !== battleId ||
        availableOwner.ownerVerified !== true ||
        typeof availableOwner.roomId !== "string" || !availableOwner.roomId || input.roomId !== availableOwner.roomId ||
        typeof bonus.ownerUserId !== "string" || !bonus.ownerUserId || bonus.ownerUserId !== availableOwner.ownerUserId ||
        bonus.result !== "available" || typeof bonus.periodKey !== "string" || !/^[A-Za-z0-9:_-]{1,180}$/.test(bonus.periodKey) ||
        ![2, 3].includes(bonus.multiplier) || !Number.isSafeInteger(bonus.startsAtMs) || bonus.startsAtMs <= 1e12 ||
        !Number.isSafeInteger(bonus.durationMs) || bonus.durationMs <= 0 || bonus.durationMs > 3600000 ||
        !Number.isSafeInteger(availableOwner.startedAtMs) || availableOwner.startedAtMs <= 1e12 ||
        !Number.isSafeInteger(availableOwner.endsAtMs) || availableOwner.endsAtMs <= availableOwner.startedAtMs ||
        bonus.startsAtMs < availableOwner.startedAtMs || !Number.isSafeInteger(end) || end > availableOwner.endsAtMs || end <= at) return;
    }
    const sourceTime = Number.isSafeInteger(bonus.sourceStartsAtMs) && bonus.sourceStartsAtMs > 1e12 ? bonus.sourceStartsAtMs : bonus.startsAtMs;
    const token = String(bonus.stage === "start-bonus" ? sourceTime > 0 ? `server:${sourceTime}` : `remaining:${beforeEnd}` :
      bonus.periodKey || (Number.isFinite(sourceTime) && sourceTime > 0 ? `server:${sourceTime}` : beforeEnd ? `remaining:${beforeEnd}` : "")).slice(0, 180);
    for (const [key, row] of this.periods) if (at - row.announcedAtMs > (row.buffered ? 30000 : 7200000) && key !== this.activeKey) this.periods.delete(key);
    const candidates = [...this.periods.values()].filter((row) => row.identity === identity && row.battleId === battleId);
    let period = token ? candidates.find((row) => row.aliases.has(token)) : null;
    if (["available", "start-bonus"].includes(bonus.stage)) {
      // HTTP availability and the explicit wire target START_BONUS are not
      // donor events or inferred task success. Their period proof is stable.
      if (period && (["ended", "failed"].includes(period.result) ||
        period.ownerUserId && period.ownerUserId !== availableOwner.ownerUserId ||
        period.ownerRoomId && period.ownerRoomId !== availableOwner.roomId ||
        period.ownerTeams && period.ownerTeams !== availableOwner.ownerTeams)) return;
      if (!period) {
        period = { key: `${battleId}:${++this.sequence}`, sequence: this.sequence, identity, battleId, buffered: false,
          aliases: new Set(), announcedAtMs: at, fired: false };
        this.periods.set(period.key, period);
      }
      period.aliases.add(token);
      if (bonus.origin === "visual" && period.formalBound) { this.reconcile(); return; }
      const startsAtMs = bonus.stage === "start-bonus" && !bonus.startsAtMs && period.startsAtMs > 0 ? period.startsAtMs : startBonusAtMs || bonus.startsAtMs;
      Object.assign(period, { multiplier: bonus.multiplier, startsAtMs, startsBeforeEndMs: 0,
        durationMs: bonus.durationMs, result: "success", ownerUserId: availableOwner.ownerUserId, ownerTeams: availableOwner.ownerTeams,
        ownerRoomId: availableOwner.roomId, requiresVerifiedOwner: true, matchStartedAtMs: availableOwner.startedAtMs,
        mergeScope: ownerScope(availableOwner) });
      if (captureScope) period.captureScope = captureScope;
      if (bonus.origin === "visual") { period.origin = "visual"; period.visualStartsAtMs ||= startsAtMs; }
    } else if (bonus.stage === "announced") {
      if (!period) {
        period = { key: `${battleId}:${++this.sequence}`, sequence: this.sequence, identity, battleId, buffered, aliases: new Set(), announcedAtMs: at,
          multiplier: null, startsAtMs: 0, durationMs: 0, result: "pending", fired: false };
        this.periods.set(period.key, period);
      }
      const owner = this.current();
      if (owner?.identity === identity && owner.battleId === battleId && owner.ownerVerified === true &&
        input.roomId === owner.roomId && !period.ownerUserId) {
        Object.assign(period, { ownerUserId: owner.ownerUserId, ownerRoomId: owner.roomId, ownerTeams: owner.ownerTeams,
          matchStartedAtMs: owner.startedAtMs });
      }
      if (token) period.aliases.add(token);
      if ([2, 3].includes(bonus.multiplier)) period.multiplier = bonus.multiplier;
      if (Number.isFinite(bonus.startsAtMs) && bonus.startsAtMs > 0 && period.result === "pending") period.startsAtMs = bonus.startsAtMs;
      if (beforeEnd && period.result === "pending") period.startsBeforeEndMs = beforeEnd;
      if (Number.isFinite(bonus.durationMs) && bonus.durationMs > 0) period.durationMs = Math.min(3600000, bonus.durationMs);
    } else {
      // SETTLE omet le multiplicateur. Son vrai début peut différer de la
      // prévision START : associer la dernière annonce encore en attente.
      if (!period && bonus.stage === "ended") {
        period = candidates.find((row) => row.key === this.activeKey);
        // REWARD_SETTLE n'identifie pas la période dans le SDK. Un ancien
        // paquet retardé ne peut pas couper le bonus suivant déjà commencé.
        if (period && (bonus.createdAtMs > 0 && bonus.createdAtMs < period.startsAtMs ||
          !bonus.createdAtMs && candidates.filter((row) => row.fired).length > 1)) return;
      }
      if (!period && bonus.stage !== "ended") period = candidates.filter((row) => (row.result === "pending" || row.awaitingSettlement) &&
        (!bonus.startsAtMs || bonus.startsAtMs >= row.announcedAtMs - 10000)).sort((a, b) => b.sequence - a.sequence)[0];
      if (!period) return; // Jamais inventer ×2 si START n'a pas été reçu.
      if (token) period.aliases.add(token);
      if (bonus.stage === "ended") { period.result = "ended"; period.awaitingSettlement = false; }
      else if (["success", "both", "failed"].includes(bonus.result)) {
        // Une fin/échec est terminal pour ce cycle, même si un SETTLE ancien
        // arrive ensuite sous un autre msgId.
        if (!["ended", "failed"].includes(period.result)) {
          period.result = bonus.result === "failed" ? "failed" : "success";
          period.awaitingSettlement = false;
          const current = this.current();
          if (current?.identity === identity && current.battleId === battleId && !period.ownerUserId) {
            period.ownerUserId = current.ownerUserId; period.ownerTeams = current.ownerTeams;
          }
          if (current?.identity === identity && current.battleId === battleId && current.ownerVerified === true &&
            input.roomId === current.roomId && period.ownerUserId === current.ownerUserId) {
            period.ownerRoomId = current.roomId; period.mergeScope ||= ownerScope(current);
          }
          if (Number.isFinite(bonus.startsAtMs) && bonus.startsAtMs > 0) { period.startsAtMs = bonus.startsAtMs; period.startsBeforeEndMs = 0; }
          else if (beforeEnd) { period.startsAtMs = 0; period.startsBeforeEndMs = beforeEnd; }
          else if (!period.startsAtMs && !period.startsBeforeEndMs) period.startsAtMs = at;
        }
      }
    }
    period = this.mergeVisualPeriod(period);
    while (this.periods.size > 32) {
      const key = [...this.periods.keys()].find((entry) => entry !== this.activeKey);
      if (!key) break; this.periods.delete(key);
    }
    while (period.aliases.size > 8) period.aliases.delete(period.aliases.values().next().value);
    this.reconcile();
  }
  reconcile() {
    const current = this.current();
    if (!current) { this.clearTimer("start"); this.clearTimer("end"); this.activeKey = ""; return; }
    const now = this.now();
    this.clearTimer("start"); this.clearTimer("end");
    for (const row of this.periods.values()) if (row.identity === current.identity && row.battleId === current.battleId &&
      !row.startsAtMs && row.startsBeforeEndMs && current.endsAtMs > 1e12) row.startsAtMs = countdownEnd(current) - row.startsBeforeEndMs;
    const rows = [...this.periods.values()].filter((row) => row.identity === current.identity && row.battleId === current.battleId &&
      (!row.ownerRoomId || row.ownerRoomId === current.roomId) &&
      (!row.requiresVerifiedOwner || current.ownerVerified === true) &&
      (!row.requiresVerifiedOwner || row.matchStartedAtMs === current.startedAtMs) &&
      (!row.captureScope || samePendingContext(row.captureScope, this.captureContext?.())) &&
      (!row.ownerUserId || row.ownerUserId === current.ownerUserId) &&
      (row.requiresVerifiedOwner ? row.ownerTeams === current.ownerTeams : !row.ownerTeams || row.ownerTeams === current.ownerTeams) &&
      row.result === "success" && [2, 3].includes(row.multiplier) && row.startsAtMs > 0 &&
      (!current.startedAtMs || row.startsAtMs >= current.startedAtMs - 10000) &&
      (!current.endsAtMs || row.startsAtMs < current.endsAtMs));
    const endOf = (row) => Math.min(row.durationMs ? row.startsAtMs + row.durationMs : Infinity, current.endsAtMs || Infinity);
    const active = rows.filter((row) => row.startsAtMs <= now && endOf(row) > now)
      .sort((a, b) => b.startsAtMs - a.startsAtMs || b.announcedAtMs - a.announcedAtMs)[0];
    const activeKey = active?.key || "";
    const changed = activeKey !== this.activeKey;
    this.activeKey = activeKey;
    if (changed) this.onChange(active?.multiplier || 1);
    if (active && !active.ownerUserId) active.ownerUserId = current.ownerUserId;
    if (active && !active.ownerTeams && !active.requiresVerifiedOwner) active.ownerTeams = current.ownerTeams;
    if (active && !active.fired) { active.fired = true; this.onStart(active.multiplier, active.key); }
    if (active && Number.isFinite(endOf(active))) this.timer("end", endOf(active) - now, () => this.reconcile());
    const future = rows.filter((row) => row.startsAtMs > now && endOf(row) > row.startsAtMs).sort((a, b) => a.startsAtMs - b.startsAtMs)[0];
    if (future) this.timer("start", future.startsAtMs - now, () => this.reconcile());
    if (changed) this.publish();
  }
}

module.exports = { MatchBonuses };
