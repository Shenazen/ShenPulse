"use strict";

/** Présentation seule : aucun profil, score ou réglage du transport n'est modifié. */
function creatorMatchesProfileSignature() {
  const tiktok = snapshot?.state?.settings?.tiktok || {};
  const user = tiktok.broadcaster || {};
  return [tiktok.username, tiktok.roomId, user.userId, user.username, user.nickname, user.avatarUrl];
}

function creatorMatchesPresentationParticipants(runtime) {
  const rows = Array.isArray(runtime.participants) ? runtime.participants : [];
  const normalized = (value) => String(value || "").trim().replace(/^@/, "").toLowerCase();
  const tiktok = snapshot?.state?.settings?.tiktok || {};
  const username = normalized(tiktok.username);
  const matching = username ? rows.filter((row) => normalized(row.username) === username) : [];
  const owners = matching.length === 1 ? matching : rows.filter((row) => runtime.ownUserId ? row.id === runtime.ownUserId : row.own === true);
  const ownId = owners.length === 1 ? owners[0].id : "";
  const profile = tiktok.broadcaster || {};
  // Pas d'avatar du compte ShenPulse ni de métadonnées d'un autre @.
  const profileMatches = Boolean(username && normalized(profile.username) === username &&
    (!profile.userId || profile.userId === ownId) && (!runtime.ownUserId || runtime.ownUserId === ownId));
  return rows.map((row) => ({
    ...row, own: Boolean(ownId && row.id === ownId),
    ...(row.id === ownId && profileMatches ? {
      displayName: row.displayName || profile.nickname || row.username,
      avatarUrl: row.avatarUrl || profile.avatarUrl || ""
    } : {})
  })).sort((a, b) => Number(b.own) - Number(a.own));
}

/** Une photo indisponible laisse les initiales, sans casser le flux de scores. */
const creatorMatchesBoundAvatars = new WeakSet();
function creatorMatchesBindAvatars(root) {
  for (const image of root.querySelectorAll(".matches-avatar img")) {
    if (image.complete && image.naturalWidth === 0) image.hidden = true;
    if (creatorMatchesBoundAvatars.has(image)) continue;
    creatorMatchesBoundAvatars.add(image);
    image.addEventListener("error", () => { image.hidden = true; }, { once: true });
  }
}

function creatorMatchesKnownScore(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
}

/** Deux équipes explicites, ou un duel : jamais de total inventé en multi-hôtes. */
function creatorMatchesDuelSides(runtime, participants) {
  const teams = Array.isArray(runtime.teams) ? runtime.teams : [];
  const owner = participants.find((row) => row.own);
  const ownTeam = owner ? teams.find((row) => row.participantIds?.includes(owner.id)) : null;
  if (teams.length === 2 && ownTeam && teams.every((team) => team.participantIds?.length)) {
    const other = teams.find((team) => team !== ownTeam);
    const members = (team) => participants.filter((row) => team.participantIds.includes(row.id));
    return [{ participants: members(ownTeam), score: ownTeam.score, own: true },
      { participants: members(other), score: other.score, own: false }];
  }
  const opponents = participants.filter((row) => !row.own);
  return [{ participants: owner ? [owner] : [], score: owner?.score, own: true },
    { participants: opponents, score: opponents.length === 1 ? opponents[0].score : null, own: false }];
}

function creatorMatchesBalanceMarkup(sides) {
  const known = sides.every((side) => side.participants.length && creatorMatchesKnownScore(side.score));
  const own = Number(sides[0].score), rival = Number(sides[1].score);
  const share = known ? own + rival > 0 ? Math.round(own / (own + rival) * 100) : 50 : 50;
  const description = known ? "Votre score : " + creatorMatchesScore(own) + " · Adversaire : " + creatorMatchesScore(rival) : "Scores encore incomplets";
  return '<div class="matches-balance' + (known ? "" : " is-pending") + '" role="meter" aria-label="Répartition des points du match" aria-valuemin="0" aria-valuemax="100"' +
    (known ? ' aria-valuenow="' + share + '"' : "") + ' aria-valuetext="' + escapeHtml(description) + '" style="--matches-own-share:' + share + '%"><span></span></div>';
}

