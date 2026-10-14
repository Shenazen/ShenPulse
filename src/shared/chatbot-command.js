(function (root, factory) {
  "use strict";
  const execution = typeof module === "object" && module.exports
    ? require("./command-execution") : root.ShenPulseCommandExecution;
  const contract = factory(execution);
  if (typeof module === "object" && module.exports) module.exports = contract;
  else root.ShenPulseChatbotCommand = contract;
})(typeof globalThis === "object" ? globalThis : this, function (executionContract) {
  "use strict";

  /** Contrat pur du ChatBot : validation, correspondance et aperçu partagés.
   * Aucun accès au stockage, au réseau, à l'horloge ou au moteur d'actions.
   * Les variables sont une liste fermée de chaînes, jamais du code exécuté.
   */
  const MAX_RESPONSE_LENGTH = 500;
  const MAX_ALIASES = 8;
  const MAX_KEYWORDS = 20;
  const MAX_TIMER_MESSAGES = 10;
  const MAX_COOLDOWN_MS = 3600000;
  const MIN_INTERVAL_MS = 60000;
  const KINDS = new Set(["command", "auto-reply", "timer"]);
  const AUDIENCES = new Set(["all", "subscriber", "moderator"]);
  const PLATFORMS = new Set(["all", "tiktok", "kick", "twitch"]);
  const NAME_PATTERN = /^![\p{L}\p{N}_-]{1,31}$/u;
  const cleanText = (value, maximum) => String(value ?? "").replace(/\0/g, "").slice(0, maximum);
  const kindOf = (item) => item?.kind || "command";

  function normalizeCommandExecution(input, options) {
    if (input == null) return null;
    if (!executionContract) throw new Error("Le contrat des commandes exécutables n'est pas chargé.");
    return executionContract.normalizeCommandExecution(input, options);
  }

  function describeCommandExecution(input, options) {
    if (input == null) return "Réponse dans le chat";
    if (!executionContract) throw new Error("Le contrat des commandes exécutables n'est pas chargé.");
    return executionContract.describeCommandExecution(input, options);
  }

  function chatbotAudience(item) {
    return AUDIENCES.has(item?.audience) ? item.audience : item?.subscriberOnly ? "subscriber" : "all";
  }

  function chatbotAliases(value) {
    return Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]+/) : [];
  }

  function chatbotTimerMessages(item) {
    // Une ancienne réponse multiligne reste un seul message, sans migration.
    return item?.messages == null ? [String(item?.response || "")] :
      Array.isArray(item.messages) ? item.messages : String(item.messages).split(/\r?\n/);
  }

  function duration(value, fallback, minimum = 0) {
    const number = value == null ? fallback : Number(value);
    if (!Number.isFinite(number) || number < minimum || number > MAX_COOLDOWN_MS) {
      throw new Error(minimum ? "L’intervalle doit être compris entre 60 secondes et 1 heure." : "Le cooldown doit être compris entre 0 seconde et 1 heure.");
    }
    return Math.round(number);
  }

  function normalizeChatbotCommand(input, { commands = [], actions, wheels } = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Une commande ChatBot valide est requise.");
    const current = commands.find((entry) => entry.id && entry.id === input.id);
    const kind = input.kind || "command";
    if (!KINDS.has(kind)) throw new Error("Type de message ChatBot invalide.");
    const audience = input.audience || (input.subscriberOnly ? "subscriber" : "all");
    if (!AUDIENCES.has(audience)) throw new Error("Autorisation ChatBot invalide.");
    const platform = input.platform || "all";
    if (!PLATFORMS.has(platform)) throw new Error("Plateforme ChatBot invalide.");
    if (input.execution != null && kind !== "command") throw new Error("Seule une commande commençant par ! peut déclencher une exécution.");
    const execution = normalizeCommandExecution(input.execution, { actions, wheels });
    const response = String(input.response ?? (kind === "timer" ? chatbotTimerMessages(input)[0] : "")).replace(/\0/g, "").trim();
    // Une bascule d'une ancienne entrée reste possible sans tronquer sa réponse.
    const unchangedLegacyResponse = current && response === String(current.response ?? "").replace(/\0/g, "").trim();
    if (!response && !execution || response.length > MAX_RESPONSE_LENGTH && !unchangedLegacyResponse) {
      throw new Error("La réponse doit contenir entre 1 et 500 caractères.");
    }
    const cooldown = (field, fallback) => current && input[field] === current[field]
      ? input[field] == null ? 0 : input[field] : duration(input[field], fallback);
    const result = { ...input, id: cleanText(input.id, 160), kind, platform, audience,
      enabled: input.enabled !== false, subscriberOnly: audience === "subscriber", response,
      cooldownMs: cooldown("cooldownMs", 10000), globalCooldownMs: cooldown("globalCooldownMs", 0) };
    if (execution) result.execution = execution;
    else delete result.execution;
    if (kind === "command") {
      const command = String(input.command ?? "").replace(/\0/g, "").trim();
      const unchangedLegacyName = current && kindOf(current) === "command" && command === String(current.command || "").trim();
      if (!NAME_PATTERN.test(command) && (execution || !unchangedLegacyName)) {
        throw new Error("La commande doit commencer par ! et contenir 1 à 31 lettres, chiffres, tirets ou underscores, sans espace.");
      }
      const rawAliases = chatbotAliases(input.aliases).map((value) => String(value).trim()).filter(Boolean);
      if (rawAliases.length > MAX_ALIASES) throw new Error("Une commande peut avoir au maximum 8 alias.");
      if (rawAliases.some((alias) => !NAME_PATTERN.test(alias))) throw new Error("Chaque alias doit être une commande valide commençant par !.");
      const names = [command, ...rawAliases].map((name) => name.toLowerCase());
      if (new Set(names).size !== names.length) throw new Error("La commande et ses alias doivent être différents.");
      const occupied = commands.filter((entry) => entry.id !== result.id && kindOf(entry) === "command")
        .flatMap((entry) => [entry.command, ...chatbotAliases(entry.aliases)])
        .map((name) => String(name || "").trim().toLowerCase());
      const previousNames = current ? [current.command, ...chatbotAliases(current.aliases)].map((name) => String(name || "").trim().toLowerCase()) : [];
      if (names.some((name) => occupied.includes(name) && !previousNames.includes(name))) throw new Error("Cette commande ou cet alias existe déjà dans ce profil.");
      result.command = command;
      result.aliases = rawAliases;
    } else if (kind === "auto-reply") {
      const supplied = input.keywords == null ? [input.matchText] : chatbotAliases(input.keywords);
      const keywords = supplied.map((value) => String(value ?? "").replace(/\0/g, "").trim()).filter(Boolean);
      if (!keywords.length || keywords.some((value) => value.length > 200)) throw new Error("Chaque mot-clé doit contenir entre 1 et 200 caractères.");
      if (keywords.length > MAX_KEYWORDS) throw new Error("Une auto-réponse peut avoir au maximum 20 mots-clés.");
      if (new Set(keywords.map((value) => value.toLowerCase())).size !== keywords.length) throw new Error("Les mots-clés doivent être différents.");
      if (!["contains", "exact"].includes(input.matchMode || "contains")) throw new Error("Mode de correspondance invalide.");
      result.matchText = keywords[0];
      result.keywords = keywords;
      result.matchMode = input.matchMode || "contains";
    } else {
      result.intervalMs = duration(input.intervalMs, 300000, MIN_INTERVAL_MS);
      const messages = chatbotTimerMessages({ ...input, response }).map((value) => String(value ?? "").replace(/\0/g, "").trim());
      if (!messages.length || messages.length > MAX_TIMER_MESSAGES || messages.some((value) => !value || value.length > MAX_RESPONSE_LENGTH && !(input.messages == null && unchangedLegacyResponse && value === response))) {
        throw new Error("Un timer doit contenir entre 1 et 10 messages de 1 à 500 caractères chacun.");
      }
      const minChatMessages = input.minChatMessages == null ? 0 : Number(input.minChatMessages);
      if (!Number.isInteger(minChatMessages) || minChatMessages < 0 || minChatMessages > 1000) throw new Error("Le minimum de messages dans le chat doit être compris entre 0 et 1 000.");
      if (input.messages != null) result.messages = messages;
      result.response = messages[0];
      result.minChatMessages = minChatMessages;
    }
    return result;
  }

  function chatbotPlatformForConnection(connection) {
    if (["tiktok-direct", "tiktok-relay"].includes(connection?.type)) return "tiktok";
    if (connection?.type === "kick-native") return "kick";
    if (connection?.type === "twitch-irc") return "twitch";
    return "all";
  }

  function chatbotMatchesPlatform(item, platform) {
    return !item?.platform || item.platform === "all" || item.platform === platform;
  }

  function chatbotCommandMatch(item, event = {}) {
    const kind = kindOf(item);
    if (item?.enabled === false || !chatbotMatchesPlatform(item, event.platform)) return null;
    if (kind === "timer") return event.type === "timer" ? { args: "" } : null;
    if (event.type !== "chat") return null;
    const message = cleanText(event.data?.message, 1000).trim();
    if (kind === "auto-reply") {
      const needles = (item.keywords == null ? [item.matchText] : chatbotAliases(item.keywords))
        .slice(0, MAX_KEYWORDS).map((value) => cleanText(value, 200).trim().toLowerCase()).filter(Boolean);
      const haystack = message.toLowerCase();
      return needles.some((needle) => item.matchMode === "exact" ? haystack === needle : haystack.includes(needle)) ? { args: "" } : null;
    }
    if (!message.startsWith("!")) return null;
    for (const value of [item.command, ...chatbotAliases(item.aliases)]) {
      const name = cleanText(value, 200).trim();
      if (!name || !message.toLowerCase().startsWith(name.toLowerCase())) continue;
      // Le mot suivant est un argument, jamais le suffixe d'une autre commande.
      if (message.length !== name.length && !/\s/.test(message[name.length])) continue;
      return { args: message.slice(name.length).trim() };
    }
    return null;
  }

  function chatbotAudienceAllows(item, user = {}) {
    if (kindOf(item) === "timer") return true;
    const audience = chatbotAudience(item);
    return audience === "all" || audience === "subscriber" && user.subscriber === true || audience === "moderator" && user.moderator === true;
  }

  function renderChatbotResponse(item, event = {}, match = chatbotCommandMatch(item, event)) {
    const values = {
      "user.displayName": cleanText(event.user?.displayName || event.user?.name, 160),
      "user.name": cleanText(event.user?.name, 120),
      args: cleanText(match?.args, 1000), message: cleanText(event.data?.message, 1000)
    };
    const aliases = { user: "user.displayName", username: "user.name", args: "args", comment: "message", message: "message" };
    return cleanText(item?.response, 20000)
      .replace(/\{\{\s*([^{}]+?)\s*\}\}|\{(user|username|args|comment|message)\}/g, (literal, path, alias) => {
        const key = alias ? aliases[alias] : path;
        return Object.hasOwn(values, key) ? values[key] : literal;
      }).slice(0, MAX_RESPONSE_LENGTH);
  }

  function previewChatbotResponse(item, event = {}) {
    const match = chatbotCommandMatch(item, event);
    const preview = { matched: Boolean(match), allowed: Boolean(match && chatbotAudienceAllows(item, event.user)),
      response: renderChatbotResponse(item, event, match), args: match?.args || "" };
    if (kindOf(item) === "command" && item.execution != null) {
      preview.execution = normalizeCommandExecution(item.execution);
      preview.executionDescription = describeCommandExecution(preview.execution);
    }
    return preview;
  }

  function findChatbotCommand(commands = [], event = {}) {
    // Une commande explicite a priorité sur les réponses automatiques : un seul message.
    return commands.find((item) => kindOf(item) === "command" && chatbotCommandMatch(item, event)) ||
      commands.find((item) => kindOf(item) === "auto-reply" && chatbotCommandMatch(item, event));
  }

  return Object.freeze({ MAX_RESPONSE_LENGTH, MAX_ALIASES, MAX_KEYWORDS, MAX_TIMER_MESSAGES, MAX_COOLDOWN_MS, MIN_INTERVAL_MS,
    normalizeCommandExecution, describeCommandExecution,
    chatbotAudience, chatbotAliases, chatbotTimerMessages, normalizeChatbotCommand, chatbotPlatformForConnection, chatbotMatchesPlatform,
    chatbotCommandMatch, chatbotAudienceAllows, renderChatbotResponse, previewChatbotResponse, findChatbotCommand });
});
