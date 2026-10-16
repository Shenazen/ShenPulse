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

class MatchVisualService {
  constructor({ store, matches, createCapture, createOcr, now = Date.now,
    getAccountGeneration = () => 0, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout }) {
    Object.assign(this, { store, matches, createOcr, getAccountGeneration, now, setTimeoutImpl, clearTimeoutImpl });
    this.tracker = new VisualBonusTracker(); this.selection = null; this.timer = null;
    this.contextKey = ""; this.epoch = 0; this.generation = 0; this.closed = false;
    this.active = false; this.stateCode = "disabled"; this.frameSequence = 0; this.captureGeneration = null;
    this.configurationSequence = 0; this.previewing = false;
    this.ocr = null;
    this.capture = createCapture({ onFrame: (frame) => this.frame(frame), onStatus: (status) => {
      if (this.active && status?.state === "error") this.stateCode = "capture-unavailable";
    } });
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
  status() {
    assertProFeatureAccess(this.store, "matches");
    const state = this.state(), config = state.settings?.matches?.visualBonus || {};
    const same = this.selection && this.selection.ownerUid === state.settings?.account?.uid && this.selection.profileId === state.session?.profileId &&
      this.selection.accountGeneration === this.getAccountGeneration() && this.selection.regionsKey === key([config.bannerROI, config.ownerROI]);
    return { enabled: config.enabled === true, active: Boolean(same && this.active),
      state: config.enabled !== true ? "disabled" : !same ? "choose-window" : this.stateCode,
      sourceId: same ? this.selection.sourceId : "", sourceName: same ? this.selection.sourceName : "",
      bannerROI: config.bannerROI || null, ownerROI: config.ownerROI || null };
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
    const check = () => { guard(); this.assertScope(scope); if (this.closed || operation !== this.configurationSequence) throw new Error("Le réglage de lecture locale a changé."); };
    const config = normalizeMatchesConfig({ visualBonus: input }).visualBonus;
    let selected = null;
    if (input?.enabled === true) {
      if (!config.enabled) throw new Error("Délimitez le bandeau du bonus et votre @pseudo avant d'activer la lecture locale.");
      selected = (await this.capture.listSources()).find((row) => row.id === input.sourceId);
      check();
      if (!selected) throw new Error("Choisissez une fenêtre TikTok disponible sur ce PC.");
    }
    check(); this.matches.saveConfig({ visualBonus: config }, scope);
    await this.stopCapture(); check(); this.selection = selected ? { ...scope, sourceId: selected.id, sourceName: selected.name,
      regionsKey: key([config.bannerROI, config.ownerROI]) } : null;
    if (this.timer) this.clearTimeoutImpl(this.timer); this.timer = null;
    if (selected) await this.tick(); else this.stateCode = "disabled";
    return this.status();
  }
  context() {
    if (!this.selection || this.closed) return null;
    const state = this.state(); this.assertScope(this.selection, state);
    const tiktok = state.settings?.tiktok, match = state.matchSession, config = state.settings?.matches?.visualBonus;
    const ownUsername = username(tiktok?.username), ownerId = String(tiktok?.broadcaster?.userId || "");
    const primary = state.connections?.find((row) => row.id === "source_tiktok");
    if (config?.enabled !== true || this.selection.regionsKey !== key([config.bannerROI, config.ownerROI]) ||
      !state.session?.running || tiktok?.status !== "live" || match?.status !== "running" ||
      !primary?.enabled || primary.type !== "tiktok-direct" || username(primary.config?.username) !== ownUsername ||
      !/^[1-9]\d{0,19}$/.test(String(tiktok.roomId || "")) || !/^[1-9]\d{0,19}$/.test(String(match.battleId || "")) ||
      !/^[1-9]\d{0,19}$/.test(ownerId) || match.ownUserId !== ownerId || !ownUsername ||
      (tiktok.broadcaster?.username && username(tiktok.broadcaster.username) !== ownUsername) ||
      match.scope?.uid !== state.settings.account.uid || match.scope?.profileId !== state.session.profileId ||
      match.scope?.roomId !== tiktok.roomId || !match.battleId || !Number.isSafeInteger(match.startedAtMs) ||
      !Number.isSafeInteger(match.endsAtMs) || match.endsAtMs <= this.now()) return null;
    return { sourceId: "source_tiktok", windowId: this.selection.sourceId, accountUid: state.settings.account.uid,
      profileId: state.session.profileId, roomId: tiktok.roomId, battleId: match.battleId,
      ownerUserId: ownerId, ownerUsername: ownUsername, startedAtMs: match.startedAtMs, endsAtMs: match.endsAtMs,
      accountGeneration: this.getAccountGeneration(), matchGeneration: this.matches.generation, regionsKey: key([config.bannerROI, config.ownerROI]) };
  }
  async stopCapture() {
    this.generation += 1; this.captureGeneration = null; this.active = false; this.contextKey = ""; this.tracker.reset();
    this.ocr?.close(); this.ocr = null; await this.capture.stop();
  }
  async tick() {
    if (this.closed || !this.selection || this.previewing) return;
    try {
      const context = this.context();
      if (!context) {
        if (this.active) await this.stopCapture(); this.stateCode = "waiting-match";
      } else {
        const nextKey = identity(context);
        if (this.contextKey !== nextKey) {
          await this.stopCapture(); const generation = this.generation;
          this.contextKey = nextKey; this.epoch += 1; this.active = true; this.stateCode = "reading";
          this.ocr = this.createOcr();
          const config = this.state().settings.matches.visualBonus;
          const started = await this.capture.start({ sourceId: this.selection.sourceId, bannerROI: config.bannerROI, ownerROI: config.ownerROI });
          this.captureGeneration = started?.generation;
          if (generation !== this.generation || identity(this.context()) !== nextKey) await this.stopCapture();
        }
      }
    } catch {
      await this.stopCapture(); this.stateCode = "unavailable";
    } finally {
      if (!this.closed && this.selection) this.timer = this.setTimeoutImpl(() => { this.timer = null; this.tick().catch(() => {}); }, 500);
      this.timer?.unref?.();
    }
  }
  async frame(frame) {
    const generation = this.generation, contextKey = this.contextKey;
    if (!this.active || frame.sourceId !== this.selection?.sourceId || !Number.isSafeInteger(this.captureGeneration) || frame.generation !== this.captureGeneration) return;
    try {
      const context = this.context(); if (!context || identity(context) !== contextKey) return;
      const ocr = this.ocr; if (!ocr) return;
      const owner = await ocr.recognize(frame.owner);
      if (generation !== this.generation || identity(this.context()) !== contextKey) return;
      if (!owner.available) { this.stateCode = "ocr-unavailable"; this.tracker.reset(); return; }
      const banner = await ocr.recognize(frame.banner);
      if (generation !== this.generation || identity(this.context()) !== contextKey) return;
      if (!banner.available) { this.stateCode = "ocr-unavailable"; this.tracker.reset(); return; }
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
    } catch { this.tracker.reset(); this.stateCode = "unavailable"; }
  }
  async close() {
    this.closed = true; this.configurationSequence += 1; if (this.timer) this.clearTimeoutImpl(this.timer); this.timer = null;
    this.selection = null; await this.stopCapture();
  }
}

module.exports = { MatchVisualService };
