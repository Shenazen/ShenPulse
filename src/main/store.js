"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createDefaultState, createEmptyProfileWorkspace } = require("./defaults");
const { clone, id } = require("./utils");
const { AtomicJsonStorage } = require("./state/json-storage");
const { WorkspaceManager } = require("./state/workspace-manager");
const { migrateState } = require("./state/migrations");
const { RUNTIME_CHECKPOINT_MS } = require("./state/constants");
const { cleanAccountUid, accountWorkspaceKey, createAccountWorkspaceFromState, normalizeAccountWorkspace } = require("./state/account-workspace");
const { normalizeRules, normalizeRuleActionSelection } = require("./state/rule-normalization");
const { normalizeWheelSegmentActions } = require("./state/overlay-configs");
const projections = require("./state/projections");
const { collectGiftReferenceUpdates, applyGiftReferenceUpdates, GIFT_IDENTITY_CORRECTION_REASON } = require("./state/gift-upgrade-migration");
const { settingsForProfileImport } = require("./settings-access");

/** Façade de l'état local : API stable, mutations, secrets et cadence des sauvegardes. */
class StateStore {
  constructor(userDataDirectory, safeStorage, { onPersistenceStatus } = {}) {
    this.directory = userDataDirectory;
    this.storage = new AtomicJsonStorage();
    this.workspaces = new WorkspaceManager(this);
    this.filePath = path.join(userDataDirectory, "shenpulse-state.json");
    this.secretPath = path.join(userDataDirectory, "shenpulse-secrets.json");
    this.safeStorage = safeStorage;
    this.state = createDefaultState();
    this.secrets = {};
    this.writeTimer = null;
    this.runtimeWriteTimer = null;
    this.persistenceRetryTimer = null;
    this.persistenceFailure = null;
    this.persistenceRetryAttempts = 0;
    this.onPersistenceStatus = typeof onPersistenceStatus === "function" ? onPersistenceStatus : null;
    this.persistenceStatusSignature = "";
    this.giftReferenceCatalog = [];
  }

  /** Lit l'état, récupère une génération valide si nécessaire, puis applique les migrations. */
  load() {
    fs.mkdirSync(this.directory, { recursive: true });
    this.state = this.storage.readJson(this.filePath, createDefaultState());
    this.secrets = this.storage.readJson(this.secretPath, {});
    migrateState(this);
    return this.getState();
  }

  /** Copie complète pour l'interface ou un export, sans espaces de comptes privés. */
  getState() { return projections.getVisibleState(this.state, this.secrets); }

  /** Copie uniquement les chemins explicitement demandés par un service interne. */
  getStateProjection(paths) { return projections.getStateProjection(this.state, this.secrets, paths); }

  /** Runtime-only diagnostic: no filesystem paths, state data or secrets. */
  getPersistenceStatus() {
    return { pending: Boolean(this.persistenceFailure), errorCode: this.persistenceFailure?.code || "",
      retryScheduled: Boolean(this.persistenceRetryTimer), attempts: this.persistenceRetryAttempts };
  }

