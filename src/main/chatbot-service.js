"use strict";

/** Commandes locales par compte et profil, réponses historiques et un scheduler.
 * Les timers n'envoient rien hors session LIVE ou sans transport d'envoi actif.
 * La prévisualisation reste dans le contrat pur partagé, hors de ce service.
 */
const { readState } = require("./state-projection");
const { hasAuthenticatedAccount, ADMIN_OWNER_EMAIL } = require("./account-access");
const visibility = require("../shared/visibility-catalog");
const { proFeatureAllowed } = require("./pro-feature-access");
const { findChatbotCommand, previewChatbotResponse, renderChatbotResponse,
  chatbotPlatformForConnection, chatbotMatchesPlatform, chatbotTimerMessages, MIN_INTERVAL_MS, MAX_COOLDOWN_MS } = require("../shared/chatbot-command");

const MAX_COOLDOWN_ENTRIES = 2000;
const TIMER_TICK_MS = 5000;
const MAX_PENDING_DELIVERIES = 50;
const MAX_CONCURRENT_DELIVERIES = 2;
const MAX_REJECTION_ENTRIES = 256;
const REJECTION_INTERVAL_MS = 5000;
const STATE_PATHS = ["commands", "connections", "session.running", "session.profileId", "session.startedAt",
  "settings.account", "settings.siteVisibility", "commerce.subscription", "settings.tiktok.status", "settings.tiktok.roomId", "settings.tiktok.broadcaster.username", "settings.tiktok.chat.botUsername", "settings.kick.live", "settings.kick.account.id"];
const SCOPE_PATHS = ["settings.account.uid", "session.profileId", "session.startedAt"];
const timerSignature = (item) => JSON.stringify([item.intervalMs, chatbotTimerMessages(item), item.platform || "all", item.minChatMessages || 0]);

function commandsAccessAllowed(store, state) {
  if (!hasAuthenticatedAccount(store)) return false;
  return proFeatureAllowed(state, "commands");
}

function chatbotAccessAllowed(store, state) {
  if (!commandsAccessAllowed(store, state)) return false;
  const account = state.settings?.account || {};
  const admin = String(account.email || "").trim().toLowerCase() === ADMIN_OWNER_EMAIL && account.emailVerified === true;
  return visibility.canAccessScope(visibility.scopeFor(state.settings?.siteVisibility, "actionTypes", "chat.reply"), admin);
}

function assertCommandsAccess(store) {
  if (!commandsAccessAllowed(store, readState(store, ["settings.account", "settings.siteVisibility", "commerce.subscription"]))) {
    const error = new Error("Les commandes ne sont pas accessibles avec ce compte ou ces droits.");
    error.code = "COMMANDS_ACCESS_FORBIDDEN";
    throw error;
  }
}

const functionalCommand = (item) => (item?.kind || "command") === "command" && Boolean(item?.execution);
const commandSignature = (item) => JSON.stringify([item?.id, item?.enabled, item?.kind || "command", item?.command,
  item?.aliases, item?.platform || "all", item?.audience, item?.subscriberOnly, item?.execution, item?.cooldownMs, item?.globalCooldownMs]);
const sourceSignature = (connection, state) => JSON.stringify([connection?.id, connection?.type, connection?.config,
  connection?.type === "tiktok-direct" ? [state.settings?.tiktok?.roomId || "", state.settings?.tiktok?.broadcaster?.username || ""] : "",
  connection?.type === "kick-native" ? state.settings?.kick?.account?.id || "" : ""]);

function assertChatbotAccess(store) {
  const state = readState(store, ["settings.account", "settings.siteVisibility", "commerce.subscription"]);
  if (!chatbotAccessAllowed(store, state)) {
    const error = new Error("Le ChatBot n’est pas accessible avec ce compte ou ces droits.");
    error.code = "CHATBOT_ACCESS_FORBIDDEN";
    throw error;
  }
}

