"use strict";

const {
  MAX_VIEWERS, COUNTERS, createViewerDatabase, count, text, username, timestamp, imageUrl,
  userKey, viewerId, blockKey, normalizeViewerDatabase, mergeImportedViewer, parseViewerImport
} = require("./viewers/normalization");
const { currentScopes, eventIdentity, scopeFilter } = require("./viewers/identity");
const nameCollator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** Base d'audience locale du propriétaire actif, indépendante du profil de jeu.
 * Index O(1) réutilisés ; aucune copie de l'état complet sur le chemin LIVE.
 */
class ViewerService {
  constructor({ store, clock = () => new Date().toISOString() }) {
    this.store = store;
    this.clock = clock;
    this.cache = null;
  }

  state() { return this.store.state || this.store.getState(); }
  database() { return this.state().viewerDatabase || createViewerDatabase(); }
  index(database) {
    if (this.cache?.database === database) return this.cache;
    const byId = new Map();
    const byUser = new Map();
    for (const row of database.rows) {
      byId.set(row.id, row);
      for (const id of [row.userId, ...row.alternateUserIds]) byUser.set(userKey(row.platform, row.streamer, id), row);
    }
    const blocked = new Set(database.blockedUsers.map((row) => blockKey(row.platform, row.streamer, row.username)));
    this.cache = { database, byId, byUser, blocked };
    return this.cache;
  }

  /** Enregistre uniquement des participants identifiés des sources réelles. */
  recordEvent(event) {
    const state = this.state();
    const identity = eventIdentity(state, event);
    if (!identity || !["gift", "like", "chat", "share", "follow", "subscribe", "join"].includes(event.type)) return false;
    if (!(this.store.getActiveAccountUid?.() || state.settings?.account?.uid)) return false;
    this.store.mutateRuntime((current) => {
      const database = current.viewerDatabase ||= createViewerDatabase();
      const index = this.index(database);
      let row = index.byUser.get(identity.key);
      const now = timestamp(event.timestamp) || this.clock();
      if (!row) {
        if (database.rows.length >= MAX_VIEWERS) {
          const removed = database.rows.shift();
          index.byId.delete(removed.id);
          for (const id of [removed.userId, ...removed.alternateUserIds]) index.byUser.delete(userKey(removed.platform, removed.streamer, id));
        }
        row = { id: viewerId(identity.platform, identity.streamer, identity.userId), platform: identity.platform,
          streamer: identity.streamer, userId: identity.userId, alternateUserIds: [], username: "", name: "", avatarUrl: "",
          ...Object.fromEntries(COUNTERS.map((key) => [key, 0])), firstSeen: now, lastSeen: now, blocked: false };
        database.rows.push(row);
        index.byId.set(row.id, row);
        index.byUser.set(identity.key, row);
      }
      row.username = username(event.user?.name || event.user?.username) || row.username;
      row.name = text(event.user?.displayName) || row.name || row.username || row.userId;
      row.avatarUrl = imageUrl(event.user?.avatarUrl) || row.avatarUrl;
      row.lastSeen = now > row.lastSeen ? now : row.lastSeen;
      row.firstSeen = now < row.firstSeen ? now : row.firstSeen;
      row.events = count(row.events + 1);
      const amount = Math.max(1, count(event.data?.count || 1));
      if (event.type === "gift") { row.gifts = count(row.gifts + amount); row.diamonds = count(row.diamonds + count(event.data?.value) * amount); }
      if (event.type === "like") row.likes = count(row.likes + amount);
      if (event.type === "chat") row.comments = count(row.comments + 1);
      if (event.type === "share") row.shares = count(row.shares + amount);
      database.revision += 1;
    });
    return true;
  }

  /** Bloquer des interactions ne supprime pas les contributions des statistiques. */
  isBlocked(event) {
    const identity = eventIdentity(this.state(), event);
    if (!identity) return false;
    const index = this.index(this.database());
    return index.byUser.get(identity.key)?.blocked === true ||
      index.blocked.has(blockKey(identity.platform, identity.streamer, event.user?.name || event.user?.username));
  }

