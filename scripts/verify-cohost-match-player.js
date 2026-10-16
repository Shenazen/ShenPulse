"use strict";

/**
 * Qualification 1v1 : protobuf SDK -> normaliseur -> MatchesService ->
 * ActionRunner -> OverlayServer/SSE -> vrai lecteur Chromium et vidéos protégées.
 * Usage : node scripts/verify-cohost-match-player.js.
 * État synthétique en mémoire, ports éphémères, profil Chromium temporaire,
 * fenêtre cachée, réseau externe interdit et deux coupures audio indépendantes.
 * Aucun StateStore utilisateur, compte réel, Firebase, Studio ou LIVE n'est ouvert.
 * Reprend les mesures de verify-studio-local-match.js sans remplacer playMatch.
 */
if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(require("electron"), [__filename], { stdio: "inherit", env: environment, windowsHide: true });
  if (child.error) process.stderr.write(`${child.error.message}\n`);
  process.exit(child.status ?? 1);
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { app, BrowserWindow } = require("electron");
const sdk = require("tiktok-live-connector");
const { MatchesService } = require("../src/main/matches/service");
const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
const { normalizeTikTokGiftBonus } = require("../src/main/matches/tiktok-gift-bonus");
const { ActionRunner } = require("../src/main/action-runner");
const { OverlayServer } = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");

const output = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-cohost-player-"));
app.setPath("userData", path.join(output, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1");
const report = { ok: false, scope: "Fixture 1v1 et Chromium local uniquement ; aucun son, LIVE, Firebase ou Studio utilisateur.",
  playbacks: [], activities: [], requestFailures: [], fontCacheProbes: [], requests: { local: 0, tickets: 0, video: 0, external: 0, raw: 0, privateAssets: 0, failed: 0 }, consoleErrors: [] };
let player, server, service, stage = "initialisation", clock = Date.now(), sequence = 0;
const timers = new Map();
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const empty = (codec, extra = {}) => ({ ...codec.decode(new Uint8Array()), ...extra });
const decoded = (codec, data) => codec.decode(codec.encode(data).finish());
const cleanError = (error) => String(error?.stack || error).replace(/https?:\/\/\S+/g, "[URL masquée]");
const deadline = setTimeout(() => finish(new Error(`Délai dépassé : ${stage}`)), 60000);

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
}

async function waitUntil(callback, timeoutMs = 12000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) { if (await callback()) return; await delay(60); }
  throw new Error(`Condition non atteinte : ${stage}`);
}

function inspectPlayer() {
  const video = document.getElementById("match-video");
  if (!video) return null;
  let frame = "";
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const canvas = document.createElement("canvas"); canvas.width = 72; canvas.height = 128;
    canvas.getContext("2d").drawImage(video, 0, 0, 72, 128); frame = canvas.toDataURL("image/png");
  }
  const source = new URL(video.currentSrc || location.href), request = matchPlaybackQueue?.snapshot().current;
  return { playbackId: video.dataset.matchPlaybackId || "", match: request?.match || "", variant: request?.variant || "",
    currentTime: video.currentTime, paused: video.paused, muted: video.muted, readyState: video.readyState,
    decodedFrames: video.getVideoPlaybackQuality?.().totalVideoFrames || 0, presentedFrames: globalThis.cohostSmokeFrames || 0,
    ticketSource: source.origin === location.origin && source.pathname.startsWith("/match-media/"),
    compatibleVisible: Boolean(document.getElementById("match-compatible-animation")),
    error: document.documentElement.dataset.matchPlaybackError || "", hidden: document.documentElement.hidden,
    playing: video.parentElement.classList.contains("playing"), frame };
}

async function sample() {
  const value = await player.webContents.executeJavaScript(`(${inspectPlayer.toString()})()`);
  assert.ok(value, "Le vrai lecteur doit être présent");
  value.frameHash = value.frame ? createHash("sha256").update(value.frame).digest("hex") : "";
  delete value.frame;
  return value;
}

