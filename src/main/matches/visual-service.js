"use strict";

// Opt-in only. Frames and OCR text are ephemeral and never enter StateStore,
// activity logs, the API, the relay, or a network request.
const { readState } = require("../state-projection");
const { assertProFeatureAccess, createProFeatureGuard } = require("../pro-feature-access");
const { normalizeMatchesConfig } = require("../../shared/matches-contract");
const { VisualBonusTracker } = require("./visual-bonus");

const PATHS = ["settings.matches.visualBonus", "settings.account.uid", "settings.tiktok",
  "session.profileId", "session.running", "matchSession", "connections"];
const key = (value) => JSON.stringify(value);
const identity = (context) => context ? key({ ...context, endsAtMs: undefined }) : "";
const username = (value) => String(value || "").trim().replace(/^@+/, "").toLowerCase();
const RECOVERY_DELAYS_MS = [500, 1500, 4000];
const ownerMode = (config) => ["studio-self", "self-screen"].includes(config?.ownerMode) ? config.ownerMode : "username";
const regionsKey = (config) => key([config?.bannerROI, config?.ownerROI, ownerMode(config),
  ownerMode(config) === "self-screen" ? config.ownPosition : null]);
const exactId = (value) => typeof value === "string" && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
function screenLiveKey(state) {
  const tiktok = state.settings?.tiktok, primary = state.connections?.find((row) => row.id === "source_tiktok");
  return key([username(tiktok?.username), String(tiktok?.broadcaster?.userId || ""), String(tiktok?.roomId || ""),
    primary?.id, primary?.type, username(primary?.config?.username)]);
}
function matchLayout(match, ownerId) {
  const rows = Array.isArray(match.participants) ? match.participants : [], teams = Array.isArray(match.teams) ? match.teams : [];
  const ids = rows.map((row) => row.id), battleType = match.battleType ?? 0;
  if (ids.length < 2 || ids.length > 16 || ids.some((id) => !exactId(id)) || new Set(ids).size !== ids.length ||
    ids.filter((id) => id === ownerId).length !== 1 || ![0, 1, 2, 3, 4, 51, 52].includes(battleType)) return null;
  const members = teams.flatMap((team) => Array.isArray(team.participantIds) ? team.participantIds : []);
  if (teams.some((team) => !Array.isArray(team.participantIds) || !team.participantIds.length) || teams.length &&
    (members.length !== ids.length || new Set(members).size !== ids.length || members.some((id) => !ids.includes(id)))) return null;
  return { count: ids.length, key: key([battleType, ids.length, teams.map((team) => team.participantIds.length).sort((a, b) => a - b)]) };
}