  #notifyPersistenceStatus() {
    const status = this.getPersistenceStatus(), signature = JSON.stringify(status);
    if (signature === this.persistenceStatusSignature) return;
    this.persistenceStatusSignature = signature;
    try { this.onPersistenceStatus?.(status); } catch { /* Diagnostics must never prevent a safe disk write. */ }
  }

  /** Résumé visuel fréquent : top 5 donateurs, pas la base complète de l'audience. */
  getRuntimeState() { return projections.getRuntimeState(this.state, this.secrets); }

  /** Identité locale isolée, utilisée par le service d'authentification. */
  getAccountSession() { return clone(this.state.settings.account || {}); }

  /** Règles actives compatibles avec l'événement, sans copier les autres configurations. */
  getRuleEngineState(eventType) { return projections.getRuleEngineState(this.state, eventType); }

  /** Actions de sélection inter-règles ; aucune copie des actions non demandées. */
  getRuleActionState(actionIds) { return projections.getRuleActionState(this.state, actionIds); }

  /** Données nécessaires au service de présence, sans les configurations privées. */
  getLiveDirectoryState() { return projections.getLiveDirectoryState(this.state); }

  /** UID du propriétaire actif ; chaîne vide pour l'espace anonyme. */
  getActiveAccountUid() {
    return cleanAccountUid(this.state.activeAccountUid);
  }

  /** Répare tous les profils/comptes après mise à jour du catalogue, avec une sauvegarde permanente préalable. */
  reconcileGiftReferences(gifts = this.giftReferenceCatalog, { immediate = true } = {}) {
    this.giftReferenceCatalog = Array.isArray(gifts) ? gifts : [];
    const updates = collectGiftReferenceUpdates(this.state, this.giftReferenceCatalog);
    if (!updates.length) return { changed: 0 };
    let backupPath = this.#preserveGiftReferenceBackup();
    if (updates.some((update) => update.reason === GIFT_IDENTITY_CORRECTION_REASON)) {
      backupPath = this.#preserveGiftReferenceBackup("shenpulse-state.before-gift-identity-v2.json");
    }
    // Une sauvegarde impossible interdit la migration ; aucune référence n'a
    // encore été modifiée lorsque l'écriture/validation précédente échoue.
    const changed = applyGiftReferenceUpdates(updates);
    this.touch(immediate);
    return { changed, backupPath };
  }

  /** Conserve l'état original une seule fois ; une sauvegarde invalide n'est jamais écrasée. */
  #preserveGiftReferenceBackup(fileName = "shenpulse-state.before-gift-references-v1.json", state = this.state) {
    const backupPath = path.join(this.directory, fileName);
    if (fs.existsSync(backupPath)) this.storage.parseJsonFile(backupPath);
    else this.storage.atomicWrite(backupPath, JSON.stringify(state, null, 2), false);
    return backupPath;
  }

  /** Conserve la génération originale avant récupération d'un cache de compte absent. */
  preserveAccountWorkspaceRecovery() {
    const backupPath = path.join(this.directory, "shenpulse-state.before-account-workspace-recovery-v1.json");
    if (fs.existsSync(backupPath)) this.storage.parseJsonFile(backupPath);
    else {
      const content = fs.existsSync(this.filePath)
        ? this.storage.parseJsonFile(this.filePath).content
        : JSON.stringify(this.state, null, 2);
      this.storage.atomicWrite(backupPath, content, false);
    }
    return backupPath;
  }

  /** Sauvegarde l'ancien propriétaire, puis charge exclusivement le compte demandé. */
  activateAccount(uid, accountSession = null) {
    const targetUid = cleanAccountUid(uid);
    if (!targetUid) {
      throw new Error("Le compte ShenPulse ne possède pas d’identifiant valide.");
    }
    if (accountSession !== null && (typeof accountSession !== "object" ||
        Array.isArray(accountSession) || cleanAccountUid(accountSession.uid) !== targetUid)) {
      throw new Error("L'identité de connexion ne correspond pas au compte demandé.");
    }
    const currentUid = this.getActiveAccountUid();
    if (currentUid === targetUid && !accountSession) return this.getState();

    const nextState = clone(this.state);
    const nextWorkspaces = new WorkspaceManager({ state: nextState });
    nextWorkspaces.syncActiveAccountWorkspace();
    nextState.accountWorkspaces ||= {};
    const key = accountWorkspaceKey(targetUid);
    if (!nextState.accountWorkspaces[key]) {
      nextState.accountWorkspaces[key] =
        nextWorkspaces.claimUnclaimedWorkspace(targetUid);
    }
    nextState.activeAccountUid = targetUid;
    if (currentUid !== targetUid) nextWorkspaces.loadAccountWorkspace(targetUid);
    // L'identité est écrite dans la même transaction que son espace. Un arrêt
    // entre deux lignes ne doit jamais laisser les profils B sous la session A.
    nextState.settings.account = accountSession
      ? { ...clone(accountSession), uid: targetUid }
      : createDefaultState().settings.account;
    return this.#commitAccountTransition(nextState);
  }

  /** Conserve la configuration du compte et affiche un espace anonyme vierge. */
  deactivateAccount() {
    const nextState = clone(this.state);
    const nextWorkspaces = new WorkspaceManager({ state: nextState });
    nextWorkspaces.syncActiveAccountWorkspace();
    nextState.activeAccountUid = "";
    nextWorkspaces.loadAnonymousWorkspace();
    nextState.settings.account = createDefaultState().settings.account;
    return this.#commitAccountTransition(nextState);
  }

  /** Un changement de compte n'est visible qu'après confirmation de sa sauvegarde. */
  #commitAccountTransition(nextState) {
    new WorkspaceManager({ state: nextState }).syncActiveAccountWorkspace();
    nextState.updatedAt = new Date().toISOString();
    this.storage.atomicWrite(this.filePath, JSON.stringify(nextState, null, 2));
    this.#clearWriteTimers();
    this.persistenceFailure = null; this.persistenceRetryAttempts = 0;
    this.#notifyPersistenceStatus();
    this.state = nextState;
    return this.getState();
  }

  /** Modifie une configuration isolée ; le changement de profil emprunte son chemin dédié. */
  set(pathParts, value) {
    const parts = Array.isArray(pathParts)
      ? [...pathParts]
      : String(pathParts).split(".");
    if (parts.join(".") === "session.profileId") {
      return this.selectProfile(value);
    }
    let target = this.state;
    while (parts.length > 1) {
      const part = parts.shift();
      if (!target[part] || typeof target[part] !== "object") target[part] = {};
      target = target[part];
    }
    target[parts[0]] = clone(value);
    this.touch();
    return this.getState();
  }

  /** Mutation de configuration : synchronise les workspaces et renvoie un snapshot public. */
  mutate(mutator, immediate = false) {
    mutator(this.state);
    this.touch(immediate);
    return this.getState();
  }

  /** Mutation fréquente du LIVE : ni snapshot complet, ni duplication des workspaces. */
  mutateRuntime(mutator, immediate = false) {
    mutator(this.state);
    this.touch(immediate, false);
  }

  /** Ajoute ou remplace une entrée ; un nouveau profil reçoit une configuration indépendante. */
  upsert(collection, item) {
    return this.mutate((state) => {
      const entries = state[collection];
      const copy =
        collection === "rules"
          ? normalizeRules([item])[0]
          : clone(item);
      if (!copy.id) copy.id = id(collection.slice(0, -1));
      const index = entries.findIndex((entry) => entry.id === copy.id);
      if (collection === "profiles") {
        if (index >= 0) {
          copy.workspace = entries[index].workspace;
          copy.enabledRuleIds = entries[index].enabledRuleIds || [];
          entries[index] = { ...entries[index], ...copy };
        } else {
          copy.workspace = createEmptyProfileWorkspace();
          copy.enabledRuleIds = [];
          entries.push(copy);
        }
      } else if (index >= 0) {
        entries[index] = { ...entries[index], ...copy };
      } else {
        entries.push(copy);
      }
    }, collection === "profiles");
  }

  /** Enregistre une interaction de jeu sur disque avant de rendre la main. */
  upsertGameInteraction(packId, item) {
    const targetPackId = String(packId || "").trim();
    if (!targetPackId) throw new Error("Jeu introuvable.");
    return this.mutate((state) => {
      state.game.interactionRulesByPack ||= {};
      const entries =
        state.game.interactionRulesByPack[targetPackId] ||= [];
      const copy = clone(item);
      if (!copy.id) copy.id = id("game_rule");
      const index = entries.findIndex((entry) => entry.id === copy.id);
      if (index >= 0) entries[index] = { ...entries[index], ...copy };
      else entries.push(copy);
    }, true);
  }

  /** Retire une interaction d'un seul pack, avec persistance immédiate. */
  removeGameInteraction(packId, ruleId) {
    const targetPackId = String(packId || "").trim();
    const targetRuleId = String(ruleId || "").trim();
    return this.mutate((state) => {
      state.game.interactionRulesByPack ||= {};
      const entries =
        state.game.interactionRulesByPack[targetPackId] || [];
      state.game.interactionRulesByPack[targetPackId] = entries.filter(
        (entry) => entry.id !== targetRuleId
      );
    }, true);
  }

  /** Retire une entrée en conservant au moins un profil et une sélection valide. */
  remove(collection, itemId) {
    if (collection === "profiles") {
      if (this.state.profiles.length <= 1) {
        throw new Error("Au moins un profil doit être conservé.");
      }
      this.workspaces.syncActiveProfileWorkspace();
      const wasActive = this.state.session.profileId === itemId;
      this.state.profiles = this.state.profiles.filter(
        (profile) => profile.id !== itemId
      );
      if (wasActive) {
        this.state.session.profileId = this.state.profiles[0].id;
        this.workspaces.loadProfileWorkspace(this.state.session.profileId);
      }
      this.touch(true);
      return this.getState();
    }
    return this.mutate((state) => {
      state[collection] = state[collection].filter((item) => item.id !== itemId);
    });
  }

  /** Change de profil sans mélanger les actions et arrête le jeu lié à l'ancien profil. */
  selectProfile(profileId) {
    const targetId = String(profileId || "").trim();
    const target = this.state.profiles.find(
      (profile) => profile.id === targetId
    );
    if (!target) throw new Error("Ce profil n’existe plus.");
    if (targetId === this.state.session.profileId) return this.getState();

    this.workspaces.syncActiveProfileWorkspace();
    this.state.session.game = {
      running: false,
      packId: "",
      profileId: "",
      startedAt: null
    };
    this.state.session.profileId = targetId;
    this.workspaces.loadProfileWorkspace(targetId);
    this.touch(true);
    return this.getState();
  }

  /** Ajoute une activité bornée par la limite d'historique, sans snapshot global. */
  addActivity(entry) {
    this.mutateRuntime((state) => {
      state.activity.unshift({
        id: entry.id || id("activity"),
        timestamp: entry.timestamp || new Date().toISOString(),
        ...clone(entry)
      });
      state.activity = state.activity.slice(
        0,
        Math.max(100, Number(state.settings.historyLimit) || 2000)
      );
    });
  }

  /** Stocke un secret via safeStorage si disponible ; une valeur vide supprime sa référence. */
  setSecret(secretId, value) {
    const targetId = secretId || id("secret");
    const plainText = String(value || "");
    if (!plainText) {
      delete this.secrets[targetId];
    } else if (this.safeStorage?.isEncryptionAvailable()) {
      this.secrets[targetId] = {
        encrypted: true,
        value: this.safeStorage.encryptString(plainText).toString("base64")
      };
    } else {
      this.secrets[targetId] = {
        encrypted: false,
        value: Buffer.from(plainText, "utf8").toString("base64")
      };
    }
    this.#writeSecrets();
    return targetId;
  }

  /** Déchiffre un secret local ; renvoie une chaîne vide si le coffre est illisible. */
  getSecret(secretId) {
    const secret = this.secrets[secretId];
    if (!secret?.value) return "";
    const buffer = Buffer.from(secret.value, "base64");
    try {
      return secret.encrypted
        ? this.safeStorage.decryptString(buffer)
        : buffer.toString("utf8");
    } catch {
      return "";
    }
  }

  /** Réinitialisation explicite des données et du coffre, jamais appelée par une migration. */
  clearAllData() {
    this.state = createDefaultState();
    this.secrets = {};
    this.touch(true);
    this.#writeSecrets();
    return this.getState();
  }

  /** Importe uniquement dans le compte actif, sans réutiliser le consentement de l'exporteur. */
  importState(imported) {
    if (!imported || typeof imported !== "object" || !Array.isArray(imported.rules)) {
      throw new Error("Le fichier importé n'est pas un profil ShenPulse valide.");
    }
    const uid = this.getActiveAccountUid();
    if (!uid) {
      throw new Error(
        "Connectez-vous au compte qui doit posséder cette configuration."
      );
    }
    const importedSettings = settingsForProfileImport(this, imported.settings, this.state.settings);
    const importedState = {
      ...createDefaultState(),
      ...clone(imported),
      settings: {
        ...createDefaultState().settings,
        ...importedSettings,
        // Un export tiers ne peut ni activer l'envoi ni pointer vers le coffre
        // local d'un autre compte. Le consentement courant reste inchangé.
        tiktok: {
          ...createDefaultState().settings.tiktok,
          ...(importedSettings.tiktok || {}),
          chat: this.state.settings.tiktok?.chat?.accountUid === uid
            ? clone(this.state.settings.tiktok.chat)
            : { provider: "none" }
        },
        // Importer la configuration d'un tiers ne vaut pas consentement à une présence publique.
        liveDirectory: { publishEnabled: this.state.settings.liveDirectory?.publishEnabled === true }
      }
    };
    // Les exports pré-workspaces portent encore les actions à la racine.
    // Les convertir comme au démarrage avant la capture évite qu'un profil
    // sans workspace soit normalisé en espace vide et perde ses associations.
    new WorkspaceManager({ state: importedState }).migrateProfileWorkspaces();
    // Toute la préparation se fait sur une copie : ni les espaces actuels ni
    // les échéances de sauvegarde ne changent si la sauvegarde est impossible.
    const nextState = clone(this.state);
    const nextWorkspaces = new WorkspaceManager({ state: nextState });
    nextWorkspaces.syncActiveAccountWorkspace();
    nextState.accountWorkspaces[accountWorkspaceKey(uid)] =
      normalizeAccountWorkspace(
        createAccountWorkspaceFromState(importedState, uid),
        uid
      );
    nextWorkspaces.loadAccountWorkspace(uid);
    const updates = collectGiftReferenceUpdates(nextState, this.giftReferenceCatalog);
    if (updates.length) this.#preserveGiftReferenceBackup();
    if (updates.some((update) => update.reason === GIFT_IDENTITY_CORRECTION_REASON)) {
      this.#preserveGiftReferenceBackup("shenpulse-state.before-gift-identity-v2.json", nextState);
    }
    applyGiftReferenceUpdates(updates);
    nextWorkspaces.syncActiveProfileWorkspace();
    nextWorkspaces.syncActiveAccountWorkspace(false);
    nextState.updatedAt = new Date().toISOString();
    // Écrire avant le commit mémoire interdit qu'un import annoncé en échec
    // remplace la configuration actuelle lors d'un prochain flush automatique.
    this.storage.atomicWrite(this.filePath, JSON.stringify(nextState, null, 2));
    this.#clearWriteTimers();
    this.persistenceFailure = null; this.persistenceRetryAttempts = 0;
    this.#notifyPersistenceStatus();
    this.state = nextState;
    return this.getState();
  }

  /** Planifie une sauvegarde : 200 ms pour la configuration, échéance fixe de 5 s pour le LIVE. */
  touch(immediate = false, syncWorkspace = true) {
    if (syncWorkspace) this.workspaces.syncActiveProfileWorkspace();
    if (syncWorkspace) this.workspaces.syncActiveAccountWorkspace(false);
    this.state.updatedAt = new Date().toISOString();
    if (immediate) {
      this.#writeState();
    } else if (syncWorkspace) {
      // Les événements LIVE ne repoussent jamais une sauvegarde de configuration.
      if (this.writeTimer) clearTimeout(this.writeTimer);
      this.writeTimer = setTimeout(() => this.#writeStateDeferred(), 200);
    } else if (!this.runtimeWriteTimer) {
      // Échéance fixe : un flux continu reste sauvegardé sans réécrire le fichier à chaque événement.
      this.runtimeWriteTimer = setTimeout(() => this.#writeStateDeferred(), RUNTIME_CHECKPOINT_MS);
      this.runtimeWriteTimer.unref?.();
    }
  }

  /** Sauvegarde finale synchrone ; annule les échéances encore programmées. */
  flush() {
    this.#writeState();
    this.#writeSecrets();
  }

  #writeState() {
    this.#clearWriteTimers();
    try {
      this.workspaces.syncActiveAccountWorkspace();
      this.storage.atomicWrite(this.filePath, JSON.stringify(this.state, null, 2));
      this.persistenceFailure = null; this.persistenceRetryAttempts = 0;
      this.#notifyPersistenceStatus();
    } catch (error) {
      const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : "PERSISTENCE_WRITE_FAILED";
      if (!this.persistenceFailure) console.warn(`[ShenPulse] Sauvegarde locale en attente (${code}). Les donnees restent en memoire.`);
      this.persistenceFailure = { code };
      this.#notifyPersistenceStatus();
      throw error; // Explicit saves/imports/flush must never report a false success.
    }
  }

  #clearWriteTimers() {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    if (this.runtimeWriteTimer) clearTimeout(this.runtimeWriteTimer);
    if (this.persistenceRetryTimer) clearTimeout(this.persistenceRetryTimer);
    this.writeTimer = null;
    this.runtimeWriteTimer = null;
    this.persistenceRetryTimer = null;
  }

  #writeStateDeferred() {
    try { this.#writeState(); }
    catch (error) {
      // A timer exception would open Electron's blocking error dialog. Keep
      // the failure visible in diagnostics and retry only filesystem locks,
      // always serializing the newest in-memory state, never a stale snapshot.
      const delays = [250, 1000, 3000];
      if (!["EPERM", "EACCES", "EBUSY"].includes(error?.code) || this.persistenceRetryAttempts >= delays.length) return;
      const delay = delays[this.persistenceRetryAttempts++];
      this.persistenceRetryTimer = setTimeout(() => this.#writeStateDeferred(), delay);
      this.persistenceRetryTimer.unref?.();
      this.#notifyPersistenceStatus();
    }
  }

  #writeSecrets() {
    this.storage.atomicWrite(this.secretPath, JSON.stringify(this.secrets, null, 2));
  }

}

module.exports = { StateStore, normalizeRuleActionSelection, normalizeRules, normalizeWheelSegmentActions };
