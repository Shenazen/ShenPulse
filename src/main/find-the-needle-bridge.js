"use strict";

const { FIND_THE_NEEDLE_COMMAND_SPECS } = require("./find-the-needle-catalog");

const DEFAULT_BASE_URL = "http://127.0.0.1:55001";
const MOD_ID = "s2e-find-the-needle";
const SUPPORTED_VERSION = "1.2.7";
const MAX_RESPONSE_BYTES = 65536;
const INTEGER_COMMANDS = new Set(["hayrain", "scatterhay", "sellhay", "haymagnet", "sellloosehay"]);

const ERROR_MESSAGES = Object.freeze({
  unauthorized: "Le jeton du mod ne correspond pas à celui de ShenPulse. Réassociez le mod.",
  game_not_ready: "Ouvrez une partie de Find The Needle Demo et attendez la fin du chargement.",
  cooldown: "Le jeu traite déjà un effet important. Réessayez dans un instant.",
  effect_queue_full: "La file des effets du jeu est pleine. Attendez sa progression.",
  no_loose_hay: "Aucun foin libre à proximité : dispersez du foin avant de le vendre.",
  no_ungathered_hay: "Aucun nouveau foin libre à proximité. Changez de position.",
  nothing_to_spill: "Le joueur ne transporte aucun foin à renverser.",
  nothing_to_drop: "Le joueur ne tient aucun objet à lâcher.",
  container_not_empty: "Videz le récipient avant cette interaction.",
  tool_inventory_full: "L’inventaire du joueur est plein.",
  no_hay: "Il ne reste aucun foin accessible dans la meule.",
  hay_capacity_reached: "La limite d’objets de la cour est atteinte.",
  no_matching_technology: "Aucune technologie ne remplit les conditions de cet effet.",
  unknown_technology: "L’identifiant de technologie est inconnu du jeu.",
  technology_unavailable_in_demo: "Cette technologie n’est pas disponible dans la démo.",
  unknown_building: "L’identifiant de bâtiment est inconnu du jeu.",
  no_building_space: "Aucun emplacement libre pour placer ce bâtiment.",
  no_matching_building: "Aucun bâtiment ne remplit les conditions de cet effet.",
  building_unavailable_in_demo: "Ce bâtiment n’est pas disponible dans la démo.",
  player_cannot_be_flung: "Le joueur ne peut pas être projeté maintenant. Attendez son atterrissage.",
  item_spawn_failed: "Le jeu n’a pas pu créer cet objet."
});

/** Adaptateur du protocole local documenté dans le mod fourni par l’utilisateur.
 * Une interaction ne produit qu’une POST, sans répétition ni nouvelle tentative
 * automatique : la quantité propre à l’effet est portée par ses paramètres.
 */
class FindTheNeedleBridge {
  constructor({ fetchImpl = globalThis.fetch, getToken = () => "" } = {}) {
    if (typeof fetchImpl !== "function" || typeof getToken !== "function") {
      throw new TypeError("Une implémentation de fetch et un lecteur de jeton sont requis.");
    }
    this.fetch = fetchImpl;
    this.getToken = getToken;
  }

  async status(connector = {}) {
    const state = await this.#health(connector);
    return {
      ok: state.game.ready === true && state.game.compatible === true,
      connected: true,
      type: "find-the-needle-http",
      state,
      message: state.game.compatible !== true
        ? "Le mod est présent, mais cette version du jeu n’est pas compatible."
        : state.game.ready !== true
          ? ERROR_MESSAGES.game_not_ready
          : state.game.paused === true
            ? "Jeu connecté, en pause. Les effets temporisés attendent la reprise."
            : state.game.focused === false
              ? "Jeu connecté. Remettez le jeu au premier plan pour voir progresser les effets."
              : "Find The Needle Demo est connecté et prêt."
    };
  }