function creatorMatchesArenaMarkup(runtime, participants) {
  const summary = runtime.session || {};
  const running = runtime.status === "running";
  const result = { win: "Victoire", lose: "Défaite", draw: "Égalité" }[runtime.result];
  const sides = creatorMatchesDuelSides(runtime, participants);
  const roster = JSON.stringify([participants.map(({ id, username, displayName, avatarUrl, own }) => [id, username, displayName, avatarUrl, own]),
    sides.map((side) => side.participants.map((row) => row.id))]);
  const ownRounds = Math.max(0, Number(runtime.rounds?.own ?? runtime.manualWins ?? summary.wins) || 0);
  const rivalRounds = runtime.rounds?.opponent;
  const detection = creatorMatchesDetection(runtime);
  const maxScore = Math.max(0, ...participants.map((row) => Number(row.score) || 0));
  const duel = '<div class="matches-duel-status' + (running ? ' is-running' : '') + '">' + escapeHtml(running ? "Match en cours" : result || "Dernier match reçu") + '</div>' +
    '<div class="matches-clock-panel"><small class="matches-clock-caption">' + (running ? "Temps restant" : "Dernier match") + '</small><div class="matches-duel-topline"><span data-matches-time>' +
    creatorMatchesCountdown(runtime, Date.now(), "Scores reçus de TikTok") + '</span>' + creatorMatchesMultiplierMarkup(runtime) + '</div></div>' +
    '<div class="matches-duel">' + sides.map((side) => '<div class="matches-duel-side' + (side.own ? ' is-own' : ' is-rival') + '">' +
      (side.participants.length ? side.participants.map((person) => creatorMatchesParticipant(person, maxScore)).join("") :
        '<div class="matches-waiting-side">' + creatorMatchesIcon("trophy") + '<span>' + (side.own ? "Votre compte" : "Adversaire") + '</span><small>En attente de TikTok</small></div>') +
      (side.participants.length > 1 ? '<div class="matches-side-total">Équipe <strong data-matches-side-score>' + creatorMatchesScore(side.score) + '</strong></div>' : '') + '</div>').join('<span class="matches-versus" aria-hidden="true">VS</span>') + '</div>' + creatorMatchesBalanceMarkup(sides);
  return '<section class="matches-panel matches-current" data-matches-dashboard-slot="current" data-matches-roster="' + escapeHtml(roster) + '">' +
    '<header class="matches-panel-heading"><h3>' + creatorMatchesIcon("trophy") + 'Le match en direct</h3><span class="matches-state' + (running ? ' is-running' : '') + '">' + escapeHtml(running ? "EN MATCH" : result || "EN ATTENTE") + '</span></header>' +
    '<div class="matches-rounds-control"><div><small>' + (rivalRounds != null ? "MANCHES · PAIRE IDENTIFIÉE" : "COMPTEUR DE MANCHES") + '</small><strong data-matches-rounds>' + creatorMatchesNumber(ownRounds) + ' <span>– ' + (rivalRounds != null ? creatorMatchesNumber(rivalRounds) : "—") + '</span></strong></div><button type="button" class="button small ghost" data-action="matches-correct-wins">Corriger</button></div>' +
    (participants.length ? duel : '<div class="matches-empty"><span>' + creatorMatchesIcon("trophy") + '</span><h4>' + detection.emptyTitle + '</h4><p>Les scores, participants et résultats apparaissent lorsqu’une bataille est réellement reçue.</p></div>') +
    '<footer class="matches-live-note"><strong data-matches-detection-label>' + detection.label + '</strong><span data-matches-detection-detail>' + detection.detail + '</span><details><summary>À propos des données du match</summary><p>La détection ne demande aucune automatisation activée. Les effets restent désactivés par défaut. Les points TikTok du match sont distincts des compteurs de cadeaux et de likes du tableau de bord.</p></details></footer></section>';
}

