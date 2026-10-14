"use strict";

/** Sept widgets Matchs alimentés par la projection sûre, locale ou HTTPS.
 * Aucun exemple n'est injecté au démarrage ; texte par textContent seulement.
 * Un seul timer existe lorsque l'horloge du match ou un aperçu le nécessite.
 */
const matchWidgetKey = parameters.get("widget") || "";
const matchWidgetStage = document.getElementById("match-widget-stage");
const matchWidgetNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
let matchWidgetState = null;
let matchWidgetSignature = "";
let matchWidgetTimer = null;

function matchWidgetElement(tag, className, text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = String(text || "");
  return node;
}

function matchWidgetScore(value) {
  return value !== null && value !== undefined && value !== "" && (typeof value === "number" || typeof value === "string") && Number.isFinite(Number(value)) && Number(value) >= 0
    ? matchWidgetNumber.format(Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(value)))) : "—";
}

function matchWidgetAvatar(row) {
  const avatar = matchWidgetElement("span", "match-widget-avatar", String(row.displayName || row.username || "?").slice(0, 2).toUpperCase());
  try {
    const url = new URL(row.avatarUrl || "");
    const domains = ["tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "ibyteimg.com", "byteimg.com", "byteoversea.com", "muscdn.com", "kick.com"];
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
      const image = document.createElement("img");
      image.src = url.href;
      image.alt = "";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove(), { once: true });
      avatar.append(image);
    }
  } catch { /* La vignette avec initiales reste visible. */ }
  return avatar;
}

function matchWidgetIdentity(row, own = false) {
  const identity = matchWidgetElement("div", "match-widget-identity");
  identity.append(matchWidgetAvatar(row));
  const names = matchWidgetElement("span", "match-widget-names");
  names.append(matchWidgetElement("strong", "", row.username ? `@${String(row.username).replace(/^@+/, "")}` : row.displayName || "Participant"));
  names.append(matchWidgetElement("small", "", own ? "Votre équipe" : row.displayName || "Équipe adverse"));
  identity.append(names);
  return identity;
}

function matchWidgetLiveContributors(session) {
  return (Array.isArray(session.liveContributors) ? session.liveContributors : []).slice(0, 200).filter((row) => row && (row.username || row.displayName))
    .sort((a, b) => Number(b.diamonds || 0) - Number(a.diamonds || 0) || Number(b.likes || 0) - Number(a.likes || 0));
}

function renderMatchDuo(body, session, participants, config) {
  body.classList.add("match-duo-body");
  const own = participants.find((row) => row.own === true);
  const opponent = participants.find((row) => row.own !== true);
  const donor = config.donorPhoto && session.lastGift?.user && Number(session.lastGift.atMs) > Date.now() - Number(config.switchSeconds || 6) * 1000 ? session.lastGift.user : null;
  for (const [row, rounds, isOwn] of [[own, session.rounds?.own, true], [opponent, session.rounds?.opponent, false]]) {
    const team = matchWidgetElement("div", `match-duo-team${isOwn ? " is-own" : ""}`);
    if (row) {
      const identity = matchWidgetIdentity(isOwn && donor ? donor : row, isOwn);
      if (isOwn && donor) identity.querySelector("small").textContent = "Merci pour votre cadeau";
      team.append(identity);
    } else team.append(matchWidgetElement("span", "match-widget-empty", isOwn ? "Votre équipe" : "En attente d’un adversaire"));
    const value = isOwn ? rounds ?? session.manualWins ?? (!own || !opponent ? session.session?.wins : null) : rounds;
    team.append(matchWidgetElement("strong", "match-duo-rounds", isOwn || row ? matchWidgetScore(value) : "—"));
    team.append(matchWidgetElement("small", "match-duo-round-label", "MANCHES"));
    if (config.showScores && row) team.append(matchWidgetElement("small", "match-duo-score", `${matchWidgetScore(row.score)} POINTS`));
    body.append(team);
    if (isOwn) body.append(matchWidgetElement("b", "match-duo-vs", "VS"));
  }
}

