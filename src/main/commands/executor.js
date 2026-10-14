"use strict";

/** Exécution des commandes LIVE, sans émission de message au chat.
 * Les droits, références et contexte sont relus avant chaque effet, y compris
 * les enfants différés d'un groupe ou d'une roue. Aucun code utilisateur n'est
 * interprété : seule la liste fermée du contrat partagé est acceptée.
 */
const { readState } = require("../state-projection");
const { hasAuthenticatedAccount, ADMIN_OWNER_EMAIL } = require("../account-access");
const visibility = require("../../shared/visibility-catalog");
const { normalizeCommandExecution, describeCommandExecution } = require("../../shared/command-execution");
const { activeGameInteractionRules } = require("../rule-engine");
const { renderValue } = require("../template");
const overlayCatalog = require("../../../resources/overlays/overlay-catalog");
const { activeProAccess } = require("../../../resources/overlays/scene-layout");
const { COMMAND_WHEEL_RESPIN } = require("./context-guard");
const { assertProFeatureState } = require("../pro-feature-access");
const { runtimeWheelActionIds } = require("../actions/wheel-selection");

const ACTION_OVERLAYS = Object.freeze({ "timer.add": "timer", "overlay.win-counter": "winCounter",
  "overlay.like-goal": "likeGoal", "overlay.coin-jar": "coinJar", "wheel.spin": "wheel",
  "overlay.multiplier-timer": "multiplierTimer" });
const OVERLAY_ACTIONS = Object.freeze(Object.fromEntries(Object.entries(ACTION_OVERLAYS).map(([type, key]) => [key, type])));
const FEATURES = Object.freeze({ "spotify.queue": "spotify.playback", "tts.speak": "tts.voices",
  "obs.request": "obs.websocket", "websocket.send": "sources.custom", "irl.shelly": "irl.shelly" });
const PATHS = ["session.profileId", "session.game",
  "settings.account", "settings.siteVisibility", "settings.overlayConfigs.wheel", "settings.irl", "commerce.subscription"];
const signature = (value) => JSON.stringify(value);
// Ne pas répéter toutes les actions de la règle pour chaque enfant du graphe.
const rowSignature = ({ rule, action }) => signature([rule.id, rule.enabled, action]);

function refusal(message, code = "COMMAND_TARGET_FORBIDDEN") {
  const error = new Error(message); error.code = code; return error;
}

function isAdmin(state) {
  const account = state.settings?.account || {};
  return account.emailVerified === true && String(account.email || "").trim().toLowerCase() === ADMIN_OWNER_EMAIL;
}

function assertScope(state, section, id, fallback = "public") {
  if (!visibility.canAccessScope(visibility.scopeFor(state.settings?.siteVisibility, section, id, undefined, fallback), isAdmin(state))) {
    throw refusal("Cette fonctionnalité n’est pas autorisée pour ce compte.");
  }
}

function rowsFor(state) {
  const profile = (state.profiles || []).find((entry) => entry.id === state.session?.profileId);
  const enabled = new Set(profile?.enabledRuleIds || (state.rules || []).map((rule) => rule.id));
  return [...(state.rules || []).filter((rule) => enabled.has(rule.id)), ...activeGameInteractionRules(state)]
    .flatMap((rule) => (rule.actions || []).map((action) => ({ rule, action })));
}

class CommandExecutor {
  constructor({ store, actionRunner, accessSection = "commands" }) {
    this.store = store; this.actionRunner = actionRunner; this.accessSection = accessSection === "matches" ? "matches" : "commands";
  }
  state(includeReferences = false) {
    const state = readState(this.store, PATHS);
    if (!includeReferences) return state;
    // Le store réel ne copie jamais les autres profils complets ni les règles
    // des packs de jeux inactifs. Le repli concerne les petits doubles de test.
    const rules = this.store.getRuleEngineState?.() || readState(this.store,
      ["rules", "profiles", "session.profileId", "session.game", "game.interactionRulesByPack"]);
    return { ...state, rules: rules.rules, profiles: rules.profiles, game: rules.game };
  }