class MatchVisualService {
  constructor({ store, matches, createCapture, createOcr, now = Date.now,
    getAccountGeneration = () => 0, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout }) {
    Object.assign(this, { store, matches, createOcr, getAccountGeneration, now, setTimeoutImpl, clearTimeoutImpl });
    this.tracker = new VisualBonusTracker(); this.selection = null; this.timer = null;
    this.contextKey = ""; this.trackingKey = ""; this.epoch = 0; this.generation = 0; this.closed = false;
    this.active = false; this.stateCode = "disabled"; this.frameSequence = 0; this.captureGeneration = null;
    this.configurationSequence = 0; this.previewing = false;
    this.recoveryAttempts = 0; this.retryAtMs = 0; this.recoveryPending = null;
    this.ocr = null;
    this.capture = createCapture({ onFrame: (frame) => this.frame(frame), onStatus: (status) => this.captureStatus(status) });
  }
  state() { return readState(this.store, PATHS); }
  assertScope(expected, state = this.state()) {
    assertProFeatureAccess(this.store, "matches");
    if (!expected || expected.ownerUid !== state.settings?.account?.uid || expected.profileId !== state.session?.profileId ||
      expected.accountGeneration !== undefined && expected.accountGeneration !== this.getAccountGeneration()) {
      const error = new Error("Le compte ou le profil de la lecture locale a changé."); error.code = "FEATURE_CONTEXT_CHANGED"; throw error;
    }
    return { ownerUid: expected.ownerUid, profileId: expected.profileId, accountGeneration: this.getAccountGeneration() };
  }
  selectionMatches(state, config) {
    const same = this.selection && this.selection.ownerUid === state.settings?.account?.uid && this.selection.profileId === state.session?.profileId &&
      this.selection.accountGeneration === this.getAccountGeneration() && this.selection.regionsKey === regionsKey(config);
    if (this.selection?.ownScreenConfirmed === true && !same) {
      this.selection.ownScreenConfirmed = false; this.selection.confirmationRequired = true;
    }
    return Boolean(same);
  }
  status() {
    assertProFeatureAccess(this.store, "matches");
    const state = this.state(), config = state.settings?.matches?.visualBonus || {};
    const same = this.selectionMatches(state, config);
    if (same && ownerMode(config) === "self-screen") this.context();
    const layoutChanged = same && this.selection.layoutInvalidated === true;
    const confirmationRequired = same && this.selection.confirmationRequired === true;
    return { enabled: config.enabled === true, active: Boolean(same && !layoutChanged && !confirmationRequired && this.active),
      state: config.enabled !== true ? "disabled" : !same ? "choose-window" : confirmationRequired ? "confirmation-required" : layoutChanged ? "layout-changed" : this.stateCode,
      sourceId: same ? this.selection.sourceId : "", sourceName: same ? this.selection.sourceName : "",
      bannerROI: config.bannerROI || null, ownerROI: config.ownerROI || null, ownerMode: ownerMode(config),
      ...(ownerMode(config) === "self-screen" ? { ownPosition: config.ownPosition } : {}) };
  }
  async sources() {
    const guard = createProFeatureGuard(this.store, "matches"); guard();
    const state = this.state(), scope = this.assertScope({ ownerUid: state.settings?.account?.uid, profileId: state.session?.profileId });
    const sources = await this.capture.listSources(); guard(); this.assertScope(scope);
    return sources;
  }
  async preview(sourceId, expected) {
    const scope = this.assertScope(expected), guard = createProFeatureGuard(this.store, "matches");
    if (this.previewing) throw new Error("Un aperçu local est déjà en cours.");
    this.previewing = true;
    try {
      await this.stopCapture();
      if (this.recoveryPending) await this.recoveryPending;
      guard(); this.assertScope(scope);
      if (this.closed) throw new Error("Lecture locale interrompue.");
      const image = await this.capture.preview(sourceId); guard(); this.assertScope(scope);
      return { image };
    } finally {
      this.previewing = false;
      if (this.timer) this.clearTimeoutImpl(this.timer); this.timer = null;
      if (!this.closed && this.selection) await this.tick();
    }
  }
  async configure(input, expected) {
    const scope = this.assertScope(expected), guard = createProFeatureGuard(this.store, "matches");
    const operation = ++this.configurationSequence;
    const expectedLive = input?.enabled === true && input.ownerMode === "self-screen" ? screenLiveKey(this.state()) : null;
    const check = () => {
      guard(); this.assertScope(scope);
      if (this.closed || operation !== this.configurationSequence) throw new Error("Le réglage de lecture locale a changé.");
      if (expectedLive !== null && screenLiveKey(this.state()) !== expectedLive) throw new Error("Le LIVE a changé : confirmez à nouveau votre écran.");
    };
    const config = normalizeMatchesConfig({ visualBonus: input }).visualBonus;
    let selected = null;
    if (input?.enabled === true) {
      if (!config.enabled) throw new Error("Délimitez les zones requises avant d'activer la lecture locale.");
      if (ownerMode(config) === "self-screen" && input.ownScreenConfirmed !== true) throw new Error("Confirmez que cette fenêtre affiche votre propre LIVE et le bandeau de votre côté.");
      selected = (await this.capture.listSources()).find((row) => row.id === input.sourceId);
      check();
      if (!selected) throw new Error("Choisissez une fenêtre TikTok disponible sur ce PC.");
    }
    check(); this.matches.saveConfig({ visualBonus: config }, scope);
    await this.stopCapture();
    if (this.recoveryPending) await this.recoveryPending;
    check(); this.selection = selected ? { ...scope, sourceId: selected.id, sourceName: selected.name,
      regionsKey: regionsKey(config), ...(ownerMode(config) === "self-screen" ? { ownScreenConfirmed: true, liveKey: "", layoutKey: "", layoutInvalidated: false, confirmationRequired: false } : {}) } : null;
    this.recoveryAttempts = 0; this.retryAtMs = 0;
    if (this.timer) this.clearTimeoutImpl(this.timer); this.timer = null;
    if (selected) await this.tick(); else this.stateCode = "disabled";
    return this.status();
  }
  context() {
    if (!this.selection || this.closed) return null;
    const state = this.state(), selected = this.selectionMatches(state, state.settings?.matches?.visualBonus);
    this.assertScope(this.selection, state);
    const tiktok = state.settings?.tiktok, match = state.matchSession, config = state.settings?.matches?.visualBonus;
    const ownUsername = username(tiktok?.username), ownerId = String(tiktok?.broadcaster?.userId || "");
    const primary = state.connections?.find((row) => row.id === "source_tiktok");
    if (config?.enabled !== true || !selected) return null;
    const verifiedLive = state.session?.running && tiktok?.status === "live" && primary?.enabled && primary.type === "tiktok-direct" &&
      username(primary.config?.username) === ownUsername && exactId(String(tiktok.roomId || "")) && exactId(ownerId) && ownUsername &&
      (!tiktok.broadcaster?.username || username(tiktok.broadcaster.username) === ownUsername);
    if (ownerMode(config) === "self-screen") {
      if (this.selection.ownScreenConfirmed !== true || this.selection.layoutInvalidated) return null;
      // This is an ephemeral binding to a verified LIVE, not a visual claim
      // that the chosen banner identifies its beneficiary. Battles may change.
      const liveKey = screenLiveKey(state);
      if (this.selection.liveKey && this.selection.liveKey !== liveKey) {
        this.selection.ownScreenConfirmed = false; this.selection.confirmationRequired = true;
        this.stateCode = "confirmation-required"; this.tracker.interrupt(); return null;
      }
      if (verifiedLive) this.selection.liveKey ||= liveKey;
    }
    if (!verifiedLive || match?.status !== "running" || !/^[1-9]\d{0,19}$/.test(String(match.battleId || "")) || match.ownUserId !== ownerId ||
      match.scope?.uid !== state.settings.account.uid || match.scope?.profileId !== state.session.profileId ||
      match.scope?.roomId !== tiktok.roomId || !match.battleId || !Number.isSafeInteger(match.startedAtMs) ||
      !Number.isSafeInteger(match.endsAtMs) || match.endsAtMs <= this.now()) return null;
    let studioIdentity = {};
    if (ownerMode(config) === "self-screen") {
      if (this.selection.ownScreenConfirmed !== true || this.selection.layoutInvalidated) return null;
      const layout = matchLayout(match, ownerId);
      if (!layout) {
        if (this.selection.layoutKey) { this.selection.layoutInvalidated = true; this.stateCode = "layout-changed"; this.tracker.interrupt(); }
        return null;
      }
      if (this.selection.layoutKey && this.selection.layoutKey !== layout.key) {
        this.selection.layoutInvalidated = true; this.stateCode = "layout-changed"; this.tracker.interrupt(); return null;
      }
      if (config.ownPosition === "left" ? layout.count !== 2 : config.ownPosition !== "top-left" || layout.count < 3 || layout.count > 4) return null;
      this.selection.layoutKey ||= layout.key;
      studioIdentity = { ownScreenConfirmed: true, ownPosition: config.ownPosition, layoutKey: layout.key };
    }
    if (ownerMode(config) === "studio-self") {
      const rows = Array.isArray(match.participants) ? match.participants : [];
      const own = rows.find((row) => row.id === ownerId), rival = rows.find((row) => row.id !== ownerId);
      if (rows.length !== 2 || !own || !rival || !/^[1-9]\d{0,19}$/.test(String(rival.id || "")) ||
        !String(tiktok.broadcaster?.nickname || "").trim() || !String(rival.displayName || "").trim() ||
        (match.teams || []).some((team) => team.participantIds?.length > 1) || ![0, 1].includes(match.battleType || 0)) return null;
      const teams = Array.isArray(match.teams) ? match.teams : [];
      if (teams.length && (teams.length !== 2 || new Set(teams.map((team) => team.id)).size !== 2 ||
        teams.some((team) => team.participantIds?.length !== 1 || ![ownerId, rival.id].includes(team.participantIds[0])) ||
        new Set(teams.map((team) => team.participantIds[0])).size !== 2)) return null;
      studioIdentity = { ownerDisplayName: String(tiktok.broadcaster.nickname).trim(), otherDisplayNames: [String(rival.displayName).trim()] };
    }
    return { sourceId: "source_tiktok", windowId: this.selection.sourceId, accountUid: state.settings.account.uid,
      profileId: state.session.profileId, roomId: tiktok.roomId, battleId: match.battleId,
      ownerUserId: ownerId, ownerUsername: ownUsername, startedAtMs: match.startedAtMs, endsAtMs: match.endsAtMs,
      accountGeneration: this.getAccountGeneration(), matchGeneration: this.matches.generation, regionsKey: regionsKey(config),
      ownerMode: ownerMode(config), ...studioIdentity };
  }
  async stopCapture() {
    this.generation += 1; this.captureGeneration = null; this.active = false; this.contextKey = ""; this.tracker.interrupt();
    this.ocr?.close(); this.ocr = null; await this.capture.stop();
  }
  scheduleTick(delay = 500) {
    if (this.timer) this.clearTimeoutImpl(this.timer); this.timer = null;
    if (this.closed || !this.selection) return;
    this.timer = this.setTimeoutImpl(() => { this.timer = null; this.tick().catch(() => {}); }, delay);
    this.timer?.unref?.();
  }
  captureStatus(status) {
    if (!this.active || !Number.isSafeInteger(this.captureGeneration) || status?.generation !== this.captureGeneration ||
      !["ended", "error", "stopped"].includes(status.state)) return;
    void this.recoverCapture().catch(() => {});
  }
  async recoverCapture() {
    if (this.recoveryPending) return this.recoveryPending;
    if (this.timer) this.clearTimeoutImpl(this.timer); this.timer = null;
    const stopping = this.stopCapture(), generation = this.generation;
    const delay = RECOVERY_DELAYS_MS[this.recoveryAttempts++];
    this.retryAtMs = delay === undefined ? Infinity : this.now() + delay;
    this.stateCode = delay === undefined ? "capture-unavailable" : "recovering";
    const pending = Promise.resolve(stopping).finally(() => {
      if (this.recoveryPending === pending) this.recoveryPending = null;
      if (!this.closed && generation === this.generation) this.scheduleTick(delay ?? 500);
    });
    this.recoveryPending = pending;
    return pending;
  }
  async tick() {
    if (this.closed || !this.selection || this.previewing || this.recoveryPending) return;
    try {
      const context = this.context();
      if (!context) {
        if (this.active) await this.stopCapture();
        this.stateCode = this.selection?.confirmationRequired ? "confirmation-required" : this.selection?.layoutInvalidated ? "layout-changed" : "waiting-match";
      } else {
        const nextKey = identity(context);
        if (this.trackingKey !== nextKey) {
          this.tracker.reset(); this.trackingKey = nextKey; this.epoch += 1;
          this.recoveryAttempts = 0; this.retryAtMs = 0;
        }
        if (this.retryAtMs > this.now()) return;
        if (this.contextKey !== nextKey) {
          await this.stopCapture(); const generation = this.generation;
          this.contextKey = nextKey; this.active = true; this.stateCode = "reading";
          this.ocr = this.createOcr();
          const config = this.state().settings.matches.visualBonus;
          const started = await this.capture.start({ sourceId: this.selection.sourceId, bannerROI: config.bannerROI, ownerROI: config.ownerROI,
            ...(ownerMode(config) === "self-screen" ? { ownerMode: "self-screen", ownScreenConfirmed: this.selection.ownScreenConfirmed === true } : {}) });
          this.captureGeneration = started?.generation;
          if (generation !== this.generation || identity(this.context()) !== nextKey) await this.stopCapture();
        }
      }
    } catch {
      await this.recoverCapture();
    } finally {
      this.scheduleTick(Number.isFinite(this.retryAtMs) ? Math.max(500, this.retryAtMs - this.now()) : 500);
    }
  }
  async frame(frame) {
    const generation = this.generation, contextKey = this.contextKey;
    if (!this.active || frame.sourceId !== this.selection?.sourceId || !Number.isSafeInteger(this.captureGeneration) || frame.generation !== this.captureGeneration) return;
    try {
      const context = this.context(); if (!context || identity(context) !== contextKey) return;
      const ocr = this.ocr; if (!ocr) return;
      const owner = context.ownerMode === "self-screen" ? { available: true, lines: [] } : await ocr.recognize(frame.owner);
      if (generation !== this.generation || identity(this.context()) !== contextKey) return;
      if (!owner.available) { this.stateCode = "ocr-unavailable"; this.tracker.interrupt(); return; }
      const banner = await ocr.recognize(frame.banner);
      if (generation !== this.generation || identity(this.context()) !== contextKey) return;
      if (!banner.available) { this.stateCode = "ocr-unavailable"; this.tracker.interrupt(); return; }
      this.recoveryAttempts = 0; this.retryAtMs = 0;
      const knownPeriods = [...this.matches.bonuses.periods.values()].filter((row) => row.result === "success" && row.durationMs > 0)
        .map((row) => ({ confirmed: true, multiplier: row.multiplier, startsAtMs: row.startsAtMs, endsAtMs: row.startsAtMs + row.durationMs }));
      const bonus = this.tracker.observe({ context, frameId: String(++this.frameSequence), capturedAtMs: frame.capturedAtMs,
        bannerLines: banner.lines.map((line) => line.text), ownerLines: owner.lines.map((line) => line.text), knownPeriods }, this.now());
      this.stateCode = "reading";
      if (!bonus) return;
      const current = this.context(); if (generation !== this.generation || identity(current) !== contextKey) return;
      this.matches.handle({ source: "source_tiktok", phase: "task", roomId: context.roomId, channelUsername: context.ownerUsername,
        battleId: context.battleId, receivedAtMs: this.now(), participants: [], teams: [],
        bonus: { stage: "available", result: "available", origin: "visual", ownerUserId: context.ownerUserId,
          multiplier: bonus.multiplier, startsAtMs: bonus.startsAtMs, durationMs: bonus.endsAtMs - bonus.startsAtMs,
          periodKey: `visual:${this.epoch}:${bonus.periodKey}` } });
    } catch { this.tracker.interrupt(); this.stateCode = "unavailable"; }
  }
  async close() {
    this.closed = true; this.configurationSequence += 1; if (this.timer) this.clearTimeoutImpl(this.timer); this.timer = null;
    this.selection = null; await this.stopCapture();
    this.tracker.reset(); this.trackingKey = "";
  }
}

module.exports = { MatchVisualService };
