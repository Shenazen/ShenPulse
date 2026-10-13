"use strict";

const DEFAULT_BASE_URL = "http://127.0.0.1:7444";
const DEFAULT_TIMEOUT_MS = 5000;

class ColorStrikeBridge {
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new TypeError("Une implémentation de fetch est requise.");
    }
    this.fetch = fetchImpl;
  }

  async status(connector = {}) {
    const response = await this.#get(
      colorStrikeEndpoint(connector, "etat"),
      connector
    );
    const state = await response.json().catch(() => null);
    if (!state || String(state.jeu || "").toLowerCase() !== "colorstrike") {
      throw new Error(
        "Le service local détecté sur le port 7444 n’est pas Color Strike."
      );
    }
    return {
      ok: true,
      type: "color-strike-http",
      status: response.status,
      state
    };
  }

  async trigger(connector = {}, payload = {}, context = {}) {
    const response = await this.#get(
      buildColorStrikeActionUrl(connector, payload, context),
      connector
    );
    const message = (await response.text()).trim();
    if (
      /chemin inconnu|il manque|invalide|introuvable|\berreur\b|seulement en partie multi|partie n['’]est pas lancée/i.test(
        message
      )
    ) {
      throw new Error(message || "Color Strike a refusé l’interaction.");
    }
    return {
      status: "success",
      sent: true,
      message: message || "Interaction envoyée à Color Strike."
    };
  }

  async #get(url, connector) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      positiveInteger(connector.timeoutMs, DEFAULT_TIMEOUT_MS, 60000)
    );
    try {
      const response = await this.fetch(url, {
        method: "GET",
        headers: { Accept: "application/json, text/plain;q=0.9" },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(
          `Color Strike ne répond pas correctement (HTTP ${response.status}).`
        );
      }
      return response;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          "Color Strike ne répond pas. Lancez le jeu depuis ShenPulse puis réessayez."
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildColorStrikeActionUrl(connector = {}, payload = {}, context = {}) {
  const url = colorStrikeEndpoint(connector, "action");
  const effect = payload.effect || {};
  const data = context.data || {};
  const user = context.user || {};
  const count = positiveInteger(data.count, 1, 1000000);
  const giftValue = nonNegativeInteger(data.value, 0, 1000000);
  const params = new URLSearchParams({
    uid: limitedText(user.id || effect.viewerId || "anonymous", 120),
    avatar: limitedText(user.avatarUrl || "", 2000),
    fx: limitedText(effect.code || "", 120),
    n: String(positiveInteger(effect.quantity, 1, 1000000)),
    d: String(Math.min(1000000, giftValue * count)),
    gift: limitedText(data.giftName || "ShenPulse", 160),
    // Le parseur HTTP de Color Strike extrait username jusqu’à la fin de la
    // requête avant de découper les autres paramètres. Il doit donc rester en
    // dernière position pour que fx, n, d et gift soient lus correctement.
    username: limitedText(
      user.displayName || user.name || effect.viewer || "Viewer",
      120
    )
  });
  url.search = params.toString();
  return url;
}

function colorStrikeEndpoint(connector = {}, endpoint) {
  const url = new URL(String(connector.url || DEFAULT_BASE_URL));
  if (url.protocol !== "http:") {
    throw new Error("Color Strike doit utiliser une passerelle HTTP locale.");
  }
  if (!isLoopbackHost(url.hostname)) {
    throw new Error("La passerelle Color Strike doit rester sur cet ordinateur.");
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  url.search = "";
  url.pathname = `/${String(endpoint || "").replace(/^\/+/, "")}`;
  return url;
}

function isLoopbackHost(hostname) {
  const value = String(hostname || "").toLowerCase();
  return value === "127.0.0.1" || value === "localhost" || value === "[::1]";
}

function limitedText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function positiveInteger(value, fallback, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(1, Math.round(number)))
    : fallback;
}

function nonNegativeInteger(value, fallback, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(0, Math.round(number)))
    : fallback;
}

module.exports = {
  ColorStrikeBridge,
  DEFAULT_BASE_URL,
  buildColorStrikeActionUrl,
  colorStrikeEndpoint
};