  findAction(state, actionId) {
    const rows = rowsFor(state).filter(({ action }) => action.id === actionId);
    if (rows.length > 1) throw refusal("Plusieurs actions partagent cette référence. Corrigez leurs identifiants avant de les lier.", "COMMAND_TARGET_AMBIGUOUS");
    const row = rows[0];
    if (!row || row.rule.enabled !== true || row.action.enabled === false) {
      throw refusal("L’action liée est désactivée, absente ou hors du profil actif.", "COMMAND_TARGET_MISSING");
    }
    return row;
  }

  assertAction(state, action) {
    assertScope(state, "actionTypes", action.type);
    const overrides = state.settings?.siteVisibility?.actionTypeOverrides || {};
    if (overrides[visibility.storageKey(action.type)] === false || overrides[action.type] === false) {
      throw refusal("Ce type d’action est désactivé par l’administrateur.");
    }
    const feature = FEATURES[action.type];
    if (feature) assertScope(state, "features", feature);
    if (action.type === "irl.shelly") {
      assertProFeatureState(state, "irl");
      if (state.settings?.irl?.enabled !== true) throw refusal("Les interactions IRL sont désactivées.");
    }
    if (action.type === "spotify.queue") assertScope(state, "navigation", "music");
    if (action.type === "obs.request") assertScope(state, "features", "obs.websocket");
    const overlayKey = ACTION_OVERLAYS[action.type];
    if (overlayKey) {
      assertScope(state, "navigation", "overlays"); assertScope(state, "overlays", overlayKey);
      if (overlayCatalog.definitions.find((entry) => entry.key === overlayKey)?.requiresPro && !activeProAccess(state)) {
        throw refusal("Cet overlay nécessite un abonnement Pro ou Premium actif.");
      }
    }
    if (action.type === "overlay.match" && !activeProAccess(state)) throw refusal("Les matchs nécessitent un abonnement actif.");
    if (action.type === "game.effect" || action.config?.packId) {
      const packId = String(action.config?.packId || state.session?.game?.packId || "");
      if (packId) {
        assertScope(state, "navigation", "games"); assertScope(state, "games", packId);
        this.actionRunner.gameHub?.assertAccess?.(packId);
      }
    }
    if (action.type === "wheel.spin" && action.config?.wheelId) {
      const wheels = state.settings?.overlayConfigs?.wheel?.wheels || [];
      if (!wheels.some((wheel) => wheel.id === action.config.wheelId && wheel.enabled !== false)) {
        throw refusal("La roue liée est désactivée ou introuvable.", "COMMAND_TARGET_MISSING");
      }
    }
  }

  collectAction(state, action, references = new Map(), visited = new Set(), depth = 0, audited = new Set()) {
    if (depth > 20 || visited.has(action.id)) throw refusal("Référence circulaire ou trop profonde dans les actions liées.");
    if (audited.has(action.id)) return references;
    this.assertAction(state, action);
    const next = new Set(visited); next.add(action.id);
    const wheel = action.type === "wheel.spin";
    const ids = action.type === "action.group" ? action.config?.actionIds || [] : wheel
      ? runtimeWheelActionIds(state.settings?.overlayConfigs?.wheel, action.config) : [];
    for (const id of new Set(ids)) {
      let row;
      try { row = this.findAction(state, id); }
      catch (error) {
        // Un secteur inactif reste affichable/tirable sans activer sa prise ou
        // contourner son profil. Le résultat signale ensuite l'effet ignoré.
        // Une référence ambiguë, interdite ou circulaire demeure une erreur.
        if (wheel && error?.code === "COMMAND_TARGET_MISSING") continue;
        throw error;
      }
      references.set(row.action.id, rowSignature(row));
      if (references.size > 1000) throw refusal("La commande comporte trop d’actions liées.");
      this.collectAction(state, row.action, references, next, depth + 1, audited);
    }
    audited.add(action.id);
    return references;
  }