  async trigger(connector = {}, payload = {}, context = {}) {
    const { command, body } = buildFindTheNeedleAction(payload, context);
    context.assertGameAccess?.();
    const health = await this.#health(connector);
    // La connexion ne vaut pas autorisation durable : un changement de compte,
    // de profil, de LIVE ou d’abonnement pendant le GET annule toute POST.
    context.assertGameAccess?.();
    if (health.game.compatible !== true) {
      throw protocolError("Le mod est incompatible avec cette version de Find The Needle Demo.");
    }
    if (command !== "reset" && health.game.ready !== true) {
      throw needleError(ERROR_MESSAGES.game_not_ready, "NEEDLE_GAME_NOT_READY");
    }
    const headers = { "Content-Type": "application/json" };
    const token = String(this.getToken(connector) || "");
    if (token) {
      if (token.length > 512 || /[\r\n]/.test(token)) {
        throw needleError("Le jeton local du mod est invalide. Réassociez le mod.", "NEEDLE_TOKEN_INVALID");
      }
      headers.Authorization = `Bearer ${token}`;
    }
    context.assertGameAccess?.();
    const response = await this.#request(connector, command, {
      method: "POST", headers, body: JSON.stringify(body)
    });
    if (response.ok !== true || response.command !== command || response.version !== health.version) {
      throw protocolError("Le mod n’a pas confirmé l’exécution de l’interaction demandée.");
    }
    return {
      status: "success", sent: true, count: 1, response,
      message: response.waitingForFocus === true
        ? "Interaction reçue. Remettez le jeu au premier plan pour voir son effet."
        : response.paused === true
          ? "Interaction reçue. Reprenez la partie pour voir progresser les effets temporisés."
          : "Interaction confirmée par Find The Needle Demo."
    };
  }

  async #health(connector) {
    const state = await this.#request(connector, "health", { method: "GET" });
    if (state.ok !== true || state.mod !== MOD_ID || state.version !== SUPPORTED_VERSION ||
        !state.game || typeof state.game.ready !== "boolean" || typeof state.game.compatible !== "boolean") {
      throw protocolError("Le service local n’est pas le mod Find The Needle Demo compatible (version 1.2.7).");
    }
    return state;
  }

  async #request(connector, endpoint, options) {
    const url = findTheNeedleEndpoint(connector, endpoint);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), boundedTimeout(connector.timeoutMs));
    try {
      const response = await this.fetch(url, {
        ...options, headers: { Accept: "application/json", ...options.headers },
        redirect: "manual", signal: controller.signal
      });
      if (response.redirected || response.status >= 300 && response.status < 400) {
        throw protocolError("Le mod local ne doit pas rediriger les requêtes.");
      }
      const body = await readJsonResponse(response);
      if (!response.ok || body.ok === false) {
        const error = needleError(ERROR_MESSAGES[body.error] ||
          `Le mod a refusé l’interaction (HTTP ${response.status}).`, "NEEDLE_EFFECT_REJECTED");
        error.status = response.status;
        if (body.error === "cooldown" && Number.isFinite(Number(body.retryAfterMs))) {
          error.retryAfterMs = Math.min(60000, Math.max(0, Number(body.retryAfterMs)));
        }
        throw error;
      }
      return body;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw needleError("Le mod ne répond pas à temps. Lancez la démo avec son mod puis réessayez.", "NEEDLE_TIMEOUT");
      }
      if (error?.code?.startsWith("NEEDLE_")) throw error;
      throw needleError("Connexion au mod impossible. Lancez Find The Needle Demo avec son mod et une partie ouverte.", "NEEDLE_CONNECTION_FAILED");
    } finally {
      clearTimeout(timer);
    }
  }
}

