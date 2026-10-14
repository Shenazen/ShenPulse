"use strict";

/** Matchs LIVE par compte/profil : observation réelle, réactions explicites.
 * Aucun événement de test ne modifie les scores, l’historique ou les victoires.
 * Files, déduplication, donateurs et historique sont bornés ; aucun polling à
 * l’arrêt. Les actions utilisent le même garde que les commandes existantes.
 */
const { randomUUID } = require("node:crypto");
const { readState } = require("../state-projection");
const { assertProFeatureAccess, createProFeatureGuard } = require("../pro-feature-access");
const { hasAuthenticatedAccount } = require("../account-access");
const { hasProAccess } = require("../../shared/pro-access");
const { normalizeMatchesConfig, normalizeMatchAutomation, createMatchSession, MATCH_WIDGETS } = require("../../shared/matches-contract");
const { CommandExecutor } = require("../commands/executor");
const { projectMatchesOverlayState } = require("../matches-overlay-state");
const { giftEventCount } = require("../rule-engine");

const PATHS = ["settings.matches", "matchSession", "settings.account.uid", "session.profileId", "session.running", "session.startedAt",
  "settings.tiktok.roomId", "settings.tiktok.username", "settings.tiktok.status", "settings.tiktok.broadcaster", "commerce.subscription", "settings.siteVisibility"];
const signature = (value) => JSON.stringify(value);
const clone = (value) => structuredClone(value);
const ACTION_CONTEXT_PATHS = [...PATHS.filter((key) => key !== "matchSession"), "matchSession.battleId", "matchSession.status", "matchSession.result", "matchSession.scope", "matchSession.endsAtMs", "matchSession.participants"];
const LIVE_CONTEXT_PATHS = ACTION_CONTEXT_PATHS.filter((key) => !["settings.matches", "matchSession.participants", "matchSession.endsAtMs"].includes(key));
function mismatch() { const error = new Error("Le compte ou le profil du match a changé."); error.code = "FEATURE_CONTEXT_CHANGED"; return error; }
function scope(state) { return { uid: state.settings?.account?.uid || "", profileId: state.session?.profileId || "", roomId: state.settings?.tiktok?.roomId || "" }; }
function assertExpectedScope(state, expected) {
  if (expected && (String(expected.ownerUid || "") !== state.settings?.account?.uid || String(expected.profileId || "") !== state.session?.profileId)) throw mismatch();
}
function identifiedDuo(runtime) {
  const own = runtime.participants.find((entry) => entry.own), rival = runtime.participants.find((entry) => !entry.own);
  return runtime.participants.length === 2 && own?.id && rival?.id && own.id !== rival.id ? { own, rival } : null;
}
function comparison(runtime) {
  const duo = identifiedDuo(runtime); if (!duo || duo.own.score == null || duo.rival.score == null) return null;
  return { ...duo, difference: duo.own.score - duo.rival.score };
}
function eligibleMoment(state, moment, now) {
  const runtime = state.matchSession;
  if (!state.session?.running || state.settings?.tiktok?.status !== "live" || !runtime?.battleId) return false;
  if (moment === "victory" || moment === "defeat") return runtime.status === "finished" && runtime.result === (moment === "victory" ? "win" : "lose");
  return runtime.status === "running" && (!runtime.endsAtMs || runtime.endsAtMs > now);
}

