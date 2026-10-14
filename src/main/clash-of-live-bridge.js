"use strict";

const DEFAULT_BASE_URL = "http://127.0.0.1:4244";
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_BATCH_SIZE = 50;

class ClashOfLiveBridge {
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new TypeError("Une implémentation de fetch est requise.");
    }
    this.fetch = fetchImpl;
  }

  async status(connector = {}) {
    const response = await this.#get(
      clashOfLiveEndpoint(connector, "health"),
      connector
    );
    const state = await response.json().catch(() => null);
    const expectedPort = Number(
      new URL(String(connector.url || DEFAULT_BASE_URL)).port || 80
    );
    if (!state || state.ok !== true || Number(state.port) !== expectedPort) {
      throw new Error(
        "Le service local détecté sur le port 4244 n’est pas Clash Of ShenPulse."
      );
    }
    return {
      ok: true,
      type: "clash-of-live-http",
      status: response.status,
      state
    };
  }

  async trigger(connector = {}, payload = {}, context = {}) {
    const effect = payload.effect || {};
    const quantity = positiveInteger(effect.quantity, 1, MAX_BATCH_SIZE);
    let lastResponse = null;
    let lastBody = null;

    for (let index = 0; index < quantity; index += 1) {
      // Une quantité est un lot de requêtes, pas un droit permanent : les
      // effets restants sont annulés après expiration ou changement de profil.
      if (typeof context.assertGameAccess === "function") context.assertGameAccess();
      lastResponse = await this.#get(
        buildClashOfLiveActionUrl(connector, payload, context),
        connector
      );
      lastBody = await lastResponse.json().catch(() => null);
      if (!lastBody || lastBody.ok !== true) {
        throw new Error(
          lastBody?.error ||
            "Clash Of ShenPulse a refusé l’interaction locale."
        );
      }
    }

    return {
      status: "success",
      sent: true,
      count: quantity,
      response: lastBody,
      message:
        quantity > 1
          ? `${quantity} interactions envoyées à Clash Of ShenPulse.`
          : "Interaction envoyée à Clash Of ShenPulse."
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
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(
          `Clash Of ShenPulse ne répond pas correctement (HTTP ${response.status}).`
        );
      }
      return response;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          "Clash Of ShenPulse ne répond pas. Lancez le jeu depuis ShenPulse puis réessayez."
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildClashOfLiveActionUrl(
  connector = {},
  payload = {},
  context = {}
) {
  const effect = payload.effect || {};
  const route = normalizeRoute(effect.code);
  const url = clashOfLiveEndpoint(connector, route);
  const user = context.user || {};
  url.search = new URLSearchParams({
    avatar: limitedText(user.avatarUrl || "", 2000),
    username: limitedText(
      user.displayName || user.name || effect.viewer || "Viewer",
      120
    )
  }).toString();
  return url;
}

function clashOfLiveEndpoint(connector = {}, endpoint) {
  const url = new URL(String(connector.url || DEFAULT_BASE_URL));
  if (url.protocol !== "http:") {
    throw new Error(
      "Clash Of ShenPulse doit utiliser une passerelle HTTP locale."
    );
  }
  if (!isLoopbackHost(url.hostname)) {
    throw new Error(
      "La passerelle Clash Of ShenPulse doit rester sur cet ordinateur."
    );
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  url.search = "";
  url.pathname = `/${String(endpoint || "").replace(/^\/+/, "")}`;
  return url;
}

function normalizeRoute(value) {
  const route = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (
    route === "roue" ||
    /^(?:rouge|bleu)\/(?:squelette|chevalier|barbare|geant|dragon|soin|roue)$/.test(
      route
    )
  ) {
    return route;
  }
  throw new Error("Interaction Clash Of ShenPulse inconnue.");
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

module.exports = {
  ClashOfLiveBridge,
  DEFAULT_BASE_URL,
  buildClashOfLiveActionUrl,
  clashOfLiveEndpoint
};