  /** Une ligne par blocage effectif, y compris un @ sans fiche historique. */
  blockedEntries(database, belongs, includeDetails = true) {
    const entries = new Map();
    for (const item of database.blockedUsers) if (belongs(item)) {
      const key = blockKey(item.platform, item.streamer, item.username);
      entries.set(key, item);
    }
    for (const row of database.rows) if (belongs(row)) {
      const key = row.username ? blockKey(row.platform, row.streamer, row.username) : `row:${row.id}`;
      if (!row.blocked && !entries.has(key)) continue;
      entries.set(key, row);
    }
    // À panneau fermé, compter ne clone ni les fiches ni leurs métadonnées.
    if (!includeDetails) return [...entries.values()];
    return [...entries].map(([key, row]) => ({ id: encodeURIComponent(key), platform: row.platform, streamer: row.streamer,
      username: row.username, rowId: row.id || "", name: row.name || row.username || row.userId,
      avatarUrl: row.avatarUrl || "" })).sort((a, b) => nameCollator.compare(a.username || a.name, b.username || b.name) || a.id.localeCompare(b.id));
  }

  snapshot(options = {}) {
    const state = this.state();
    const database = this.database();
    const belongs = scopeFilter(state, options);
    const scoped = database.rows.filter(belongs);
    const needle = text(options.query, 160).toLocaleLowerCase("fr");
    const ranks = require("../shared/viewer-ranks");
    const rows = scoped.filter((row) => (!needle || `${row.username} ${row.name} ${row.userId}`.toLocaleLowerCase("fr").includes(needle)) &&
      (!options.rank || ranks.rankForDiamonds(row.diamonds).id === options.rank));
    const sort = ["diamonds", "name", "firstSeen", "lastSeen"].includes(options.sort) ? options.sort : "diamonds";
    const direction = options.order === "asc" ? 1 : -1;
    rows.sort((a, b) => direction * (sort === "diamonds" ? a.diamonds - b.diamonds : nameCollator.compare(String(a[sort]), String(b[sort]))) || a.id.localeCompare(b.id));
    const limit = Math.min(200, Math.max(1, count(options.limit) || 50));
    const offset = Math.min(MAX_VIEWERS, count(options.offset));
    const index = this.index(database);
    const rankCounts = new Map();
    for (const row of scoped) {
      const rank = ranks.rankForDiamonds(row.diamonds);
      rankCounts.set(rank.id, { rank, count: (rankCounts.get(rank.id)?.count || 0) + 1 });
    }
    const dominantRank = [...rankCounts.values()].sort((a, b) => b.count - a.count || b.rank.minimum - a.rank.minimum)[0]?.rank || null;
    const blockedEntries = this.blockedEntries(database, belongs, options.includeBlocked === true);
    const blockedUsers = [...new Set(blockedEntries.map((row) => row.username).filter(Boolean))].sort();
    const blockedLimit = Math.min(200, Math.max(1, count(options.blockedLimit) || 50));
    const blockedOffset = Math.min(MAX_VIEWERS * 2, count(options.blockedOffset));
    return {
      rows: rows.slice(offset, offset + limit).map((row) => ({ ...row, alternateUserIds: [...row.alternateUserIds],
        blocked: row.blocked || index.blocked.has(blockKey(row.platform, row.streamer, row.username)),
        rank: ranks.rankForDiamonds(row.diamonds) })),
      total: scoped.length, filteredTotal: rows.length, stats: { diamonds: scoped.reduce((sum, row) => sum + row.diamonds, 0), dominantRank },
      streamers: [...new Set(database.rows.map((row) => row.streamer).concat(database.blockedUsers.map((row) => row.streamer), currentScopes(state).map((scope) => scope.streamer)))].sort(),
      blockedUsers, blockedTotal: blockedEntries.length,
      ...(options.includeBlocked === true ? { blockedEntries: blockedEntries.slice(blockedOffset, blockedOffset + blockedLimit) } : {}),
      revision: database.revision
    };
  }