function renderMatchWidget() {
  if (!matchWidgetStage || !matchWidgetState) return;
  const config = matchWidgetState.config?.widgets?.[matchWidgetKey];
  const session = matchWidgetState.session || {};
  const preview = session.preview?.widget === matchWidgetKey && Number(session.preview.expiresAtMs) > Date.now() && Number(session.preview.expiresAtMs) <= Date.now() + 10000;
  const ownParticipant = (Array.isArray(session.participants) ? session.participants : []).find((row) => row?.own === true);
  const victoryVisible = session.status === "ended" && (session.result || ownParticipant?.result) === "win" && Number(session.endedAtMs) > Date.now() - Number(config?.durationSeconds || 5) * 1000;
  if (!config || config.enabled !== true && !preview || matchWidgetKey === "victory" && !victoryVisible && !preview) {
    matchWidgetStage.hidden = true;
    matchWidgetStage.replaceChildren();
    return;
  }
  matchWidgetStage.hidden = false;
  matchWidgetStage.dataset.widget = matchWidgetKey;
  matchWidgetStage.dataset.theme = ["classic", "neon", "gold", "minimal"].includes(config.theme) ? config.theme : "classic";
  matchWidgetStage.style.setProperty("--match-opacity", String(Math.min(100, Math.max(0, Number(config.backgroundOpacity ?? 50))) / 100));
  matchWidgetStage.style.borderRadius = `${Math.min(64, Math.max(0, Number(config.borderRadius ?? 12)))}px`;
  for (const [name, fallback] of [["primary", "#b865ff"], ["secondary", "#22d3ee"], ["text", "#ffffff"]]) {
    const value = config.colors?.[name];
    matchWidgetStage.style.setProperty(`--match-${name}`, /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(String(value || "")) ? value : fallback);
  }
  const header = matchWidgetElement("header", "match-widget-heading");
  header.append(matchWidgetElement("span", "match-widget-emblem", ["wins", "victory"].includes(matchWidgetKey) ? "★" : ["starDonor", "topDonor", "donors"].includes(matchWidgetKey) ? "♛" : matchWidgetKey === "timer" ? "◷" : "VS"));
  header.append(matchWidgetElement("strong", "", String(config.title || "MATCHS").slice(0, 100)));
  if (preview) header.append(matchWidgetElement("small", "match-widget-preview", "APERÇU"));
  const body = matchWidgetElement("div", "match-widget-body");
  if (["fade", "slide", "zoom"].includes(config.animation)) body.classList.add(`match-enter-${config.animation}`);
  const participants = (Array.isArray(session.participants) ? session.participants : []).slice(0, 16);
  if (matchWidgetKey === "wins") {
    renderMatchDuo(body, session, participants, config);
  } else if (["starDonor", "topDonor"].includes(matchWidgetKey)) {
    const contribution = session.lastContribution || (session.lastGift ? { ...session.lastGift, type: "gift" } : null);
    const donor = matchWidgetKey === "starDonor" ? contribution?.user : matchWidgetLiveContributors(session).find((row) => Number(row.diamonds) > 0 || Number(row.gifts) > 0);
    if (donor) {
      body.classList.add("match-star-body");
      body.append(matchWidgetIdentity(donor));
      const total = matchWidgetElement("div", "match-star-score");
      if (matchWidgetKey === "starDonor") {
        const template = contribution.type === "like" ? config.likeMessage || "Merci pour {n} likes" : config.giftMessage || "Merci pour {gift} ×{n}";
        const message = String(template).slice(0, 300).replace(/\{n\}/g, matchWidgetScore(contribution.count)).replace(/\{gift\}/g, String(contribution.giftName || "ce cadeau").slice(0, 100));
        total.append(matchWidgetElement("strong", "match-contribution-message", message));
      } else total.append(matchWidgetElement("strong", "", matchWidgetScore(donor.diamonds)), matchWidgetElement("small", "", "PIÈCES DE CE LIVE"));
      body.append(total);
    } else body.append(matchWidgetElement("p", "match-widget-empty", "En attente des contributions du LIVE"));
  } else if (matchWidgetKey === "donors") {
    body.classList.add("match-donors-body");
    const donors = matchWidgetLiveContributors(session);
    for (const [index, donor] of donors.slice(0, 5).entries()) {
      const row = matchWidgetElement("div", "match-donor-row");
      row.append(matchWidgetElement("b", "match-donor-position", String(index + 1)), matchWidgetIdentity(donor));
      const metrics = matchWidgetElement("div", "match-donor-metrics");
      metrics.append(matchWidgetElement("strong", "", `${matchWidgetScore(donor.diamonds)} PIÈCES`), matchWidgetElement("small", "", `${matchWidgetScore(donor.likes)} LIKES`));
      row.append(metrics);
      body.append(row);
    }
    if (!donors.length) body.append(matchWidgetElement("p", "match-widget-empty", "En attente des contributions du LIVE"));
  } else if (matchWidgetKey === "timer") {
    body.classList.add("match-timer-body");
    body.append(matchWidgetElement("strong", "match-widget-timer", "—"));
    if (config.showStreak) body.append(matchWidgetElement("span", "match-timer-streak", `${matchWidgetScore(session.session?.winStreak)} VICTOIRE${Number(session.session?.winStreak) > 1 ? "S" : ""} D’AFFILÉE`));
    if (config.showSnipe) body.append(matchWidgetElement("b", "match-timer-snipe", `SNIPE · DERNIÈRES ${Math.min(120, Math.max(1, Number(config.snipeSeconds || 30)))} SECONDES`));
  } else if (matchWidgetKey === "victory") {
    body.classList.add("match-victory-body");
    if (ownParticipant) body.append(matchWidgetAvatar(ownParticipant));
    body.append(matchWidgetElement("strong", "", "VICTOIRE"), matchWidgetElement("span", "", `${matchWidgetScore(session.rounds?.own)} MANCHE${Number(session.rounds?.own) > 1 ? "S" : ""}`));
  } else {
    body.classList.add("match-scoreboard-body");
    for (const participant of [...participants].sort((a, b) => Number(b.own === true) - Number(a.own === true))) {
      const row = matchWidgetElement("div", `match-scoreboard-row${participant.own === true ? " is-own" : ""}`);
      row.append(matchWidgetIdentity(participant, participant.own === true), matchWidgetElement("strong", "match-score", matchWidgetScore(participant.score)));
      body.append(row);
    }
    if (!participants.length) body.append(matchWidgetElement("p", "match-widget-empty", "En attente d’un match TikTok"));
  }
  const footer = matchWidgetElement("footer", "match-widget-footer");
  footer.append(matchWidgetElement("span", "match-widget-status", ["live", "active"].includes(session.status) ? "MATCH EN COURS" : session.status === "ended" ? "DERNIER MATCH" : "MATCHS TIKTOK"));
  if (config.customText) footer.append(matchWidgetElement("span", "match-widget-custom-text", String(config.customText).slice(0, 300)));
  if (config.goal && matchWidgetKey === "wins") footer.append(matchWidgetElement("span", "", `OBJECTIF ${matchWidgetScore(config.goal)}`));
  footer.append(matchWidgetElement("span", "match-widget-clock"));
  matchWidgetStage.replaceChildren(header, body, footer);
  updateMatchWidgetClock();
}

