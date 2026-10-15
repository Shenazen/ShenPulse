"use strict";

const { clone } = require("../utils");
const { createDefaultState } = require("../defaults");
const sceneLayout = require("../../../resources/overlays/scene-layout");
const { ACCOUNT_WORKSPACE_SCHEMA_VERSION } = require("./constants");
const { cleanAccountUid, accountWorkspaceKey, createAccountWorkspaceFromState, createEmptyAccountWorkspace, normalizeAccountWorkspace, applyAccountWorkspace } = require("./account-workspace");
const { normalizeProfileWorkspace, captureProfileWorkspace } = require("./profile-workspace");
const { createMatchSession } = require("../../shared/matches-contract");

/** Orchestration des comptes et profils ; aucune lecture des espaces inactifs n'est publique. */
class WorkspaceManager {
  constructor(store) { this.store = store; }

  get state() { return this.store.state; }

  /** Migration des anciens espaces : une configuration non réclamée n'est attribuée qu'une fois. */
  migrateAccountWorkspaces() {
    const storedAccountUid = cleanAccountUid(
      this.state.settings?.account?.uid
    );
    const hasLocalSession = Boolean(
      storedAccountUid &&
      this.state.settings?.account?.refreshTokenSecretId &&
      this.store.getSecret(
        this.state.settings.account.refreshTokenSecretId
      )
    );
    const existingWorkspaces =
      this.state.accountWorkspaces &&
      typeof this.state.accountWorkspaces === "object" &&
      !Array.isArray(this.state.accountWorkspaces)
        ? this.state.accountWorkspaces
        : {};
    // Certaines anciennes générations possèdent encore la configuration à la
    // racine mais ont perdu son entrée de cache. L'UID actif explicite prouve
    // son propriétaire ; ne jamais attribuer cette copie au prochain connecté.
    const rootOwnerUid = cleanAccountUid(this.state.activeAccountUid) ||
      (!Object.hasOwn(this.state, "activeAccountUid") ? storedAccountUid : "");
    const rootKey = accountWorkspaceKey(rootOwnerUid);
    if (rootOwnerUid && (!existingWorkspaces[rootKey] ||
        typeof existingWorkspaces[rootKey] !== "object" || Array.isArray(existingWorkspaces[rootKey]))) {
      this.store.preserveAccountWorkspaceRecovery?.();
      existingWorkspaces[rootKey] = createAccountWorkspaceFromState(this.state, rootOwnerUid);
    }
    this.state.accountWorkspaces = Object.fromEntries(
      Object.entries(existingWorkspaces)
        .filter(([, workspace]) => workspace && typeof workspace === "object")
        .map(([key, workspace]) => {
          const ownerUid = cleanAccountUid(workspace.ownerUid);
          return [
            key,
            normalizeAccountWorkspace(workspace, ownerUid)
          ];
        })
    );

    if (
      Number(this.state.accountWorkspaceSchemaVersion || 0) <
      ACCOUNT_WORKSPACE_SCHEMA_VERSION
    ) {
      const legacyWorkspace = createAccountWorkspaceFromState(
        this.state,
        storedAccountUid
      );
      if (storedAccountUid) {
        this.state.accountWorkspaces[
          accountWorkspaceKey(storedAccountUid)
        ] = legacyWorkspace;
      } else {
        this.state.unclaimedAccountWorkspace = legacyWorkspace;
      }
      this.state.accountWorkspaceSchemaVersion =
        ACCOUNT_WORKSPACE_SCHEMA_VERSION;
    }

    if (storedAccountUid && hasLocalSession) {
      const key = accountWorkspaceKey(storedAccountUid);
      if (!this.state.accountWorkspaces[key]) {
        this.state.accountWorkspaces[key] =
          this.claimUnclaimedWorkspace(storedAccountUid);
      }
      this.state.activeAccountUid = storedAccountUid;
      this.loadAccountWorkspace(storedAccountUid);
      return;
    }

    this.state.activeAccountUid = "";
    this.loadAnonymousWorkspace();
  }

  claimUnclaimedWorkspace(uid) {
    const unclaimed =
      this.state.unclaimedAccountWorkspace &&
      typeof this.state.unclaimedAccountWorkspace === "object"
        ? this.state.unclaimedAccountWorkspace
        : null;
    delete this.state.unclaimedAccountWorkspace;
    return unclaimed
      ? normalizeAccountWorkspace(unclaimed, uid)
      : createEmptyAccountWorkspace(uid);
  }

  /** Synchronise le propriétaire ; syncProfile=false évite une capture de profil déjà effectuée. */
  syncActiveAccountWorkspace(syncProfile = true) {
    const uid = cleanAccountUid(this.state.activeAccountUid);
    if (!uid) return;
    if (syncProfile) this.syncActiveProfileWorkspace();
    this.state.accountWorkspaces ||= {};
    this.state.accountWorkspaces[accountWorkspaceKey(uid)] =
      createAccountWorkspaceFromState(this.state, uid);
  }