/** URL entièrement reconstruite : aucun hôte distant, identifiant ou chemin libre. */
function findTheNeedleEndpoint(connector = {}, endpoint) {
  let base;
  try { base = new URL(String(connector.url || DEFAULT_BASE_URL)); } catch {
    throw protocolError("L’adresse du mod local est invalide.");
  }
  if (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname) ||
      base.username || base.password || base.pathname !== "/" || base.search || base.hash ||
      Number(base.port || 80) < 1024) {
    throw protocolError("Le mod doit utiliser une adresse HTTP locale, sans identifiant, chemin ni paramètres.");
  }
  if (endpoint !== "health" && !Object.hasOwn(FIND_THE_NEEDLE_COMMAND_SPECS, endpoint)) {
    throw protocolError("Interaction Find The Needle Demo inconnue.");
  }
  return new URL(`http://127.0.0.1:${base.port}/${endpoint}`);
}

/** Ne transmet que les champs prévus par le protocole ; jamais une URL ou une commande libre. */
function buildFindTheNeedleAction(payload = {}, context = {}) {
  const effect = payload.effect || {};
  const command = String(effect.code || "");
  if (!Object.hasOwn(FIND_THE_NEEDLE_COMMAND_SPECS, command)) {
    throw protocolError("Interaction Find The Needle Demo inconnue.");
  }
  const spec = FIND_THE_NEEDLE_COMMAND_SPECS[command];
  const parameters = effect.parameters || {};
  const body = {
    name: String(context.user?.displayName || context.user?.name || effect.viewer || "Spectateur")
      .replace(/[\r\n\u0000-\u001f\u007f]/g, " ").trim().slice(0, 64),
    requestId: String(payload.requestId || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 96)
  };
  if (spec.kind === "number" || spec.kind === "duration") {
    const raw = spec.kind === "duration" ? parameters.duration ?? parameters.effect : parameters.effect;
    body.effect = boundedValue(raw, spec);
    if (INTEGER_COMMANDS.has(command)) body.effect = Math.trunc(body.effect);
    if (spec.kind === "duration") body.duration = body.effect;
  } else if (spec.kind === "target") {
    const target = String(parameters.effect ?? spec.defaultValue ?? "random").trim();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(target)) {
      throw needleError("L’identifiant doit contenir uniquement lettres, chiffres, tirets ou soulignements.", "NEEDLE_PARAMETER_INVALID");
    }
    body.effect = target;
    if (command === "unlocktech" || command === "locktech") {
      body.rank = Math.trunc(boundedValue(parameters.rank, { min: 1, max: 100, defaultValue: 1 }));
    }
  }
  if (spec.duration) body.duration = boundedValue(parameters.duration, spec.duration);
  return { command, body };
}

function boundedValue(raw, spec) {
  const value = raw === undefined || raw === null || raw === "" ? spec.defaultValue : raw;
  if (typeof value === "boolean" || !["number", "string"].includes(typeof value) || !Number.isFinite(Number(value))) {
    throw needleError("La valeur du paramètre doit être un nombre fini.", "NEEDLE_PARAMETER_INVALID");
  }
  return Math.min(spec.max, Math.max(spec.min, Number(value)));
}

function boundedTimeout(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(100, Math.min(10000, Math.round(number))) : 5000;
}

async function readJsonResponse(response) {
  if (Number(response.headers?.get?.("content-length")) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel?.();
    throw protocolError("La réponse du mod local est trop volumineuse.");
  }
  let text;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw protocolError("La réponse du mod local est trop volumineuse.");
        }
        chunks.push(Buffer.from(value));
      }
      text = Buffer.concat(chunks).toString("utf8");
    } finally { reader.releaseLock(); }
  } else {
    text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw protocolError("La réponse du mod local est trop volumineuse.");
  }
  let body;
  try { body = JSON.parse(text); } catch {
    throw protocolError("Le service local ne renvoie pas le protocole JSON attendu.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw protocolError("Réponse JSON du mod invalide.");
  return body;
}

function needleError(message, code) { return Object.assign(new Error(message), { code }); }
function protocolError(message) { return needleError(message, "NEEDLE_PROTOCOL_MISMATCH"); }

module.exports = { FindTheNeedleBridge, DEFAULT_BASE_URL, buildFindTheNeedleAction, findTheNeedleEndpoint };