function stopMatchWidget() {
  if (matchWidgetTimer) clearInterval(matchWidgetTimer);
  matchWidgetTimer = null;
}

function updateMatchWidgetClock() {
  const session = matchWidgetState?.session || {};
  if (session.preview && Number(session.preview.expiresAtMs) <= Date.now()) {
    delete session.preview;
    renderMatchWidget();
  }
  const remaining = ["live", "active"].includes(session.status) ? Math.max(0, Number(session.timing?.endsAtMs || 0) - Date.now()) : 0;
  const config = matchWidgetState?.config?.widgets?.[matchWidgetKey] || {};
  if (matchWidgetKey === "victory" && !session.preview && Number(session.endedAtMs) <= Date.now() - Number(config.durationSeconds || 5) * 1000) {
    matchWidgetStage.hidden = true;
    stopMatchWidget();
    return;
  }
  if (matchWidgetKey === "wins" && matchWidgetStage.dataset.donorUntil && Date.now() >= Number(matchWidgetStage.dataset.donorUntil)) {
    delete matchWidgetStage.dataset.donorUntil;
    renderMatchWidget();
  }
  const clock = matchWidgetStage?.querySelector(".match-widget-clock");
  if (clock) {
    const seconds = Math.ceil(remaining / 1000);
    clock.textContent = remaining ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "";
  }
  const timer = matchWidgetStage?.querySelector(".match-widget-timer");
  if (timer) timer.textContent = remaining ? clock?.textContent || "—" : "—";
  matchWidgetStage?.classList.toggle("is-snipe", remaining > 0 && remaining <= Math.min(120, Math.max(1, Number(config.snipeSeconds || 30))) * 1000 && config.showSnipe === true);
  if (!remaining && !session.preview && matchWidgetKey !== "victory" && !matchWidgetStage?.dataset.donorUntil) stopMatchWidget();
}