  actionFor(execution, commandId, args = "") {
    const id = `command_${String(commandId || "live").slice(0, 160)}`;
    if (execution.type === "music") {
      const query = execution.useArgs ? String(args || "").replace(/[\0\r\n]/g, " ").slice(0, 300).trim() : execution.query;
      const uri = execution.useArgs ? "" : execution.uri;
      if (["queue", "play_track"].includes(execution.operation) && !uri && !query) throw refusal("Indiquez un titre après la commande.", "COMMAND_ARGUMENT_REQUIRED");
      return { id, type: "spotify.queue", config: {
        ...execution, operation: execution.operation === "play_track" && !uri ? "queue" : execution.operation,
        query, uri, ...(execution.operation === "play_track" && !uri ? { mode: "play" } : {})
      } };
    }
    if (execution.type === "overlay") {
      return { id, type: OVERLAY_ACTIONS[execution.overlayKey], config: {
        operation: execution.operation, amount: execution.overlayKey === "winCounter" && execution.operation === "multiplier" ? execution.multiplier : execution.amount,
        seconds: execution.seconds, duration: execution.seconds, multiplier: execution.multiplier, wheelId: execution.wheelId
      } };
    }
    return null;
  }

  /** Validation IPC sans réseau, mutation, lecture audio ni simulation de prise. */
  validateTargets(item) {
    const execution = normalizeCommandExecution(item?.execution);
    if (!execution) return true;
    const state = this.state(execution.type === "action" || execution.overlayKey === "wheel");
    if (!hasAuthenticatedAccount(this.store)) throw refusal("Connectez-vous à votre compte ShenPulse.");
    assertProFeatureState(state, this.accessSection);
    assertScope(state, "navigation", this.accessSection);
    const action = execution.type === "action" ? this.findAction(state, execution.actionId).action : this.actionFor(execution, item.id, execution.useArgs ? "aperçu" : "");
    this.collectAction(state, action); return true;
  }

