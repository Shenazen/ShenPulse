"use strict";

const { clone } = require("../utils");
const { PRIVATE_STATE_ROOTS, UNSAFE_PROJECTION_KEYS } = require("./constants");
const { uniqueViewerCount } = require("../../shared/live-statistics");

/** Sélection isolée de chemins explicites : interdit les espaces privés et les prototypes. */
function selectStatePaths(state, paths) {
  if (!Array.isArray(paths)) throw new TypeError("State projection paths must be an array.");
  const selected = paths.map((requestedPath) => {
    if (typeof requestedPath !== "string") throw new TypeError("State projection paths must be strings.");
    const parts = requestedPath.split(".");
    if (parts.some((part) => !part || UNSAFE_PROJECTION_KEYS.has(part)) ||
        PRIVATE_STATE_ROOTS.has(parts[0])) {
      throw new TypeError("This state projection path is not allowed.");
    }
    return parts;
  }).sort((first, second) => first.length - second.length);
  const result = {};
  const included = [];
  for (const parts of selected) {
    if (included.some((parent) => parent.length <= parts.length &&
        parent.every((part, index) => part === parts[index]))) continue;
    let source = state;
    let target = result;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!source || typeof source !== "object" || !Object.hasOwn(source, part)) break;
      if (index === parts.length - 1) {
        target[part] = clone(source[part]);
        included.push(parts);
      } else {
        const child = source[part];
        if (!child || typeof child !== "object") break;
        target[part] ||= Array.isArray(child) ? [] : {};
        source = child;
        target = target[part];
      }
    }
  }
  return result;
}

/** Retire les secrets en clair et indique leur présence, sans révéler leur valeur. */
function sanitizeConnectionSecrets(snapshot, connections, secrets) {
  if (snapshot.connections && typeof snapshot.connections === "object") {
    for (const [key, connection] of Object.entries(snapshot.connections)) {
      if (!connection || typeof connection !== "object") continue;
      const original = connections?.[key];
      connection.hasSecret = secrets
        ? Boolean(original?.secretId && secrets[original.secretId])
        : original?.hasSecret === true;
      delete connection.secret;
    }
  }
  return snapshot;
}

/** L'interface et les exports n'ont jamais besoin des références du coffre d'envoi. */
function sanitizeTikTokChatSettings(snapshot) {
  const chat = snapshot.settings?.tiktok?.chat;
  if (chat && typeof chat === "object") {
    snapshot.settings.tiktok.chat = Object.fromEntries(["provider", "expiresAt", "scopes", "botUsername", "accountUid"]
      .filter((key) => Object.hasOwn(chat, key)).map((key) => [key, chat[key]]));
  }
  return snapshot;
}

/** Snapshot public historique : les espaces inactifs sont exclus avant la copie. */
function getVisibleState(state, secrets) {
  const { accountWorkspaces: _workspaces, accountWorkspaceSchemaVersion: _schema,
    activeAccountUid: _uid, unclaimedAccountWorkspace: _unclaimed,
    viewerDatabase: _viewers, ...visibleState } = state;
  return sanitizeTikTokChatSettings(sanitizeConnectionSecrets(clone(visibleState), state.connections, secrets));
}

/** Projection minimale du moteur : le type d'événement exclut les règles incompatibles avant copie.
 * Sans type, le contrat historique reste complet pour les diagnostics/tests.
 */
function getRuleEngineState(state, eventType) {
  const session = state.session || {};
  const gameSession = session.game || {};
  const packId = String(gameSession.packId || "");
  const rulesByPack = state.game?.interactionRulesByPack || {};
  const filterEvent = eventType !== undefined;
  const eligible = (rule) => !filterEvent || Boolean(rule.enabled && rule.trigger?.enabled !== false &&
    (rule.trigger?.type === "*" || rule.trigger?.type === eventType));
  const profile = (state.profiles || []).find((entry) => entry.id === session.profileId);
  const enabledIds = filterEvent ? new Set(profile?.enabledRuleIds || (state.rules || []).map((rule) => rule.id)) : null;
  const rules = (state.rules || []).filter((rule) => eligible(rule) && (!enabledIds || enabledIds.has(rule.id)));
  const activeRules = gameSession.running === true && packId &&
    gameSession.profileId === session.profileId && Object.hasOwn(rulesByPack, packId) &&
    Array.isArray(rulesByPack[packId]) ? { [packId]: rulesByPack[packId].filter(eligible) } : {};
  return clone({
    rules,
    profiles: filterEvent
      ? profile ? [{ id: profile.id, enabledRuleIds: rules.map((rule) => rule.id) }] : []
      : (state.profiles || []).map((entry) => ({ id: entry.id, enabledRuleIds: entry.enabledRuleIds })),
    session: { profileId: session.profileId, game: gameSession },
    game: { interactionRulesByPack: activeRules }
  });
}