class ChatbotService {
  constructor({ store, sourceHub, overlayServer, commandExecutor = null, functionalOnly = false, cooldowns = new Map(), onActivity = () => {}, onChanged = () => {},
    now = Date.now, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
    this.store = store;
    this.sourceHub = sourceHub;
    this.overlayServer = overlayServer;
    this.commandExecutor = commandExecutor;
    // Le service de production n'exécute plus les anciens messages. L'option
    // false conserve un moteur compatible pour les données/tests historiques.
    this.functionalOnly = functionalOnly;
    this.cooldowns = cooldowns;
    this.onActivity = onActivity;
    this.onChanged = onChanged;
    this.now = now;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.timerHandle = null;
    this.timerJobs = new Map();
    this.timerScope = "";
    this.scopeIdentity = "";
    this.generation = 0;
    this.ticking = false;
    this.pendingDeliveries = [];
    this.activeDeliveries = new Set();
    this.activeSources = new Set();
    this.chatCounts = new Map();
    this.rejections = new Map();
  }

  state() { return readState(this.store, STATE_PATHS); }
  currentScope() { return this.scope(readState(this.store, SCOPE_PATHS)); }
  activeCommands(state) { return this.functionalOnly ? (state.commands || []).filter(functionalCommand) : state.commands; }

  scope(state) {
    return JSON.stringify([state.settings?.account?.uid || "", state.session?.profileId || "", state.session?.startedAt || ""]);
  }

  ensureScope(state) {
    const scope = this.scope(state);
    if (this.scopeIdentity && this.scopeIdentity !== scope) this.reset();
    this.scopeIdentity = scope;
    return scope;
  }

  connectionIsLive(connection, state) {
    if (!state.session?.running || connection?.enabled !== true || connection.status !== "connected") return false;
    if (connection.type === "kick-native") return state.settings?.kick?.live === true;
    if (["tiktok-direct", "tiktok-relay"].includes(connection.type)) {
      return connection.id === "source_tiktok" ? state.settings?.tiktok?.status === "live" : connection.liveStatus === "live";
    }
    // Twitch et les sources personnalisées ne fournissent pas de statut vidéo :
    // elles utilisent la session LIVE explicitement démarrée dans ShenPulse.
    return ["twitch-irc", "websocket"].includes(connection.type);
  }

  connectionCanSend(connection) {
    if (!connection) return false;
    if (typeof this.sourceHub.getChatCapabilities === "function") return this.sourceHub.getChatCapabilities(connection.id).canSend === true;
    const runtime = this.sourceHub.runtimes?.get(connection.id);
    return connection.type !== "tiktok-direct" && runtime?.closed !== true && typeof runtime?.send === "function";
  }

  cooldownAccepts(item, event, state) {
    const now = this.now();
    const base = JSON.stringify([state.settings?.account?.uid || "", state.session?.profileId || "", event.source, item.id]);
    const userKey = `${base}:user:${String(event.user?.id || event.user?.name || "anonymous")}`;
    const globalKey = `${base}:global`;
    if ((this.cooldowns.get(userKey) || 0) > now || (this.cooldowns.get(globalKey) || 0) > now) return false;
    // Pas de timer de nettoyage supplémentaire : éviction bornée sur l'entrée.
    for (const [key, value] of [[userKey, item.cooldownMs], [globalKey, item.globalCooldownMs]]) {
      // Les valeurs historiques finies sont conservées ; la borne de création
      // est appliquée par l'IPC, pas par une migration destructive du profil.
      const duration = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
      if (!duration) continue;
      this.cooldowns.delete(key);
      this.cooldowns.set(key, now + duration);
    }
    while (this.cooldowns.size > MAX_COOLDOWN_ENTRIES) this.cooldowns.delete(this.cooldowns.keys().next().value);
    return true;
  }

  isOwnMessage(event, connection, state) {
    if (connection.type === "kick-native" && state.settings?.kick?.account?.id) {
      return String(event.user?.id || "") === String(state.settings.kick.account.id);
    }
    const ownName = connection.type === "twitch-irc" ? connection.config?.username : connection.type === "tiktok-direct" ?
      state.settings?.tiktok?.chat?.botUsername || connection.config?.botUsername : connection.config?.botUsername;
    return Boolean(ownName && String(event.user?.name || "").toLowerCase() === String(ownName).replace(/^@/, "").toLowerCase());
  }

  /** Identité publique issue du connecteur direct ou du webhook signé Kick.
   * Le pseudo d'affichage et les métadonnées d'un relais générique ne donnent
   * jamais les droits du créateur. Le filtre d'écho historique reste inchangé.
   */
  isBroadcaster(event, connection, state) {
    if (connection.type === "kick-native") return Boolean(state.settings?.kick?.account?.id &&
      String(event.user?.id || "") === String(state.settings.kick.account.id));
    if (connection.type !== "tiktok-direct" || connection.id !== "source_tiktok") return false;
    const owner = String(state.settings?.tiktok?.broadcaster?.username || "").replace(/^@/, "").toLowerCase();
    return Boolean(owner && owner === String(event.user?.name || "").replace(/^@/, "").toLowerCase());
  }

  /** Une commande explicite revendique son mot, même quand son rôle/cooldown
   * refuse l'exécution : aucun repli vers Song Requests ne doit la contourner.
   */
  hasFunctionalCommand(event) {
    if (event?.type !== "chat" || event.test === true || event.source === "source_demo") return false;
    const state = this.state();
    if (!commandsAccessAllowed(this.store, state)) return false;
    const connection = (state.connections || []).find((entry) => entry.id === event.source);
    if (!this.connectionIsLive(connection, state)) return false;
    return functionalCommand(findChatbotCommand(this.activeCommands(state), { ...event, platform: chatbotPlatformForConnection(connection) }));
  }

  /** Un refus d'une commande connue devient visible, sans conserver le message
   * complet, ses arguments ou le viewer. Un seul avertissement par motif/source
   * et commande toutes les cinq secondes évite un journal par tapotage de chat.
   */
  recordCommandRejection(item, event, state, reason, description) {
    const key = JSON.stringify([this.scope(state), event.source, item.id, reason]);
    const now = this.now();
    if (this.rejections.has(key) && this.rejections.get(key) > now) return;
    this.rejections.delete(key);
    this.rejections.set(key, now + REJECTION_INTERVAL_MS);
    while (this.rejections.size > MAX_REJECTION_ENTRIES) this.rejections.delete(this.rejections.keys().next().value);
    this.onActivity("warning", "chatbot", "Commande non exécutée", `${item.command || ""} · ${description}`, {
      profileId: state.session?.profileId || "", commandId: item.id, source: event.source, platform: event.platform,
      sent: false, executed: false, executionType: item.execution?.type, executionReason: reason
    });
    this.onChanged(true);
  }

  handleChat(event) {
    if (event?.type !== "chat" || event.test === true || event.source === "source_demo") return null;
    const state = this.state();
    if (!commandsAccessAllowed(this.store, state)) return null;
    const connection = (state.connections || []).find((entry) => entry.id === event.source);
    if (!this.connectionIsLive(connection, state)) return null;
    this.ensureScope(state);
    if (!this.isOwnMessage(event, connection, state) && [...this.timerJobs.values()].some((job) => job.connectionId === event.source)) {
      this.chatCounts.set(event.source, Math.min(1000, (this.chatCounts.get(event.source) || 0) + 1));
    }
    const normalized = { ...event, platform: chatbotPlatformForConnection(connection) };
    const item = findChatbotCommand(this.activeCommands(state), normalized);
    if (!item) return null;
    const functional = functionalCommand(item);
    if ((!functional && !chatbotAccessAllowed(this.store, state)) || (this.isOwnMessage(event, connection, state) &&
        (!functional || !this.isBroadcaster(event, connection, state)))) return null;
    if (functional && this.isBroadcaster(event, connection, state)) normalized.user = { ...event.user, moderator: true };
    const preview = previewChatbotResponse(item, normalized);
    if (!preview.allowed) {
      if (functional) this.recordCommandRejection(item, normalized, state, "COMMAND_AUDIENCE_FORBIDDEN",
        item.audience === "subscriber" || item.subscriberOnly ? "Cette commande est réservée aux abonnés de la chaîne." : "Cette commande est réservée aux modérateurs et au créateur du LIVE.");
      return null;
    }
    if (!functional && !preview.response.trim()) return null;
    if (this.pendingDeliveries.length + this.activeDeliveries.size >= MAX_PENDING_DELIVERIES) {
      if (functional) this.recordCommandRejection(item, normalized, state, "COMMAND_QUEUE_FULL", "La file de commandes est pleine ; réessayez après les effets en cours.");
      return null;
    }
    if (!this.cooldownAccepts(item, normalized, state)) {
      if (functional) this.recordCommandRejection(item, normalized, state, "COMMAND_COOLDOWN_ACTIVE", "Le délai d’attente par utilisateur ou global n’est pas encore terminé.");
      return null;
    }
    return this.enqueueDelivery(item, normalized, preview.response, state, functional ? {
      functional: true, commandSignature: commandSignature(item), sourceSignature: sourceSignature(connection, state),
      runtime: this.sourceHub.runtimes?.get(connection.id), args: preview.args } : {});
  }

  enqueueDelivery(item, event, response, state, options = {}) {
    if (this.functionalOnly && (!options.functional || !functionalCommand(item))) return { queued: false };
    if (this.pendingDeliveries.length + this.activeDeliveries.size >= MAX_PENDING_DELIVERIES) return { queued: false };
    // La file ne conserve jamais un snapshot complet, un payload brut ou un catalogue.
    const context = { settings: { account: { uid: state.settings?.account?.uid } }, session: {
      profileId: state.session?.profileId, startedAt: state.session?.startedAt } };
    const compactEvent = { type: event.type, source: event.source, platform: event.platform, user: {
      id: event.user?.id, name: event.user?.name, displayName: event.user?.displayName,
      subscriber: event.user?.subscriber, moderator: event.user?.moderator }, data: { message: event.data?.message || "" } };
    this.pendingDeliveries.push({ item: { id: item.id, command: item.command, matchText: item.matchText,
      kind: item.kind || "command", intervalMs: item.intervalMs },
      event: compactEvent, response, state: context, options: { ...options, generation: this.generation } });
    this.pumpDeliveries();
    return { queued: true };
  }

  pumpDeliveries() {
    while (this.activeDeliveries.size < MAX_CONCURRENT_DELIVERIES) {
      const index = this.pendingDeliveries.findIndex((job) => !this.activeSources.has(job.event.source));
      if (index < 0) return;
      const job = this.pendingDeliveries.splice(index, 1)[0];
      this.activeDeliveries.add(job);
      this.activeSources.add(job.event.source);
      job.completion = this.deliver(job.item, job.event, job.response, job.state, job.options)
        .catch(() => ({ sent: false }))
        .finally(() => {
          this.activeDeliveries.delete(job);
          this.activeSources.delete(job.event.source);
          this.pumpDeliveries();
        });
    }
  }

  async whenIdle() {
    while (this.activeDeliveries.size || this.pendingDeliveries.length) {
      await Promise.all([...this.activeDeliveries].map((job) => job.completion));
    }
  }

  deliveryContext(item, event, response, state, options = {}) {
    if (this.functionalOnly && !options.functional) return null;
    const { timer = false, generation = this.generation } = options;
    const fresh = this.state();
    const connection = (fresh.connections || []).find((entry) => entry.id === event.source);
    const currentItem = (fresh.commands || []).find((entry) => entry.id === item.id && entry.enabled !== false);
    const currentPreview = currentItem && !timer ? previewChatbotResponse(currentItem, event) : null;
    const timerMessage = currentItem && timer ? chatbotTimerMessages(currentItem)[options.timerMessageIndex || 0] : "";
    if (generation !== this.generation || this.scope(state) !== this.scope(fresh) ||
        !(options.functional ? commandsAccessAllowed(this.store, fresh) : chatbotAccessAllowed(this.store, fresh)) ||
        !this.connectionIsLive(connection, fresh) || !currentItem ||
        options.functional && (!functionalCommand(currentItem) || commandSignature(currentItem) !== options.commandSignature ||
          sourceSignature(connection, fresh) !== options.sourceSignature || this.sourceHub.runtimes?.get(connection.id) !== options.runtime) ||
        timer && (currentItem.kind !== "timer" || currentItem.intervalMs !== item.intervalMs ||
          options.timerSignature && timerSignature(currentItem) !== options.timerSignature ||
          renderChatbotResponse({ ...currentItem, response: timerMessage }, event) !== response) ||
        !timer && (!currentPreview?.allowed || !options.functional && currentPreview.response !== response)) return null;
    return { fresh, connection, currentItem };
  }

  async deliver(item, event, response, state, options = {}) {
    if (options.functional) return this.executeCommand(item, event, state, options);
    const { timer = false, generation = this.generation } = options;
    const scope = this.scope(state);
    const context = this.deliveryContext(item, event, response, state, { ...options, generation });
    if (!context) return { sent: false, cancelled: true };
    const { connection, currentItem } = context;
    const runtime = this.sourceHub.runtimes?.get(connection.id);
    const kickAccountId = context.fresh.settings?.kick?.account?.id || "";
    const shouldSend = () => {
      const current = this.deliveryContext(item, event, response, state, { ...options, generation });
      return Boolean(current && this.sourceHub.runtimes?.get(connection.id) === runtime &&
        (connection.type !== "kick-native" || (current.fresh.settings?.kick?.account?.id || "") === kickAccountId));
    };
    let sent = false, forwarded = false, deliveryReason = "";
    try {
      if (!this.connectionCanSend(connection)) throw new Error("Ce transport ne permet pas l’envoi de messages.");
      const result = await this.sourceHub.send(event.source, { message: response }, { shouldSend });
      if (result?.stale === true) return { sent: result.sent === true, stale: true };
      forwarded = result?.forwarded === true || result?.confirmation === "socket";
      sent = result?.sent === true && !forwarded && result?.acknowledged !== false;
    } catch (error) {
      // Seule une catégorie locale est conservée, jamais l'erreur du fournisseur.
      if (/^(?:tiktok|relay)-chat-[a-z-]+$/.test(error?.code || "")) deliveryReason = error.code;
      // Les timers ne publient pas une fausse réponse locale à chaque minute.
      // Une réponse à un commentaire reste visible dans le journal privé.
    }
    if (generation !== this.generation || scope !== this.currentScope() || !hasAuthenticatedAccount(this.store)) return { sent, forwarded, stale: true };
    if ((sent || forwarded) && timer) {
      const job = this.timerJobs.get(options.timerJobKey);
      if (job && job.signature === options.timerSignature) job.messageIndex = ((options.timerMessageIndex || 0) + 1) % chatbotTimerMessages(currentItem).length;
      this.chatCounts.set(event.source, Math.max(0, (this.chatCounts.get(event.source) || 0) - (options.chatCountAtDispatch || 0)));
    }
    if (!sent && !forwarded && !timer) this.overlayServer?.publish?.("chatbot", { command: item.command || item.matchText || "", response, user: event.user, sent: false });
    this.onActivity(sent ? "success" : "info", "chatbot", sent ? "Réponse ChatBot envoyée" : forwarded ? "Réponse ChatBot transférée — confirmation indisponible" : timer ? "Timer ChatBot non envoyé" : "Réponse ChatBot locale — non envoyée", response,
      { profileId: state.session?.profileId || "", commandId: item.id, source: event.source, platform: event.platform || chatbotPlatformForConnection(connection), sent,
        ...(forwarded ? { forwarded: true } : {}), ...(deliveryReason ? { deliveryReason } : {}) });
    this.onChanged(true);
    return { sent, response, ...(forwarded ? { forwarded: true } : {}), ...(deliveryReason ? { deliveryReason } : {}) };
  }

  async executeCommand(item, event, state, options) {
    const shouldExecute = () => Boolean(this.deliveryContext(item, event, "", state, options));
    const context = this.deliveryContext(item, event, "", state, options);
    if (!context || !this.commandExecutor) return { executed: false, cancelled: true };
    let outcome;
    try {
      outcome = await this.commandExecutor.execute(context.currentItem, event, { shouldExecute, args: options.args,
        // Le secteur est exécuté après l'animation. Une réussite du lancement
        // de la roue ne doit pas masquer l'échec tardif de son action liée.
        onDeferredActionResult: (result) => {
          if (!shouldExecute()) return;
          const partial = result?.executed === true && result?.partial === true;
          this.onActivity("warning", "chatbot", partial ? "Action de roue partiellement exécutée" : "Action de roue non exécutée",
            `${item.command || ""} · ${partial ? "L’action du secteur gagnant de la roue n’a été exécutée qu’en partie." : "L’action du secteur gagnant de la roue est indisponible ou a changé."}`, {
              profileId: state.session?.profileId || "", commandId: item.id, source: event.source, platform: event.platform,
              sent: false, executed: partial, partial: true, executionType: context.currentItem.execution.type,
              executionReason: /^COMMAND_[A-Z_]+$/.test(result?.reason || "") ? result.reason : "COMMAND_EXECUTION_FAILED"
            });
          this.onChanged(true);
        } });
    } catch (error) {
      if (!shouldExecute() || error?.code === "COMMAND_CONTEXT_CHANGED") return { executed: false, cancelled: true };
      // Ne pas journaliser un jeton/API URL ou un secret contenu dans une erreur
      // de fournisseur. La description générique suffit pour l'état local.
      outcome = { executed: false, description: "La fonctionnalité liée est indisponible ou ses droits ne permettent pas cette commande.",
        reason: /^COMMAND_[A-Z_]+$/.test(error?.code || "") ? error.code : "COMMAND_EXECUTION_FAILED" };
    }
    if (!shouldExecute()) return { ...outcome, stale: true };
    this.onActivity(outcome.partial ? "warning" : outcome.queued ? "info" : outcome.executed ? "success" : "warning", "chatbot",
      outcome.partial ? "Commande partiellement exécutée" : outcome.queued ? "Commande mise en file" : outcome.executed ? "Commande exécutée" : "Commande non exécutée",
      `${item.command || ""} · ${outcome.description || ""}`, { profileId: state.session?.profileId || "", commandId: item.id,
        source: event.source, platform: event.platform, sent: false, executed: outcome.executed === true,
        executionType: context.currentItem.execution.type, ...(outcome.queued ? { queued: true } : {}), ...(outcome.partial ? { partial: true } : {}),
        ...Object.fromEntries(["executedCount", "failedCount", "requestedCount", "selectedCount", "queuedCount"].filter((key) => Object.hasOwn(outcome, key)).map((key) => [key, outcome[key]])),
        ...(outcome.reason ? { executionReason: outcome.reason } : {}) });
    this.onChanged(true);
    return outcome;
  }

  syncTimers() {
    if (this.functionalOnly) { this.stopTimers(); return; }
    const state = this.state();
    const scope = this.ensureScope(state);
    if (!chatbotAccessAllowed(this.store, state) || !state.session?.running) { this.stopTimers(); return; }
    this.timerScope = scope;
    const eligible = (state.connections || []).filter((connection) => this.connectionIsLive(connection, state) && this.connectionCanSend(connection));
    const nextKeys = new Set();
    for (const item of state.commands || []) {
      if (item.kind !== "timer" || item.enabled === false || !String(item.response || "").trim()) continue;
      const intervalMs = Number(item.intervalMs);
      if (!Number.isFinite(intervalMs) || intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_COOLDOWN_MS) continue;
      for (const connection of eligible) {
        if (!chatbotMatchesPlatform(item, chatbotPlatformForConnection(connection))) continue;
        const key = JSON.stringify([item.id, connection.id]);
        const signature = timerSignature(item);
        nextKeys.add(key);
        if (this.timerJobs.get(key)?.signature !== signature) this.timerJobs.set(key, {
          itemId: item.id, connectionId: connection.id, intervalMs, signature, messageIndex: 0, key, dueAt: this.now() + intervalMs
        });
      }
    }
    for (const key of this.timerJobs.keys()) if (!nextKeys.has(key)) this.timerJobs.delete(key);
    for (const source of this.chatCounts.keys()) if (![...this.timerJobs.values()].some((job) => job.connectionId === source)) this.chatCounts.delete(source);
    if (!this.timerJobs.size) { this.stopTimers(); return; }
    if (this.timerHandle == null) {
      this.timerHandle = this.setIntervalFn(() => { this.tick().catch(() => {}); }, TIMER_TICK_MS);
      this.timerHandle?.unref?.();
    }
  }

  async tick() {
    if (this.functionalOnly) { this.stopTimers(); return; }
    if (this.ticking) return;
    this.ticking = true;
    try {
      this.syncTimers();
      const state = this.state();
      const generation = this.generation;
      const sentSources = new Set();
      for (const job of [...this.timerJobs.values()].sort((first, second) => first.dueAt - second.dueAt)) {
        if (this.now() < job.dueAt || sentSources.has(job.connectionId)) continue;
        const item = (state.commands || []).find((entry) => entry.id === job.itemId && entry.kind === "timer" && entry.enabled !== false);
        if (!item) continue;
        const chatCount = this.chatCounts.get(job.connectionId) || 0;
        if (chatCount < Math.max(0, Number(item.minChatMessages) || 0)) continue;
        const event = { type: "timer", source: job.connectionId, user: {}, data: { message: "" } };
        const alreadyPending = [...this.pendingDeliveries, ...this.activeDeliveries]
          .some((entry) => entry.event.source === job.connectionId && entry.options.timer);
        if (alreadyPending) continue;
        // Jamais de rattrapage en rafale après veille : prochaine échéance depuis maintenant.
        job.dueAt = this.now() + job.intervalMs;
        sentSources.add(job.connectionId);
        const response = renderChatbotResponse({ ...item, response: chatbotTimerMessages(item)[job.messageIndex] }, event);
        if (!response.trim()) continue;
        this.enqueueDelivery(item, event, response, state, { timer: true, generation, timerSignature: job.signature,
          timerJobKey: job.key, timerMessageIndex: job.messageIndex, chatCountAtDispatch: chatCount });
        if (generation !== this.generation || this.currentScope() !== this.scope(state)) break;
      }
    } finally { this.ticking = false; }
  }

  stopTimers() {
    if (this.timerHandle != null) this.clearIntervalFn(this.timerHandle);
    this.timerHandle = null;
    this.timerJobs.clear();
    this.chatCounts.clear();
    this.timerScope = "";
  }

  reset() {
    this.stopTimers(); this.cooldowns.clear(); this.rejections.clear(); this.pendingDeliveries.length = 0; this.generation += 1;
  }
}

module.exports = { ChatbotService, assertCommandsAccess, commandsAccessAllowed, assertChatbotAccess, chatbotAccessAllowed,
  MAX_COOLDOWN_ENTRIES, TIMER_TICK_MS, MAX_PENDING_DELIVERIES, MAX_CONCURRENT_DELIVERIES };