function creatorMatchesDonorsMarkup(runtime) {
  const donors = (runtime.liveContributors || []).slice().sort((a, b) => Number(b.diamonds || 0) - Number(a.diamonds || 0) || Number(b.likes || 0) - Number(a.likes || 0)).slice(0, 200);
  return '<section class="matches-panel matches-donors" data-matches-dashboard-slot="donors"><header class="matches-panel-heading"><h3>' + creatorMatchesIcon("heart") + 'Donateurs du LIVE</h3><button type="button" class="button small ghost" data-action="matches-clear-donors"' + (donors.length ? "" : " disabled") + '>Vider</button></header>' +
    (donors.length ? '<ol>' + donors.map((donor, index) => '<li class="' + (index === 0 ? "is-first" : "") + '" data-matches-donor="' + escapeHtml(donor.id) + '"><span class="matches-donor-rank">' + (["🥇", "🥈", "🥉"][index] || index + 1) + '</span>' + creatorMatchesAvatar(donor) +
      '<div><strong data-studio-user-content>' + escapeHtml(donor.displayName || donor.username || "Donateur") + '</strong><small data-studio-user-content>' + (donor.username ? '@' + escapeHtml(String(donor.username).replace(/^@/, "")) : "") + '</small></div><b>' +
      '<small class="matches-donor-likes">' + creatorMatchesNumber(donor.likes) + ' likes</small><span class="matches-donor-coins">' + creatorMatchesNumber(donor.diamonds) + ' ◇</span><small class="matches-donor-gifts">' + creatorMatchesNumber(donor.gifts) + ' cadeaux</small></b></li>').join("") + '</ol>' :
      '<div class="matches-muted-empty">' + creatorMatchesIcon("heart") + '<strong>Votre communauté à l’honneur</strong><span>Les contributions du LIVE apparaîtront ici lorsqu’elles sont reçues.</span></div>') + '</section>';
}

function creatorMatchesStatisticsMarkup(runtime) {
  const summary = runtime.session || {};
  return '<section class="matches-stat-grid" data-matches-dashboard-slot="stats" aria-label="Bilan des matchs du profil">' +
    [["trophy", "Manches", summary.battles], ["trophy", "Victoires", summary.wins], ["shield", "Défaites", summary.losses], ["equal", "Égalités", summary.draws]]
      .map(([icon, label, value]) => '<article class="matches-stat"><span>' + creatorMatchesIcon(icon) + '</span><strong>' + creatorMatchesNumber(value) + '</strong><small>' + label + '</small></article>').join("") + '</section>';
}

function creatorMatchesHistoryMarkup(runtime) {
  const history = (runtime.history || []).slice(0, 10);
  return '<section class="matches-panel matches-history" data-matches-dashboard-slot="history"><header class="matches-panel-heading"><div><h3>' + creatorMatchesIcon("clock") + 'Historique récent</h3><p>Les dernières manches de ce compte et de ce profil.</p></div><button type="button" class="button small ghost" data-action="matches-reset-wins">Remettre les victoires à zéro</button></header>' +
    (history.length ? '<div class="matches-history-list">' + history.map((entry) => '<article><span class="matches-result is-' + escapeHtml(entry.result || "unknown") + '">' + escapeHtml({ win: "Victoire", lose: "Défaite", draw: "Égalité" }[entry.result] || "Résultat indisponible") + '</span><span>' +
      (entry.ownScore != null && entry.rivalScore != null ? creatorMatchesNumber(entry.ownScore) + ' – ' + creatorMatchesNumber(entry.rivalScore) : "Match TikTok") + '</span><time>' + (entry.endedAtMs ? escapeHtml(new Date(entry.endedAtMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })) : "") + '</time></article>').join("") + '</div>' :
      '<p class="matches-muted-empty">Aucune manche enregistrée sur ce profil.</p>') + '</section>';
}