/** Les sélections inter-règles ne copient que leurs actions, dans l'ordre historique.
 * L'identifiant dupliqué conserve donc la dernière action, comme selectRuleActions.
 */
function getRuleActionState(state, actionIds) {
  const selected = new Set((Array.isArray(actionIds) ? actionIds : []).map(String).filter(Boolean));
  if (!selected.size) return [];
  const actions = [];
  for (const rule of state.rules || []) {
    const entries = Array.isArray(rule.actions) ? rule.actions : rule.actions ? [rule.actions] : [];
    for (const action of entries) if (action?.id && selected.has(String(action.id))) actions.push(action);
  }
  return clone([{ actions }]);
}

/** État du service de présence : aucun catalogue, espace de compte ou secret. */
function getLiveDirectoryState(state) {
  const settings = state.settings;
  const { chat: _chat, ...tiktok } = settings.tiktok || {};
  return clone({
    settings: {
      account: { uid: settings.account?.uid || "" },
      liveDirectory: settings.liveDirectory,
      tiktok,
      kick: {
        live: settings.kick?.live,
        viewers: settings.kick?.viewers,
        account: settings.kick?.account
      }
    },
    connections: state.connections
      .filter((entry) => ["source_tiktok", "source_kick"].includes(entry.id))
      .map(({ id, type, enabled, status, liveStatus, config }) => ({
        id, type, enabled, status, liveStatus,
        config: { username: config?.username || "" }
      }))
  });
}

/** Projection interne sécurisée : les mêmes règles de secret que le snapshot complet. */
function getStateProjection(state, secrets, paths) {
  return sanitizeConnectionSecrets(selectStatePaths(state, paths), state.connections, secrets);
}

/** Petit résumé destiné aux changements visuels, pas aux services métier.
 * Les collections complètes restent uniquement sur disque et dans les lectures
 * internes explicites ; la page Utilisateurs dispose de son API paginée.
 */
function getRendererStatistics(statistics = {}) {
  const scalar = (source) => Object.fromEntries(Object.entries(source).filter(([, value]) =>
    value === null || ["number", "string", "boolean"].includes(typeof value)));
  const result = scalar(statistics);
  result.sessionUniqueViewerCount = uniqueViewerCount(statistics);
  result.uniqueViewerCount = uniqueViewerCount(statistics, false);
  result.sessionUniqueViewers = [];
  result.uniqueViewers = [];
  if (statistics.liveSession && typeof statistics.liveSession === "object") {
    const live = statistics.liveSession;
    const top = [];
    const donors = Array.isArray(live.topDonors) && live.topDonors.length ? live.topDonors : live.participants;
    for (const row of Array.isArray(donors) ? donors : []) {
      if (!row || !Number.isFinite(Number(row.coins)) || Number(row.coins) <= 0) continue;
      let position = 0;
      while (position < top.length && Number(top[position].coins) >= Number(row.coins)) position += 1;
      if (position < 5) { top.splice(position, 0, row); if (top.length > 5) top.pop(); }
    }
    const topDonors = top.map((row) => Object.fromEntries([
        "id", "name", "username", "avatarUrl", "platform", "subscriber", "moderator", "teamLevel",
        "events", "likes", "gifts", "coins", "comments", "shares", "follows", "lastSeen"
      ].filter((key) => Object.hasOwn(row, key) && (row[key] === null || ["number", "string", "boolean"].includes(typeof row[key])))
        .map((key) => [key, row[key]])));
    result.liveSession = {
      ...scalar(live),
      participantCount: Array.isArray(live.participants) ? live.participants.length : 0,
      participants: topDonors.map((row) => ({ ...row })),
      topDonors,
      viewersByPlatform: clone(live.viewersByPlatform || { tiktok: null, kick: null }),
      audienceHistory: clone((Array.isArray(live.audienceHistory) ? live.audienceHistory : []).slice(-120)),
      engagementHistory: clone((Array.isArray(live.engagementHistory) ? live.engagementHistory : []).slice(-120))
    };
  }
  return result;
}

function getRuntimeState(state, secrets) {
  const result = getStateProjection(state, secrets, ["activity", "session", "overlaySession", "matchSession", "settings.tiktok"]);
  result.statistics = getRendererStatistics(state.statistics);
  return sanitizeTikTokChatSettings(result);
}

module.exports = { selectStatePaths, getVisibleState, getStateProjection, getRuleEngineState, getRuleActionState, getLiveDirectoryState, getRendererStatistics, getRuntimeState };