class MatchesService {
  constructor({ store, actionRunner, overlayServer, onChanged = () => {}, onActivity = () => {}, now = Date.now,
    setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout }) {
    Object.assign(this, { store, actionRunner, overlayServer, onChanged, onActivity, now, setTimeoutImpl, clearTimeoutImpl });
    this.executor = new CommandExecutor({ store, actionRunner, accessSection: "matches" });
    this.identity = ""; this.seen = new Set(); this.cooldowns = new Map(); this.timers = new Map(); this.likes = [];
    this.pending = []; this.processing = false; this.completion = Promise.resolve(); this.generation = 0;
  }
  state() { return readState(this.store, PATHS); }
  status() {
    const state = this.state(), current = scope(state);
    const runtime = signature(state.matchSession?.scope) === signature(current) ? clone(state.matchSession) : createMatchSession(state.matchSession);
    return { config: normalizeMatchesConfig(state.settings?.matches), runtime, capabilities: { battle: true, scores: true, multiplier: true, cards: false } };
  }
  reset() {
    this.generation += 1; this.pending = []; this.likes = []; this.seen.clear(); this.cooldowns.clear();
    for (const timer of this.timers.values()) this.clearTimeoutImpl(timer);
    this.timers.clear(); this.identity = "";
  }
  disconnect() {
    this.reset();
    try { assertProFeatureAccess(this.store, "matches"); } catch { return; }
    this.mutate((next) => { if (next.matchSession?.status === "running") next.matchSession.status = "disconnected"; if (next.matchSession) next.matchSession.multiplier = 1; }); this.publish();
  }
  mutate(callback, durable = false) {
    const operation = durable || typeof this.store.mutateRuntime !== "function" ? "mutate" : "mutateRuntime";
    this.store[operation]((state) => callback(state), durable);
  }
  publish() {
    if (this.timers.has("publish")) { this.clearTimeoutImpl(this.timers.get("publish")); this.timers.delete("publish"); }
    const state = this.state(); this.overlayServer?.publish?.("match-state", projectMatchesOverlayState(state, this.now())); this.onChanged(true);
  }
  publishDeferred() {
    if (this.timers.has("publish")) return;
    const expectedScope = signature(scope(this.state())), generation = this.generation;
    const guard = createProFeatureGuard(this.store, "matches");
    this.timer("publish", 16, () => {
      try { guard(); } catch { return; }
      const state = this.state();
      if (generation !== this.generation || expectedScope !== signature(scope(state)) || !state.session?.running || state.settings?.tiktok?.status !== "live") return;
      this.publish();
    });
  }
  saveConfig(input, expected) {
    assertProFeatureAccess(this.store, "matches"); const state = this.state(); assertExpectedScope(state, expected);
    const current = normalizeMatchesConfig(state.settings?.matches), widgets = { ...current.widgets };
    for (const { id } of MATCH_WIDGETS) if (input?.widgets?.[id]) widgets[id] = { ...widgets[id], ...input.widgets[id] };
    const config = normalizeMatchesConfig({ ...current, widgets });
    this.mutate((next) => { next.settings.matches = config; }, true); this.publish(); return this.status();
  }
  validateReaction(item) {
    const reactions = item.reaction.type === "bundle" ? item.reaction.reactions : [item.reaction];
    if (!reactions.length) throw new Error("Choisissez une animation, une vidéo, un son ou une action avant d’activer cette automatisation.");
    for (const reaction of reactions) {
      if (reaction.type === "action") this.executor.validateTargets({ id: item.id, execution: { type: "action", actionId: reaction.actionId } });
      else this.executor.collectAction(this.executor.state(), this.actionFor(item, reaction));
    }
    return true;
  }
  saveAutomation(input, expected) {
    assertProFeatureAccess(this.store, "matches"); const state = this.state(); assertExpectedScope(state, expected);
    const item = normalizeMatchAutomation({ ...input, id: input?.id || randomUUID() });
    if (item.enabled && item.moment === "card") throw new Error("La détection automatique des cartes n’est pas disponible avec le connecteur actuel. Le test manuel reste possible.");
    if (item.enabled) this.validateReaction(item);
    const config = normalizeMatchesConfig(state.settings?.matches), index = config.automations.findIndex((entry) => entry.id === item.id);
    if (index < 0 && config.automations.length >= 100) throw new Error("Le profil contient déjà 100 automatisations de match.");
    if (index < 0) config.automations.push(item); else config.automations[index] = item;
    this.mutate((next) => { next.settings.matches = config; }, true); this.reschedule(); this.publish(); return this.status();
  }
  removeAutomation(id, expected) {
    assertProFeatureAccess(this.store, "matches"); const state = this.state(); assertExpectedScope(state, expected);
    const config = normalizeMatchesConfig(state.settings?.matches); config.automations = config.automations.filter((entry) => entry.id !== String(id));
    this.mutate((next) => { next.settings.matches = config; }, true); this.reschedule(); this.publish(); return this.status();
  }
  resetWins(expected) {
    return this.adjustWins({ operation: "set", amount: 0 }, expected);
  }
  adjustWins(input, expected) {
    assertProFeatureAccess(this.store, "matches"); const state = this.state(); assertExpectedScope(state, expected);
    const amount = Number(input?.amount); if (!Number.isInteger(amount) || Math.abs(amount) > 100000 || !["set", "adjust"].includes(input?.operation)) throw new Error("Correction de manches invalide.");
    this.mutate((next) => { next.matchSession ||= createMatchSession();
      const runtime = next.matchSession, duo = identifiedDuo(runtime);
      if (duo) {
        runtime.pairRounds ||= []; let pair = runtime.pairRounds.find((entry) => entry.opponentId === duo.rival.id);
        if (!pair) { pair = { opponentId: duo.rival.id, own: 0, opponent: 0 }; runtime.pairRounds.push(pair); }
        pair.own = Math.max(0, Math.min(100000, input.operation === "set" ? amount : pair.own + amount)); runtime.rounds = { own: pair.own, opponent: pair.opponent };
      } else runtime.manualWins = Math.max(0, Math.min(100000, input.operation === "set" ? amount : Number(runtime.manualWins ?? runtime.session.wins) + amount));
    }, true);
    this.publish(); return this.status();
  }
  resetContributors(expected) {
    assertProFeatureAccess(this.store, "matches"); assertExpectedScope(this.state(), expected);
    this.mutate((next) => { next.matchSession ||= createMatchSession(); next.matchSession.liveContributors = []; next.matchSession.lastGift = null; next.matchSession.lastContribution = null; }, true);
    this.publish(); return this.status();
  }
  actionFor(item, reaction = item.reaction) {
    const id = `match_${item.id}_${reaction.type}`;
    if (reaction.type === "animation") return { id, type: "overlay.match", config: { ...reaction } };
    if (reaction.type === "sound") return { id, type: "audio.play", config: { ...reaction } };
    return { id, type: "overlay.media", config: { ...reaction } };
  }
  async runReaction(item, { test = false, capturedScope = scope(this.state()), battleId = "" } = {}) {
    const generation = this.generation, expectedSignature = signature(item);
    const guard = createProFeatureGuard(this.store, "matches");
    const shouldExecute = () => {
      try { guard(); } catch { return false; }
      const fresh = readState(this.store, ACTION_CONTEXT_PATHS); if (generation !== this.generation || signature(scope(fresh)) !== signature(capturedScope)) return false;
      const current = normalizeMatchesConfig(fresh.settings?.matches).automations.find((entry) => entry.id === item.id);
      return Boolean(current && signature(current) === expectedSignature && (test || current.enabled && fresh.matchSession?.battleId === battleId && eligibleMoment(fresh, current.moment, this.now())));
    };
    if (!shouldExecute()) throw mismatch();
    const event = { source: test ? "match-preview" : "match-automation", type: "match", overlayTarget: "match", user: { name: "ShenPulse", displayName: "Match LIVE" }, data: { moment: item.moment },
      event: { type: "match", data: { moment: item.moment } }, shouldExecute };
    const executeOne = async (reaction) => {
      if (!shouldExecute()) throw mismatch();
      if (reaction.type === "action") return this.executor.execute({ id: item.id, execution: { type: "action", actionId: reaction.actionId } }, event, { shouldExecute });
      return this.actionRunner.run(this.actionFor(item, reaction), { ...event, assertActionAllowed: (current) => {
        if (!shouldExecute()) throw mismatch(); this.executor.assertAction(this.executor.state(), current);
      } });
    };
    let result;
    if (item.reaction.type !== "bundle") result = await executeOne(item.reaction);
    else {
      const outputs = item.reaction.reactions;
      if (!outputs.length) throw new Error("Aucune sortie de match configurée.");
      const settled = await Promise.allSettled(outputs.map(executeOne));
      const successes = settled.filter((entry) => entry.status === "fulfilled");
      if (!successes.length) throw settled[0].reason;
      result = { executed: true, outputCount: successes.length, partial: successes.length !== outputs.length,
        queued: successes.some((entry) => entry.value?.queued === true), results: successes.map((entry) => entry.value) };
    }
    return shouldExecute() ? result : { stale: true };
  }
  async testAutomation(id, expected) {
    assertProFeatureAccess(this.store, "matches"); const state = this.state(); assertExpectedScope(state, expected);
    const item = normalizeMatchesConfig(state.settings?.matches).automations.find((entry) => entry.id === String(id));
    if (!item) throw new Error("Cette automatisation n’existe plus dans le profil.");
    this.validateReaction(item); return this.runReaction(item, { test: true });
  }
  testWidget(key, expected) {
    assertProFeatureAccess(this.store, "matches"); const state = this.state(); assertExpectedScope(state, expected);
    if (!MATCH_WIDGETS.some((entry) => entry.id === key)) throw new Error("Widget de match invalide.");
    const guard = createProFeatureGuard(this.store, "matches"); const expiresAtMs = this.now() + 5000;
    this.mutate((next) => {
      if (signature(next.matchSession?.scope) !== signature(scope(next))) next.matchSession = { ...createMatchSession(next.matchSession), scope: scope(next) };
      next.matchSession.preview = { widget: key, expiresAtMs };
    });
    this.publish(); this.timer("preview", 5000, () => {
      try { guard(); } catch { return; }
      this.mutate((next) => { if (next.matchSession?.preview?.expiresAtMs === expiresAtMs) delete next.matchSession.preview; }); this.publish();
    }); return this.status();
  }
  timer(key, ms, callback) {
    if (this.timers.has(key)) this.clearTimeoutImpl(this.timers.get(key));
    const timer = this.setTimeoutImpl(() => { this.timers.delete(key); callback(); }, Math.max(0, ms)); timer?.unref?.(); this.timers.set(key, timer);
  }
  handle(input = {}) {
    if (input.source && input.source !== "source_tiktok" || !["start", "update", "end", "cancel", "task", "punish"].includes(input.phase)) return false;
    if (!hasAuthenticatedAccount(this.store)) return false;
    const state = this.state(); if (!hasProAccess(state) || !state.session?.running || state.settings?.tiktok?.status !== "live") return false;
    try { assertProFeatureAccess(this.store, "matches"); } catch { return false; }
    const currentScope = scope(state); if (input.roomId && input.roomId !== currentScope.roomId) return false;
    if (input.channelUsername && String(input.channelUsername).replace(/^@/, "").toLowerCase() !== String(state.settings.tiktok.username || "").replace(/^@/, "").toLowerCase()) return false;
    const identity = signature(currentScope); if (identity !== this.identity) { this.reset(); this.identity = identity; }
    if (input.id) { const key = `${input.phase}:${input.id}`; if (this.seen.has(key)) return false;
      this.seen.add(key); while (this.seen.size > 2000) this.seen.delete(this.seen.values().next().value); }
    if (!input.battleId || input.phase === "punish") return false;
    const old = signature(state.matchSession?.scope) === identity ? state.matchSession : createMatchSession(state.matchSession);
    const newBattle = old.battleId !== input.battleId;
    // Reconnexion ou match rejoint en cours : le SDK peut fournir les scores
    // sans renvoyer OPEN. Ses dates doivent prouver un match plus récent ; un
    // ancien paquet retardé ne remplace jamais le match courant. Cette reprise
    // n'invente pas le moment « début », ni un résultat final.
    if (newBattle && old.battleId && input.phase !== "start" && !(input.phase === "update" &&
      input.startsAtMs > old.startedAtMs && input.startsAtMs <= this.now() + 60000 && input.endsAtMs > this.now() &&
      (input.participants || []).some((entry) => entry.score != null))) return false;
    if (newBattle && old.history.some((entry) => entry.battleId === input.battleId)) return false;
    if (newBattle && input.phase === "start" && old.startedAtMs && input.startsAtMs && input.startsAtMs < old.startedAtMs) return false;
    if (!old.battleId && ["task", "cancel"].includes(input.phase)) return false;
    if (!newBattle && old.status === "finished" && input.phase !== "end") return false;
    const before = newBattle ? null : comparison(old), moments = [];
    this.mutate((next) => {
      let runtime = signature(next.matchSession?.scope) === identity ? next.matchSession : createMatchSession(next.matchSession);
      if (!runtime.battleId || runtime.battleId !== input.battleId) {
        runtime = { ...createMatchSession(runtime), scope: currentScope, status: "running", battleId: input.battleId,
          startedAtMs: input.startsAtMs || input.receivedAtMs, endsAtMs: input.endsAtMs || 0,
          liveContributors: runtime.liveContributors || [], lastGift: runtime.lastGift || null, lastContribution: runtime.lastContribution || null };
        runtime.session.battles += 1; if (input.phase === "start") moments.push("battleStart");
      }
      if (input.endsAtMs) runtime.endsAtMs = input.endsAtMs;
      if (["start", "update"].includes(input.phase) && runtime.status === "disconnected") runtime.status = "running";
      if (input.startsAtMs) runtime.startedAtMs = input.startsAtMs;
      const rows = new Map(runtime.participants.map((entry) => [entry.id, entry]));
      const username = String(next.settings.tiktok.broadcaster?.username || next.settings.tiktok.username || "").replace(/^@/, "").toLowerCase();
      const ownerId = String(next.settings.tiktok.broadcaster?.userId || next.settings.tiktok.broadcaster?.id || "");
      for (const row of input.participants || []) {
        const previous = rows.get(row.id) || {}; const known = Object.fromEntries(Object.entries(row).filter(([key, value]) => value !== null && value !== "" && !(key === "donors" && !value.length)));
        const merged = { ...previous, ...known, own: Boolean(ownerId && row.id === ownerId || username && (row.username || previous.username || "").toLowerCase() === username) };
        rows.set(row.id, merged);
      }
      runtime.participants = [...rows.values()].slice(0, 16); runtime.ownUserId = runtime.participants.find((entry) => entry.own)?.id || "";
      const after = comparison(runtime);
      const duo = identifiedDuo(runtime);
      if (duo) {
        const pair = runtime.pairRounds.find((entry) => entry.opponentId === duo.rival.id);
        runtime.rounds = { own: pair?.own || 0, opponent: pair?.opponent || 0 };
      }
      if (before && after && before.difference <= 0 && after.difference > 0) {
        moments.push("lead"); if (before.difference < 0) moments.push("comeback");
      }
      if (after?.difference === 0 && runtime.status === "running") moments.push("tieEnd");
      if (input.rewardFinished) runtime.multiplier = 1;
      if (input.multiplier && (!input.rewardStartsAtMs || input.rewardStartsAtMs <= this.now()) && runtime.multiplier !== input.multiplier) {
        runtime.multiplier = input.multiplier; moments.push(`multiplierX${input.multiplier}`);
      }
      runtime.lastEventAtMs = input.receivedAtMs || this.now();
      if (input.phase === "cancel") runtime.status = "disconnected";
      if (input.phase === "end") {
        runtime.status = "finished";
        runtime.endedAtMs = this.now();
        // Une fin muette ne transforme jamais les scores précédents en
        // résultat final. Seul le paquet END courant constitue une preuve.
        const ownEnd = (input.participants || []).find((entry) => entry.id === runtime.ownUserId);
        const rivalEnd = after && (input.participants || []).find((entry) => entry.id === after.rival.id);
        const finalScores = input.confirmedEnd && after && ownEnd?.score != null && rivalEnd?.score != null;
        const incomingResult = input.confirmedEnd && ownEnd?.result || (finalScores ? ownEnd.score > rivalEnd.score ? "win" : ownEnd.score < rivalEnd.score ? "lose" : "draw" : null);
        let history = runtime.history.find((entry) => entry.battleId === runtime.battleId);
        if (!history) {
          history = { battleId: runtime.battleId, endedAtMs: this.now(), result: null, ownScore: ownEnd?.score ?? null, rivalScore: rivalEnd?.score ?? null };
          runtime.history.push(history); runtime.history = runtime.history.slice(-20);
        }
        runtime.result = history.result || incomingResult || null;
        if (!history.result && incomingResult) {
          history.result = incomingResult; history.ownScore = ownEnd?.score ?? null; history.rivalScore = rivalEnd?.score ?? null;
          runtime.session.wins += Number(runtime.result === "win"); runtime.session.losses += Number(runtime.result === "lose"); runtime.session.draws += Number(runtime.result === "draw");
          if (runtime.result === "win") runtime.session.winStreak += 1;
          else if (runtime.result) runtime.session.winStreak = 0;
          if (after) {
            let pair = runtime.pairRounds.find((entry) => entry.opponentId === after.rival.id);
            if (!pair) { pair = { opponentId: after.rival.id, own: 0, opponent: 0 }; runtime.pairRounds.push(pair); }
            pair.own += Number(runtime.result === "win"); pair.opponent += Number(runtime.result === "lose"); runtime.pairRounds = runtime.pairRounds.slice(-20);
            runtime.rounds = { own: pair.own, opponent: pair.opponent };
          }
          if (runtime.result === "win") moments.push("victory"); if (runtime.result === "lose") moments.push("defeat");
        }
      }
      next.matchSession = runtime;
    });
    for (const moment of moments) this.fireMoment(moment, undefined, { deficit: Math.max(0, -(before?.difference || 0)) });
    if (input.rewardFinished) {
      for (const key of ["multiplier", "multiplier-end"]) if (this.timers.has(key)) { this.clearTimeoutImpl(this.timers.get(key)); this.timers.delete(key); }
    }
    if (input.multiplier && input.rewardStartsAtMs > this.now()) this.timer("multiplier", input.rewardStartsAtMs - this.now(), () => {
      const fresh = this.state(); if (signature(scope(fresh)) !== identity || !fresh.session?.running || fresh.settings?.tiktok?.status !== "live" || fresh.matchSession?.battleId !== input.battleId || fresh.matchSession.status !== "running") return;
      try { assertProFeatureAccess(this.store, "matches"); } catch { return; }
      this.mutate((next) => { next.matchSession.multiplier = input.multiplier; }); this.fireMoment(`multiplierX${input.multiplier}`); this.publish();
    });
    if (input.multiplier && input.rewardDurationMs > 0) this.timer("multiplier-end", Math.max(0, (input.rewardStartsAtMs || this.now()) + input.rewardDurationMs - this.now()), () => {
      const fresh = this.state(); if (signature(scope(fresh)) !== identity || !fresh.session?.running || fresh.settings?.tiktok?.status !== "live" || fresh.matchSession?.battleId !== input.battleId || fresh.matchSession.status !== "running" || fresh.matchSession.multiplier !== input.multiplier) return;
      try { assertProFeatureAccess(this.store, "matches"); } catch { return; }
      this.mutate((next) => { next.matchSession.multiplier = 1; }); this.publish();
    });
    this.reschedule(); this.publish(); return true;
  }
  handleLiveEvent(event) {
    if (!["like", "gift"].includes(event.type) || event.test === true || event.source !== "source_tiktok") return;
    const state = readState(this.store, LIVE_CONTEXT_PATHS); if (!state.session?.running || state.settings?.tiktok?.status !== "live") return;
    try { assertProFeatureAccess(this.store, "matches"); } catch { return; }
    const identity = signature(scope(state));
    if (identity !== this.identity) { this.reset(); this.identity = identity; }
    this.mutate((next) => {
      if (signature(next.matchSession?.scope) !== identity) next.matchSession = { ...createMatchSession(next.matchSession), scope: scope(next) };
      const runtime = next.matchSession; runtime.liveContributors ||= [];
      runtime.lastEventAtMs = this.now();
      const id = String(event.user?.id || event.user?.name || ""); if (!id || id === "anonymous") return;
      let row = runtime.liveContributors.find((entry) => entry.id === id);
      if (!row) { row = { id, username: String(event.user?.name || "").slice(0, 120), displayName: String(event.user?.displayName || "").slice(0, 160),
        avatarUrl: String(event.user?.avatarUrl || "").slice(0, 2000), likes: 0, gifts: 0, diamonds: 0 }; runtime.liveContributors.push(row); }
      const count = event.type === "gift" ? giftEventCount(event) : Math.max(0, Number(event.data?.count) || 0);
      if (event.type === "like") row.likes += count;
      else {
        row.gifts += count; row.diamonds += Math.max(0, Number(event.data?.value) || 0) * count; row.lastGiftAtMs = this.now();
        runtime.lastGift = { user: { id: row.id, username: row.username, displayName: row.displayName, avatarUrl: row.avatarUrl },
          giftName: String(event.data?.giftName || "Cadeau").slice(0, 160), count, value: Math.max(0, Number(event.data?.value) || 0), atMs: this.now() };
      }
      runtime.lastContribution = { type: event.type, user: { id: row.id, username: row.username, displayName: row.displayName, avatarUrl: row.avatarUrl },
        count, giftName: event.type === "gift" ? String(event.data?.giftName || "Cadeau").slice(0, 160) : "", atMs: this.now() };
      row.lastEventAtMs = this.now(); runtime.liveContributors = runtime.liveContributors.sort((a, b) => b.diamonds - a.diamonds || b.likes - a.likes).slice(0, 200);
    });
    this.publishDeferred();
    if (event.type !== "like" || readState(this.store, ["matchSession.status"]).matchSession?.status !== "running") return;
    this.likes.push({ at: this.now(), count: Math.min(1000000, Math.max(0, Number(event.data?.count) || 0)) });
    this.likes = this.likes.filter((entry) => entry.at >= this.now() - 60000).slice(-1000);
    this.fireMoment("likeRush");
  }
  reschedule() {
    const state = this.state(), runtime = state.matchSession; if (!runtime?.endsAtMs || runtime.status !== "running") return;
    const identity = signature(scope(state)), battleId = runtime.battleId;
    for (const item of normalizeMatchesConfig(state.settings?.matches).automations.filter((entry) => entry.enabled && ["snipe", "tieEnd"].includes(entry.moment))) {
      const remaining = runtime.endsAtMs - this.now(); if (remaining <= item.remainingSeconds * 1000) { if (remaining > 0) this.fireMoment(item.moment, item.id); continue; }
      this.timer(`${item.moment}:${item.id}`, remaining - item.remainingSeconds * 1000, () => {
        const fresh = this.state(); if (signature(scope(fresh)) === identity && fresh.matchSession?.battleId === battleId && fresh.matchSession.status === "running") this.fireMoment(item.moment, item.id);
      });
    }
  }
  fireMoment(moment, targetId, details = {}) {
    const state = readState(this.store, ACTION_CONTEXT_PATHS); if (signature(state.matchSession?.scope) !== signature(scope(state))) return;
    if (!eligibleMoment(state, moment, this.now())) return;
    try { assertProFeatureAccess(this.store, "matches"); } catch { return; }
    const config = normalizeMatchesConfig(state.settings?.matches), now = this.now();
    for (const item of config.automations.filter((entry) => entry.enabled && entry.moment === moment && (!targetId || entry.id === targetId))) {
      if (moment === "card") continue;
      if (moment === "comeback" && Number(details.deficit || 0) < item.threshold) continue;
      if (moment === "tieEnd") {
        const remaining = state.matchSession.endsAtMs - now;
        if (state.matchSession.status !== "running" || remaining <= 0 || remaining > item.remainingSeconds * 1000 || comparison(state.matchSession)?.difference !== 0) continue;
      }
      if (moment === "likeRush" && this.likes.filter((entry) => entry.at >= now - item.windowSeconds * 1000).reduce((sum, entry) => sum + entry.count, 0) < item.threshold) continue;
      const key = `${state.matchSession.battleId}:${item.id}`;
      if ((this.cooldowns.get(key) || 0) > now || this.pending.length >= 30) continue;
      this.cooldowns.set(key, ["snipe", "tieEnd"].includes(moment) ? Number.MAX_SAFE_INTEGER : now + item.cooldownMs);
      while (this.cooldowns.size > 1000) this.cooldowns.delete(this.cooldowns.keys().next().value);
      this.pending.push({ item, capturedScope: scope(state), battleId: state.matchSession.battleId });
    }
    this.pump();
  }
  pump() {
    if (this.processing) return; this.processing = true;
    this.completion = (async () => {
      while (this.pending.length) {
        const job = this.pending.shift();
        try {
          const result = await this.runReaction(job.item, job);
          if (!result?.stale) this.onActivity(result?.queued || result?.partial || result?.executed === false || result?.skipped ? "warning" : "success", "matches",
            result?.queued ? "Réaction de match mise en file" : result?.partial ? "Réaction de match partielle" : result?.executed === false || result?.skipped ? "Réaction de match non exécutée" : "Réaction de match exécutée", job.item.name);
        }
        catch (error) {
          // Le journal reste privé et ne publie jamais URL, jeton ou erreur brute.
          this.onActivity("warning", "matches", "Réaction de match non exécutée",
            `${job.item.name} · ${error?.code === "FEATURE_CONTEXT_CHANGED" ? "Contexte du LIVE modifié." : "Vérifiez les sorties configurées et vos droits dans Matchs."}`);
        }
      }
    })().finally(() => { this.processing = false; if (this.pending.length) this.pump(); });
  }
  async whenIdle() { while (this.processing || this.pending.length) await this.completion; }
}
module.exports = { MatchesService, assertExpectedScope };
