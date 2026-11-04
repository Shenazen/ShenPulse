"use strict";

const { randomUUID } = require("node:crypto");
const { readState } = require("./state-projection");
const { CommandExecutor } = require("./commands/executor");
const { createProFeatureGuard } = require("./pro-feature-access");
const catalog = require("../../resources/overlays/catalog/matches");
const { normalizeMatchesConfig } = require("../shared/matches-contract");
const { ControllerService } = require("./controller-service");

const numeric = (key, label, value, min, max) => ({ key, label, type: "number", default: value, min, max, step: 1 });
const seconds = () => numeric("seconds", "Durée (secondes)", 60, 1, 86400);
const amount = () => numeric("amount", "Nombre de wins", 1, 1, 100000);
const factor = () => numeric("multiplier", "Multiplicateur", 2, 2, 100);
const duration = () => numeric("seconds", "Durée (secondes)", 300, 1, 3600);
const styles = { tikcontrol: "Classique", gladiador: "Gladiateur", cyber: "Cyber", dragon: "Dragon" };
const definitions = [
  ...catalog.matches.map(item => ({ id: "match." + item.match, name: item.name.replace(/^Match /, "Animation "), group: "Animations de match", section: "matches", type: "overlay.match", config: { match: item.match }, fields: [
    { key: "variant", label: "Pack visuel", type: "select", default: item.variants.includes("cyber") ? "cyber" : item.variants[0], options: item.variants.map(value => ({ value, label: styles[value] })) },
    numeric("volume", "Volume (%)", 100, 0, 100),
    { key: "fit", label: "Affichage", type: "select", default: "contain", options: [{ value: "contain", label: "Animation entière" }, { value: "cover", label: "Remplir la source" }] }
  ] })),
  ...[["add", "Ajouter des wins", "adjust"], ["remove", "Retirer des wins", "adjust"], ["reset", "Réinitialiser les wins", "reset"], ["invert", "Inverser les wins", "invert"]].map(([id, name, operation]) => ({ id: "wins." + id, name, group: "Compteur de wins", type: "overlay.win-counter", config: { operation }, fields: ["add", "remove"].includes(id) ? [amount()] : [] })),
  { id: "wins.multiplier", name: "Activer le multiplicateur de wins", group: "Compteur de wins", type: "overlay.win-counter", config: { operation: "multiplier" }, fields: [factor(), duration()] },
  { id: "wins.multiplier-stop", name: "Arrêter le multiplicateur de wins", group: "Compteur de wins", type: "overlay.win-counter", config: { operation: "multiplier", amount: 1, duration: 1 }, fields: [] },
  ...[["add", "Ajouter du temps"], ["remove", "Retirer du temps"], ["set", "Démarrer le timer"], ["pause", "Mettre le timer en pause"], ["resume", "Reprendre le timer"], ["reset", "Réinitialiser le timer"]].map(([operation, name]) => ({ id: "timer." + operation, name, group: "Timer", type: "timer.add", config: { operation }, fields: ["add", "remove", "set"].includes(operation) ? [seconds()] : [] })),
  ...[["set", "Démarrer le timer multiplicateur"], ["pause", "Pause du timer multiplicateur"], ["resume", "Reprendre le timer multiplicateur"], ["reset", "Réinitialiser le timer multiplicateur"]].map(([operation, name]) => ({ id: "multiplier." + operation, name, group: "Timer multiplicateur", type: "overlay.multiplier-timer", config: { operation }, fields: operation === "set" ? [factor(), duration()] : [] })),
  ...[["play", "Reprendre la musique"], ["pause", "Mettre la musique en pause"], ["next", "Titre suivant"], ["previous", "Titre précédent"], ["volume_up", "Augmenter le volume"], ["volume_down", "Baisser le volume"]].map(([operation, name]) => ({ id: "music." + operation, name, group: "Musique Spotify", section: "music", type: "spotify.queue", config: { operation }, fields: [] })),
  { id: "wheel.spin", name: "Lancer la roue", group: "Roue", type: "wheel.spin", config: {}, fields: [] }
];