  mutate(operation) {
    let result;
    // Checkpoint immédiat demandé par l'utilisateur, sans snapshot de tous les jeux.
    this.store.mutateRuntime((state) => {
      state.viewerDatabase ||= createViewerDatabase();
      result = operation(state.viewerDatabase, state);
      state.viewerDatabase.revision += 1;
    }, true);
    this.cache = null;
    return result;
  }

  setBlocked(id, blocked) {
    if (typeof blocked !== "boolean") throw new Error("État de blocage invalide.");
    const row = this.index(this.database()).byId.get(text(id, 100));
    if (!row) throw new Error("Utilisateur introuvable.");
    return this.mutate((database) => {
      row.blocked = blocked;
      const key = blockKey(row.platform, row.streamer, row.username);
      // La liste est par @ : les éventuels doublons de cet @ doivent pouvoir
      // être débloqués depuis n'importe laquelle de leurs lignes.
      if (row.username) for (const duplicate of database.rows) {
        if (blockKey(duplicate.platform, duplicate.streamer, duplicate.username) === key) duplicate.blocked = blocked;
      }
      database.blockedUsers = database.blockedUsers.filter((item) => blockKey(item.platform, item.streamer, item.username) !== key);
      if (blocked && row.username) database.blockedUsers.push({ platform: row.platform, streamer: row.streamer, username: row.username });
      return { updated: true };
    });
  }

  /** Retire seulement le blocage choisi, sans remplacer une liste possiblement ancienne. */
  unblock(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Blocage invalide.");
    if (!["tiktok", "kick"].includes(options.platform)) throw new Error("Plateforme de blocage invalide.");
    const streamer = username(options.streamer);
    if (!streamer || streamer === "*") throw new Error("Streamer de blocage invalide.");
    const handle = username(options.username);
    if (!handle) {
      const row = this.index(this.database()).byId.get(text(options.rowId, 100));
      if (!row || row.platform !== options.platform || row.streamer !== streamer || row.username) throw new Error("Blocage introuvable.");
      return this.setBlocked(row.id, false);
    }
    const key = blockKey(options.platform, streamer, handle);
    const matches = (row) => blockKey(row.platform, row.streamer, row.username) === key;
    const database = this.database();
    if (!database.blockedUsers.some(matches) && !database.rows.some((row) => row.blocked && matches(row))) return { updated: false };
    return this.mutate((current) => {
      current.blockedUsers = current.blockedUsers.filter((row) => !matches(row));
      for (const row of current.rows) if (matches(row)) row.blocked = false;
      return { updated: true };
    });
  }

  setBlockedList(values, options = {}) {
    if (!Array.isArray(values) || values.length > MAX_VIEWERS || values.some((value) => typeof value !== "string")) throw new Error("La liste de blocage est invalide.");
    if (options.streamer === "*") throw new Error("Choisissez un streamer précis pour sa liste de blocage.");
    const handles = [...new Set(values.map(username).filter(Boolean))];
    const state = this.state();
    const belongs = scopeFilter(state, options);
    const requested = username(options.streamer);
    const scopes = requested
      ? [...new Map(this.database().rows.filter(belongs).map((row) => [`${row.platform}:${row.streamer}`, { platform: row.platform, streamer: row.streamer }])).values()]
      : currentScopes(state).filter((scope) => !options.platform || scope.platform === options.platform);
    if (!scopes.length && requested) scopes.push({ platform: options.platform === "kick" ? "kick" : "tiktok", streamer: requested });
    if (!scopes.length) throw new Error("Configurez le compte LIVE à modérer.");
    return this.mutate((database) => {
      database.blockedUsers = database.blockedUsers.filter((row) => !belongs(row));
      for (const scope of scopes) for (const handle of handles) database.blockedUsers.push({ ...scope, username: handle });
      database.blockedUsers = database.blockedUsers.slice(-MAX_VIEWERS);
      for (const row of database.rows) if (belongs(row)) row.blocked = handles.includes(row.username);
      return { updated: true, total: handles.length };
    });
  }