  /** Charge uniquement l'espace correspondant à l'UID demandé, avec une normalisation unique. */
  loadAccountWorkspace(uid) {
    const targetUid = cleanAccountUid(uid);
    if (!targetUid) return false;
    const workspace = this.state.accountWorkspaces?.[
      accountWorkspaceKey(targetUid)
    ];
    if (!workspace) return false;
    applyAccountWorkspace(
      this.state,
      workspace
    );
    this.loadProfileWorkspace(this.state.session.profileId);
    return true;
  }

  /** Affiche un espace vierge sans toucher aux configurations de comptes existantes. */
  loadAnonymousWorkspace() {
    applyAccountWorkspace(
      this.state,
      createEmptyAccountWorkspace("")
    );
    this.loadProfileWorkspace(this.state.session.profileId);
  }

  /** Répartit les configurations héritées par profil et recharge le profil actif. */
  migrateProfileWorkspaces() {
    const defaults = createDefaultState();
    if (!this.state.profiles.length) {
      this.state.profiles = clone(defaults.profiles);
    }

    const activeProfile =
      this.state.profiles.find(
        (profile) => profile.id === this.state.session.profileId
      ) || this.state.profiles[0];
    this.state.session.profileId = activeProfile.id;

    const legacyWorkspace = captureProfileWorkspace(this.state);
    const now = new Date().toISOString();

    for (const profile of this.state.profiles) {
      if (!profile.workspace || typeof profile.workspace !== "object") {
        const hasLegacyRuleSelection = Array.isArray(profile.enabledRuleIds);
        const enabledRuleIds = new Set(profile.enabledRuleIds || []);
        const rules = hasLegacyRuleSelection
          ? legacyWorkspace.rules.filter((rule) => enabledRuleIds.has(rule.id))
          : profile.id === activeProfile.id
            ? legacyWorkspace.rules
            : [];
        profile.workspace = {
          ...clone(legacyWorkspace),
          rules: clone(rules)
        };
      }

      profile.workspace = normalizeProfileWorkspace(profile.workspace, {
        ttsFallback: this.state.settings.tts,
        songRequestSettingsFallback: this.state.settings.spotify?.songRequests
      });
      profile.enabledRuleIds = profile.workspace.rules.map((rule) => rule.id);
      profile.createdAt ||= now;
      profile.updatedAt ||= now;
    }

    this.loadProfileWorkspace(activeProfile.id);
  }

  activeProfile() {
    return this.state.profiles.find(
      (profile) => profile.id === this.state.session.profileId
    );
  }

  /** Capture le profil actif seulement une fois, sans normaliser les catalogues remplacés. */
  syncActiveProfileWorkspace() {
    const profile = this.activeProfile();
    if (!profile) return;

    const nextWorkspace = captureProfileWorkspace(this.state, profile.workspace);
    const nextRuleIds = nextWorkspace.rules.map((rule) => rule.id);

    if (
      JSON.stringify(profile.workspace) !== JSON.stringify(nextWorkspace) ||
      JSON.stringify(profile.enabledRuleIds || []) !==
        JSON.stringify(nextRuleIds)
    ) {
      profile.workspace = nextWorkspace;
      profile.enabledRuleIds = nextRuleIds;
      profile.updatedAt = new Date().toISOString();
    }
  }

  /** Applique la configuration d'un profil sans changer les droits globaux du compte. */
  loadProfileWorkspace(profileId) {
    const profile = this.state.profiles.find((item) => item.id === profileId);
    if (!profile) return false;

    const workspace = normalizeProfileWorkspace(profile.workspace, {
      ttsFallback: this.state.settings.tts,
      songRequestSettingsFallback: this.state.settings.spotify?.songRequests
    });
    profile.workspace = workspace;
    profile.enabledRuleIds = workspace.rules.map((rule) => rule.id);
    this.state.rules = clone(workspace.rules);
    this.state.goals = clone(workspace.goals);
    this.state.commands = clone(workspace.commands);
    this.state.timers = clone(workspace.timers);
    this.state.settings.tts = clone(workspace.tts);
    this.state.settings.spotify = {
      ...(this.state.settings.spotify || {}), songRequests: clone(workspace.songRequestSettings)
    };
    this.state.settings.matches = clone(workspace.matches);
    this.state.matchSession = createMatchSession(workspace.matchSession, { disconnected: true });
    this.state.settings.overlayConfigs = clone(workspace.overlayConfigs);
    this.state.settings.overlayScene = sceneLayout.normalizeScene(workspace.overlayScene);
    this.state.game.connectorOverrides = clone(
      workspace.game.connectorOverrides
    );
    this.state.game.interactionCatalogVersions = clone(
      workspace.game.interactionCatalogVersions
    );
    this.state.game.interactionRulesByPack = clone(
      workspace.game.interactionRulesByPack
    );
    this.state.session.activeGamePackId = workspace.game.activeGamePackId;
    return true;
  }

}

module.exports = { WorkspaceManager };