  async execute(item, event, { shouldExecute = () => true, args = "", onDeferredActionResult = () => {} } = {}) {
    const execution = normalizeCommandExecution(item.execution);
    if (!execution) throw refusal("Cette commande ne comporte aucun effet.");
    const state = this.state(execution.type === "action" || execution.overlayKey === "wheel");
    if (!hasAuthenticatedAccount(this.store)) throw refusal("Connectez-vous à votre compte ShenPulse.");
    assertProFeatureState(state, this.accessSection);
    const action = execution.type === "action" ? this.findAction(state, execution.actionId).action : this.actionFor(execution, item.id, args);
    const references = this.collectAction(state, action);
    if (execution.type === "action") references.set(action.id, rowSignature(this.findAction(state, action.id)));
    const wheelSignature = signature(state.settings?.overlayConfigs?.wheel);
    const context = { ...event, event, args, now: new Date().toISOString(),
      onDeferredActionResult: (outcome) => {
        // Un échec tardif est visible uniquement dans le contexte qui a lancé
        // la roue, jamais dans le profil/compte vers lequel on a basculé.
        if (shouldExecute()) onDeferredActionResult(outcome);
      },
      resolveCommandActions: (ids) => {
        if (!shouldExecute()) throw refusal("Le contexte LIVE de la commande a changé.", "COMMAND_CONTEXT_CHANGED");
        const fresh = this.state(true);
        return ids.map((id) => {
          const row = this.findAction(fresh, id);
          if (rowSignature(row) !== references.get(row.action.id)) throw refusal("L’action liée a été modifiée.", "COMMAND_CONTEXT_CHANGED");
          return [String(id), { action: row.action, name: String(row.rule.name || row.action.name || row.action.id).slice(0, 200) }];
        });
      },
      shouldExecute: () => {
        if (!shouldExecute()) return false;
        try { context.assertActionAllowed(hydrated); return true; } catch { return false; }
      },
      assertActionAllowed: (currentAction, currentContext = context) => {
        if (!shouldExecute() || !hasAuthenticatedAccount(this.store)) throw refusal("Le contexte LIVE de la commande a changé.", "COMMAND_CONTEXT_CHANGED");
        const fresh = this.state(references.size > 0); assertProFeatureState(fresh, this.accessSection);
        if (references.has(currentAction.id)) {
          const row = this.findAction(fresh, currentAction.id);
          if (rowSignature(row) !== references.get(currentAction.id)) throw refusal("L’action liée a été modifiée.", "COMMAND_CONTEXT_CHANGED");
          const expected = renderValue(row.action.config || {}, context);
          const marker = currentContext[COMMAND_WHEEL_RESPIN];
          const repeat = currentAction.type === "wheel.spin" && marker?.rootActionId === currentAction.id &&
            Number.isInteger(marker.depth) && marker.depth >= 1 && marker.depth <= 3 && currentAction.config?.reSpinDepth === marker.depth &&
            currentAction.config?.wheelId === marker.wheelId;
          const expectedConfig = repeat ? { ...expected, wheelId: marker.wheelId, reSpinDepth: marker.depth } : expected;
          if (currentAction.type !== row.action.type || signature(currentAction.config || {}) !== signature(expectedConfig)) {
            throw refusal("La configuration de l’action liée a changé.", "COMMAND_CONTEXT_CHANGED");
          }
        } else if (currentAction.id !== action.id || currentAction.type !== action.type) {
          throw refusal("L’action différée n’appartient plus à cette commande.", "COMMAND_CONTEXT_CHANGED");
        }
        if (currentAction.type === "wheel.spin" && wheelSignature !== signature(fresh.settings?.overlayConfigs?.wheel)) {
          throw refusal("La configuration de la roue a changé.", "COMMAND_CONTEXT_CHANGED");
        }
        this.assertAction(fresh, currentAction);
      } };
    // Les arguments musicaux sont des recherches littérales, pas des modèles.
    const hydrated = { ...action, config: execution.type === "action" ? renderValue(action.config || {}, context) : { ...action.config } };
    context.assertActionAllowed(hydrated);
    let result;
    try { result = await this.actionRunner.run(hydrated, context); }
    catch (error) {
      if (!error.commandGroupCounts) throw error;
      result = { ...error.commandGroupCounts, skipped: true };
    }
    const queued = result?.queued === true && (action.type === "action.group" || action.type === "wheel.spin" && Number(result.queuePosition) > 0);
    const counts = action.type === "action.group" ? {
      executedCount: Math.max(0, Number(result?.executed) || 0), failedCount: Math.max(0, Number(result?.failed) || 0),
      requestedCount: Math.max(0, Number(result?.requested) || 0), selectedCount: Math.max(0, Number(result?.selected) || 0),
      ...(Number(result?.queuedCount) > 0 ? { queuedCount: Number(result.queuedCount) } : {})
    } : {};
    const effectSkipped = action.type === "wheel.spin" && result?.effectSkipped === true;
    return { executed: result?.skipped !== true && (action.type === "action.group" ? counts.executedCount > 0 : !queued),
      ...(queued ? { queued: true } : {}), ...(result?.partial === true || effectSkipped ? { partial: true } : {}), ...counts,
      ...(effectSkipped ? { reason: result.effectReason || "COMMAND_TARGET_MISSING" } : {}),
      description: effectSkipped ? "Roue lancée ; l’action du secteur gagnant est indisponible ou désactivée et n’a pas été exécutée."
        : describeCommandExecution(execution), result };
  }
}

module.exports = { CommandExecutor, ACTION_OVERLAYS, OVERLAY_ACTIONS };