  remove(id) {
    const target = text(id, 100);
    if (!this.index(this.database()).byId.has(target)) throw new Error("Utilisateur introuvable.");
    return this.mutate((database) => { database.rows = database.rows.filter((row) => row.id !== target); return { removed: 1 }; });
  }
  cleanup(options = {}) {
    const belongs = scopeFilter(this.state(), options);
    return this.mutate((database) => { const before = database.rows.length; database.rows = database.rows.filter((row) => !belongs(row) || row.diamonds !== 0); return { removed: before - database.rows.length }; });
  }
  clear(options = {}) {
    const belongs = scopeFilter(this.state(), options);
    return this.mutate((database) => { const before = database.rows.length; database.rows = database.rows.filter((row) => !belongs(row)); return { removed: before - database.rows.length }; });
  }

  export(options = {}) {
    const database = this.database();
    const belongs = scopeFilter(this.state(), { ...options, streamer: options.streamer ?? "*" });
    // La liste blanche normalisée n'inclut aucun UID de compte, token ou message.
    const safe = normalizeViewerDatabase({ rows: database.rows.filter(belongs), blockedUsers: database.blockedUsers.filter(belongs) });
    return { format: "shenpulse-viewers", schemaVersion: 1, exportedAt: this.clock(), rows: safe.rows, blockedUsers: safe.blockedUsers };
  }
  import(value) {
    const incoming = parseViewerImport(value);
    return this.mutate((database) => {
      const rows = new Map(database.rows.map((row) => [row.id, row]));
      for (const row of incoming.rows) rows.set(row.id, rows.has(row.id) ? mergeImportedViewer(rows.get(row.id), row) : row);
      const next = normalizeViewerDatabase({ rows: [...rows.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)).slice(0, MAX_VIEWERS),
        blockedUsers: [...database.blockedUsers, ...incoming.blockedUsers] });
      database.rows = next.rows;
      database.blockedUsers = next.blockedUsers;
      return { imported: incoming.rows.length, total: database.rows.length };
    });
  }

  merge({ ids } = {}) {
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 32 || new Set(ids).size !== ids.length) throw new Error("Choisissez entre 2 et 32 doublons distincts.");
    const rows = ids.map((id) => this.index(this.database()).byId.get(text(id, 100)));
    const target = rows[0];
    if (rows.some((row) => !row) || !target.username || rows.some((row) => row.platform !== target.platform || row.streamer !== target.streamer || row.username !== target.username)) {
      throw new Error("Seuls les doublons du même @, de la même plateforme et du même streamer peuvent être fusionnés.");
    }
    const aliases = [...new Set(rows.flatMap((row) => [row.userId, ...row.alternateUserIds]).filter((id) => id !== target.userId))];
    if (aliases.length > 32) throw new Error("Cette fusion dépasserait 32 identifiants alternatifs.");
    return this.mutate((database) => {
      const latest = [...rows].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))[0];
      for (const key of COUNTERS) target[key] = count(rows.reduce((sum, row) => sum + row[key], 0));
      target.alternateUserIds = aliases;
      target.firstSeen = rows.map((row) => row.firstSeen).filter(Boolean).sort()[0] || "";
      target.lastSeen = latest.lastSeen;
      target.avatarUrl = latest.avatarUrl || target.avatarUrl;
      target.name = latest.name || target.name;
      target.blocked = rows.some((row) => row.blocked);
      const removed = new Set(ids.slice(1));
      database.rows = database.rows.filter((row) => !removed.has(row.id));
      return { merged: rows.length, id: target.id };
    });
  }
}

module.exports = { ViewerService };