function hydrateMatchWidget(payload = {}) {
  if (viewName !== "match-widget" || !["wins", "starDonor", "topDonor", "donors", "timer", "victory", "scoreboard"].includes(matchWidgetKey)) return;
  const config = payload.config?.widgets?.[matchWidgetKey];
  const session = payload.session || {};
  const selectedSession = { status: session.status, timing: session.timing, preview: session.preview?.widget === matchWidgetKey ? session.preview : undefined,
    ...(["wins", "victory", "scoreboard"].includes(matchWidgetKey) ? { participants: (Array.isArray(session.participants) ? session.participants : []).slice(0, 16).map((row) => ({ username: row.username, displayName: row.displayName, avatarUrl: row.avatarUrl, score: row.score, own: row.own, result: row.result })), rounds: session.rounds, manualWins: session.manualWins, result: session.result, endedAtMs: session.endedAtMs } : {}),
    ...(["topDonor", "donors"].includes(matchWidgetKey) ? { liveContributors: session.liveContributors } : {}),
    ...(matchWidgetKey === "wins" ? { lastGift: session.lastGift } : {}),
    ...(matchWidgetKey === "starDonor" ? { lastGift: session.lastGift, lastContribution: session.lastContribution } : {}),
    ...(["timer", "wins"].includes(matchWidgetKey) ? { session: { winStreak: session.session?.winStreak, wins: session.session?.wins } } : {}) };
  if (!(Number(selectedSession.preview?.expiresAtMs) > Date.now() && Number(selectedSession.preview?.expiresAtMs) <= Date.now() + 10000)) delete selectedSession.preview;
  const selected = { config: { widgets: { [matchWidgetKey]: config } }, session: selectedSession };
  const signature = JSON.stringify(selected);
  if (signature === matchWidgetSignature) return;
  matchWidgetSignature = signature;
  matchWidgetState = JSON.parse(signature);
  stopMatchWidget();
  renderMatchWidget();
  const currentSession = matchWidgetState.session || {};
  const donorUntil = Number(currentSession.lastGift?.atMs || 0) + Number(config?.switchSeconds || 6) * 1000;
  if (matchWidgetKey === "wins" && config?.donorPhoto && donorUntil > Date.now()) matchWidgetStage.dataset.donorUntil = String(donorUntil);
  else delete matchWidgetStage.dataset.donorUntil;
  if (!matchWidgetStage.hidden && (Number(currentSession.timing?.endsAtMs) > Date.now() && ["live", "active"].includes(currentSession.status) || currentSession.preview || matchWidgetKey === "victory" || matchWidgetStage.dataset.donorUntil)) {
    matchWidgetTimer = setInterval(updateMatchWidgetClock, 1000);
  }
}

window.addEventListener("pagehide", stopMatchWidget);