async function verifyMoment(moment, match, variant, trigger) {
  stage = moment;
  const previousId = (await sample()).playbackId;
  await trigger(); await service.whenIdle();
  await waitUntil(async () => {
    const value = await sample();
    return value.playbackId && value.playbackId !== previousId && value.match === match && value.variant === variant &&
      value.currentTime >= 0.3 && value.readyState >= 2 && !value.paused && value.ticketSource;
  });
  const samples = [], screenshots = [];
  for (let index = 0; index < 3; index += 1) {
    samples.push(await sample());
    const name = `${moment}-${index + 1}.png`;
    fs.writeFileSync(path.join(output, name), (await player.webContents.capturePage()).toPNG()); screenshots.push(name);
    if (index < 2) await delay(650);
  }
  const first = samples[0], last = samples.at(-1);
  assert.ok(last.currentTime > first.currentTime + 0.6, `${moment} : le temps vidéo doit avancer`);
  assert.ok(last.decodedFrames >= first.decodedFrames + 8 && last.presentedFrames >= first.presentedFrames + 8, `${moment} : images décodées et présentées`);
  assert.ok(new Set(samples.map((value) => value.frameHash)).size > 1, `${moment} : les vraies images doivent changer`);
  assert.ok(samples.every((value) => value.playbackId === first.playbackId && !value.paused && value.muted && value.ticketSource &&
    !value.compatibleVisible && !value.error && !value.hidden && value.playing), `${moment} : lecture native protégée sans secours ni erreur`);
  assert.equal(player.webContents.isAudioMuted(), true, "La sortie matérielle doit rester coupée");
  report.playbacks.push({ moment, match, variant, samples, screenshots });
}