function controllerCommands() { return definitions.map(({ id, name, group, fields }) => ({ id, name, group, fields })); }
function commandAction(id, options = {}) {
  const definition = definitions.find(item => item.id === id);
  if (!definition) throw Error("Cette commande Stream Deck n’existe pas.");
  const config = { ...definition.config };
  for (const field of definition.fields) {
    const value = options[field.key] ?? field.default;
    if (field.type === "select") {
      if (!field.options.some(option => option.value === value)) throw Error("Choisissez une valeur valide pour « " + field.label + " ».");
      config[field.key] = value;
    } else {
      if (typeof value === "boolean" || String(value).trim() === "" || !Number.isInteger(Number(value)) || Number(value) < field.min || Number(value) > field.max) throw Error("« " + field.label + " » doit être entre " + field.min + " et " + field.max + ".");
      config[field.key] = Number(value);
    }
  }
  if (id.startsWith("match.")) config.volume /= 100;
  if (id === "wins.remove") config.amount = -config.amount;
  if (id === "wins.multiplier") { config.amount = config.multiplier; config.duration = config.seconds; }
  return { definition, action: { id: "controller_" + randomUUID(), type: definition.type, config } };
}

/** Direct commands use the same action runner and access guards as the application. */
class ControllerCommands {
  constructor(core) { this.core = core; this.store = core.store; this.executor = new CommandExecutor({ store: core.store, actionRunner: core.actionRunner }); }
  createService(pluginDirectory) {
    const core = this.core;
    return new ControllerService({ store: this.store, pluginDirectory,
      executeAction: id => this.action(id), executeRule: id => this.rule(id),
      executeCommand: (id, options) => this.run(id, options), getCommands: () => this.catalog(),
      getAutomations: () => this.automations(), executeAutomation: id => core.matches.testAutomation(id),
      selectProfile: async profileId => {
        core.liveEventActions?.chatbot.reset();
        await core.stopGameSession({ notify: false });
        this.store.selectProfile(profileId);
        core.ruleEngine.resetProfileState();
        core.liveEventActions?.chatbot.syncTimers();
        core.notifyRenderer("state-changed", core.snapshot());
      }
    });
  }
  catalog() { return controllerCommands(); }
  automations() { return normalizeMatchesConfig(readState(this.store, ["settings.matches"]).settings?.matches).automations.map(({ id, name }) => ({ id, name })); }
  context(guard) {
    const event = { source: "controller", type: "manual", user: { name: "ShenPulse", displayName: "Stream Deck" }, data: {} };
    return { ...event, event, shouldExecute: () => { try { return guard(); } catch { return false; } }, assertActionAllowed: action => { guard(); this.executor.assertAction(this.executor.state(), action); } };
  }
  async run(id, options) {
    const { definition, action } = commandAction(id, options);
    const guard = createProFeatureGuard(this.store, definition.section || "overlays");
    this.executor.collectAction(this.executor.state(true), action);
    guard();
    const context = this.context(guard);
    const result = id === "wheel.spin"
      ? await this.executor.execute({ id: "stream-deck", execution: { type: "overlay", overlayKey: "wheel", operation: "spin" } }, context, { shouldExecute: context.shouldExecute })
      : await this.core.actionRunner.run(action, context);
    if (result?.skipped || result?.executed === false && !result?.queued) throw Error("La commande n’a pas pu être exécutée dans le contexte actuel.");
    this.core.notifyRenderer("state-changed", this.core.snapshot());
    return result;
  }
  async action(id) {
    const guard = createProFeatureGuard(this.store, "commands");
    return this.executor.execute({ id: "stream-deck", execution: { type: "action", actionId: id } }, this.context(guard), { shouldExecute: () => { try { return guard(); } catch { return false; } } });
  }
  async rule(id) {
    const guard = createProFeatureGuard(this.store, "commands");
    const find = () => readState(this.store, ["rules", "profiles", "session.profileId"]);
    const state = find(), rule = state.rules?.find(item => item.id === id);
    const selected = state.profiles?.find(item => item.id === state.session?.profileId);
    if (!rule?.enabled || selected?.enabledRuleIds && !selected.enabledRuleIds.includes(id)) throw Error("Cette règle est désactivée ou absente du profil actif.");
    const signature = JSON.stringify(rule), actions = rule.actions.filter(action => action.enabled !== false);
    if (!actions.length) throw Error("Cette règle ne contient aucune action active.");
    const current = () => {
      guard();
      const fresh = find(), profile = fresh.profiles?.find(item => item.id === fresh.session?.profileId);
      if (profile?.enabledRuleIds && !profile.enabledRuleIds.includes(id) || JSON.stringify(fresh.rules?.find(item => item.id === id)) !== signature) throw Error("La règle a changé pendant son exécution.");
      return true;
    };
    for (const action of actions) this.executor.collectAction(this.executor.state(true), action);
    for (const action of actions) { current(); await this.executor.execute({ id: "stream-deck", execution: { type: "action", actionId: action.id } }, this.context(current), { shouldExecute: () => { try { return current(); } catch { return false; } } }); }
    this.core.notifyRenderer("state-changed", this.core.snapshot());
  }
}
module.exports = { ControllerCommands, controllerCommands, commandAction };