async function run() {
  const state = { settings: { overlayPort: await freePort(), apiPort: await freePort(), overlayToken: "synthetic-overlay", apiToken: "synthetic-api",
    account: { uid: "synthetic-cohost-account", email: "synthetic@example.invalid", refreshTokenSecretId: "synthetic-only" }, siteVisibility: {},
    matchAccess: { accessKey: "a".repeat(32) }, publicOverlayRelay: { publicBaseUrl: "https://shenpulse-overlays.web.app", matchChannelId: "m".repeat(24) },
    tiktok: { username: "fixture_creator", roomId: "700", status: "live", broadcaster: { username: "fixture_creator", userId: "1" } },
    matches: normalizeMatchesConfig(), overlayConfigs: {} }, session: { running: true, startedAt: new Date(clock - 60000).toISOString(), profileId: "synthetic-profile" },
    commerce: { subscription: { tier: "pro", status: "active" } }, matchSession: createMatchSession(), rules: [], goals: [], statistics: {}, overlaySession: {}, profiles: [] };
  const store = { getState: () => { throw new Error("Aucun magasin utilisateur ne peut être lu"); }, getStateProjection: (keys) => selectStatePaths(state, keys),
    getAccountSession: () => state.settings.account, getSecret: () => "synthetic-refresh-only", mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state) };
  server = new OverlayServer({ store, staticDirectory: path.join(__dirname, "../resources/overlays"),
    onInboundEvent: async () => { throw new Error("Événement externe interdit"); }, onEffectRequest: async () => { throw new Error("Effet externe interdit"); } });
  await server.start();
  const actionRunner = new ActionRunner({ store, overlayServer: server, notifyRenderer: () => { throw new Error("Sortie renderer interdite"); } });
  service = new MatchesService({ store, actionRunner, overlayServer: server, now: () => clock,
    onActivity: (level, _category, title, detail) => report.activities.push({ level, title, detail }),
    setTimeoutImpl: (callback, milliseconds) => { const timer = { callback, at: clock + milliseconds, unref() {} }; timers.set(timer, timer); return timer; }, clearTimeoutImpl: (timer) => timers.delete(timer) });
  for (const [moment, match, variant] of [["battleStart", "taptap", "cyber"], ["multiplierX2", "x2", "cyber"], ["multiplierX3", "x3", "cyber"], ["snipe", "snipe", "cyber"]]) {
    const animation = { type: "animation", match, variant };
    service.saveAutomation({ id: moment, name: moment, moment, enabled: true, remainingSeconds: 30,
      reaction: moment === "snipe" ? animation : { type: "bundle", reactions: [animation] } });
  }
  const origin = `http://127.0.0.1:${state.settings.overlayPort}`;
  player = new BrowserWindow({ width: 360, height: 640, show: false, backgroundColor: "#00000000", webPreferences: { partition: "isolated-cohost-match-player",
    backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true, webSecurity: true } });
  player.webContents.setAudioMuted(true);
  player.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const session = player.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.on("will-download", (event) => { event.preventDefault(); report.requests.failed += 1; });
  session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (!["data:", "blob:", "about:"].includes(url.protocol) && url.origin !== origin) { report.requests.external += 1; return callback({ cancel: true }); }
    if (url.origin === origin) {
      report.requests.local += 1;
      if (url.pathname.endsWith("/ticket")) report.requests.tickets += 1;
      if (url.pathname.startsWith("/match-media/")) report.requests.video += 1;
      if (/\/media\/video\/.*\.(?:webm|mp4)$/i.test(url.pathname)) { report.requests.raw += 1; return callback({ cancel: true }); }
      if (/protected-match-media|client-key\.json|\.spm(?:$|\/)/i.test(url.pathname)) { report.requests.privateAssets += 1; return callback({ cancel: true }); }
    }
    callback({});
  });
  const requestKind = (details) => {
    const pathname = new URL(details.url).pathname;
    return pathname.startsWith("/match-media/") ? "protected-video" : pathname.startsWith("/match-bridge/") ? `bridge-${pathname.split("/").at(-1).replace(/^[A-Za-z0-9_-]{24,}$/, "document")}` : pathname;
  };
  session.webRequest.onErrorOccurred((details) => {
    const diagnostic = { stage, kind: requestKind(details), error: details.error };
    // Chromium peut sonder le cache des polices avant le vrai téléchargement.
    // Comme verify-match-code-cache, séparer cette sonde et exiger ci-dessous
    // que la véritable FontFace Inter termine effectivement son chargement.
    if (details.resourceType === "font" && details.error === "net::ERR_CACHE_MISS") report.fontCacheProbes.push(diagnostic);
    else if (details.error !== "net::ERR_ABORTED") { report.requests.failed += 1; report.requestFailures.push(diagnostic); }
  });
  session.webRequest.onCompleted((details) => {
    if (details.statusCode >= 400) { report.requests.failed += 1; report.requestFailures.push({ stage, kind: requestKind(details), status: details.statusCode }); }
  });
  player.webContents.on("console-message", (details) => {
    if (["warning", "error"].includes(details.level) && !/preloaded using link preload but not used within a few seconds/.test(details.message)) report.consoleErrors.push(cleanError(details.message));
  });
  await player.loadURL(`${origin}/match-bridge/${matchAccountNumber(state.settings.account.uid)}/${state.settings.publicOverlayRelay.matchChannelId}?soundEnabled=false`);
  assert.equal(await player.webContents.executeJavaScript(`document.fonts.load('16px Inter').then(fonts => fonts.length > 0 && fonts.every(font => font.status === "loaded"))`), true, "la police Inter se charge réellement malgré une éventuelle sonde de cache");
  await waitUntil(() => player.webContents.executeJavaScript('typeof matchPlaybackQueue !== "undefined" && typeof matchPlaybackQueue?.enqueue === "function"'));
  await waitUntil(() => server.sseClients.size === 1);
  const idle = await sample(); assert.equal(idle.playing, false); assert.equal(idle.playbackId, "");
  await player.webContents.executeJavaScript('globalThis.cohostSmokeFrames=0;{const video=document.getElementById("match-video");const observe=()=>{globalThis.cohostSmokeFrames++;video.requestVideoFrameCallback(observe)};video.requestVideoFrameCallback(observe)}');
  const common = () => empty(sdk.CommonMessageData, { roomId: "700", msgId: String(++sequence) });
  const deliver = (kind, packet) => { const frame = normalizeTikTokBattle(kind, packet, { roomId: "700", channelUsername: "fixture_creator", receivedAtMs: clock }); assert.ok(frame); assert.equal(service.handle({ ...frame, source: "source_tiktok" }), true); };
  const advance = (ms) => { clock += ms; for (const timer of [...timers.keys()]) if (timer.at <= clock) { timers.delete(timer); timer.callback(); } };
  const bonusPackets = (multiplier, result = 0) => {
    const rewardAt = String(clock - 100);
    const packet = (extra) => decoded(sdk.WebcastLinkmicBattleTaskMessage, empty(sdk.WebcastLinkmicBattleTaskMessage, {
      common: common(), battleId: "900", ...extra
    }));
    return {
      announced: packet({ battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_START,
        taskStart: empty(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart, {
          battleBonusConfig: empty(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig, {
            rewardPeriodConfig: empty(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_RewardPeriodConfig, {
              rewardMultiple: multiplier, duration: "20", rewardStartTimestamp: rewardAt
            })
          })
        }) }),
      settled: packet({ battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_TASK_SETTLE,
        taskSettle: empty(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle, { taskResult: result, rewardStartTimestamp: rewardAt }) })
    };
  };
  const setting = empty(sdk.BattleSetting, { battleId: "900", startTimeMs: String(clock - 1000), duration: 120, battleType: sdk.BattleType.BATTLE_TYPE_TEAM_BATTLE });
  const start = decoded(sdk.WebcastLinkMicBattle, empty(sdk.WebcastLinkMicBattle, { common: common(), battleId: "900", action: sdk.BattleAction.BATTLE_ACTION_OPEN, battleSetting: setting,
    teamUsers: [empty(sdk.WebcastLinkMicBattle_TeamUsersInfo, { teamId: "101", userIds: ["1"] }), empty(sdk.WebcastLinkMicBattle_TeamUsersInfo, { teamId: "202", userIds: ["3"] })],
    teamArmies: [empty(sdk.BattleTeamUserArmies, { teamId: "101", teamTotalScore: "10", teamUsers: [empty(sdk.BattleTeamUser, { userId: "1", userIdStr: "1", score: "10" })] }),
      empty(sdk.BattleTeamUserArmies, { teamId: "202", teamTotalScore: "20", teamUsers: [empty(sdk.BattleTeamUser, { userId: "3", userIdStr: "3", score: "20" })] })] }));
  await verifyMoment("battleStart", "taptap", "cyber", () => deliver("linkMicBattle", start));
  const firstGift = decoded(sdk.WebcastGiftMessage, empty(sdk.WebcastGiftMessage, {
    common: { ...common(), createTime: String(clock) }, repeatEnd: 0,
    matchInfo: empty(sdk.WebcastGiftMessage_MatchInfo, { multiplierValue: "2", multiplierType: 0, critical: "0", effectCardInUse: false }),
    giftExtra: empty(sdk.WebcastGiftMessage_GiftMonitorInfo, { toUserId: "1" })
  }));
  const giftFrame = normalizeTikTokGiftBonus(firstGift, { roomId: "700", channelUsername: "fixture_creator", receivedAtMs: clock });
  assert.ok(giftFrame);
  await verifyMoment("first-own-gift-x2", "x2", "cyber", () => {
    assert.equal(service.handle({ ...giftFrame, source: "source_tiktok" }), true);
  });
  assert.equal(state.matchSession.multiplier, 1, "la preuve du cadeau ne fabrique aucune durée de bonus");
  assert.equal(service.handle({ ...giftFrame, source: "source_tiktok" }), false, "le même cadeau ne rejoue pas l'animation");
  advance(5000);
  for (const [index, multiplier] of [2, 2, 3].entries()) {
    if (index) advance(25000);
    if (index === 1) {
      const beforeFailed = report.activities.filter((row) => row.level === "success").length, beforeTickets = report.requests.tickets;
      const rivalOnly = bonusPackets(3, 1);
      deliver("linkMicBattleTask", rivalOnly.announced); deliver("linkMicBattleTask", rivalOnly.settled);
      await service.whenIdle(); await delay(150);
      assert.equal(report.activities.filter((row) => row.level === "success").length, beforeFailed, "le bonus gagné seulement par l'adversaire n'exécute aucune animation");
      assert.equal(report.requests.tickets, beforeTickets, "le lecteur ne reçoit aucun ticket pour le bonus adverse");
      advance(1);
    }
    const bonus = bonusPackets(multiplier, index === 2 ? 2 : 0);
    const beforeAnnouncement = report.activities.filter((row) => row.level === "success").length;
    deliver("linkMicBattleTask", bonus.announced); await service.whenIdle();
    assert.equal(report.activities.filter((row) => row.level === "success").length, beforeAnnouncement, "START annonce un bonus mais ne prouve pas qu'il est gagné");
    await verifyMoment(index === 1 ? "multiplierX2-later" : `multiplierX${multiplier}`, `x${multiplier}`, "cyber", () => deliver("linkMicBattleTask", bonus.settled));
  }
  await verifyMoment("snipe", "snipe", "cyber", () => advance(40000));
  assert.equal(state.matchSession.participants.length, 2); assert.equal(state.matchSession.teams.length, 2);
  assert.equal(state.matchSession.ownUserId, "1");
  assert.equal(report.activities.filter((row) => row.level === "success").length, 6);
  assert.equal(report.requests.tickets, 6); assert.ok(report.requests.video >= 6);
  for (const field of ["external", "raw", "privateAssets", "failed"]) assert.equal(report.requests[field], 0, field);
  assert.deepEqual(report.consoleErrors, []); report.ok = true;
}

async function finish(error = null) {
  clearTimeout(deadline);
  if (error) { report.ok = false; report.stage = stage; report.error = cleanError(error); }
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  service?.reset(); player?.destroy(); await server?.stop().catch(() => {});
  process.stdout.write(JSON.stringify({ ok: report.ok, moments: report.playbacks.map((row) => row.moment), requests: report.requests, fontCacheProbes: report.fontCacheProbes.length, report: path.join(output, "report.json"), ...(error ? { error: report.error } : {}) }, null, 2) + "\n");
  app.exit(report.ok ? 0 : 1);
}
app.whenReady().then(run).then(() => finish()).catch(finish);
