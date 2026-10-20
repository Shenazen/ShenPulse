"use strict";

let streamDeckSocket = null;
let pluginId = "";
let integrationSettings = {};
const actionSettings = new Map();
const pendingCommands = new Set();
let localConnectionPromise = null;

function refreshLocalConnection() {
  if (!window.document?.createElement) return Promise.resolve();
  if (localConnectionPromise) return localConnectionPromise;
  localConnectionPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `local-connection.js?t=${Date.now()}`;
    script.onload = () => {
      script.remove();
      const connection = window.ShenPulseLocalConnection;
      integrationSettings = connection?.token ? connection : {};
      if (!integrationSettings.token) reject(new Error("Ouvrez ShenPulse et connectez Stream Deck depuis la page Contrôleurs."));
      else resolve();
    };
    script.onerror = () => { script.remove(); integrationSettings = {}; reject(new Error("Installez le plugin depuis ShenPulse pour activer la connexion automatique.")); };
    document.head.append(script);
  }).finally(() => { localConnectionPromise = null; });
  return localConnectionPromise;
}

function streamDeckSend(event, context, payload) {
  if (streamDeckSocket?.readyState !== WebSocket.OPEN) return;
  streamDeckSocket.send(JSON.stringify({ event, context, ...(payload ? { payload } : {}) }));
}

function controllerEndpoint() {
  const endpoint = String(integrationSettings.endpoint || "http://127.0.0.1:21217").replace(/\/$/, "");
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || parsed.username || parsed.password) throw new Error("Adresse ShenPulse invalide.");
  return parsed.origin;
}

async function controllerRequest(route, options = {}) {
  if (route !== "/pair") await refreshLocalConnection();
  const response = await fetch(`${controllerEndpoint()}${route}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...(integrationSettings.token && route !== "/pair" ? { Authorization: `Bearer ${integrationSettings.token}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(10000)
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error("Réponse ShenPulse illisible."); }
  if (!response.ok) throw new Error(payload.error || "ShenPulse est indisponible.");
  return payload;
}

async function receiveStreamDeckEvent(message) {
  const { event, context, payload = {} } = message;
  if (["willAppear", "didReceiveSettings"].includes(event)) {
    actionSettings.set(context, { ...payload.settings, targetType: message.action?.endsWith(".profile") ? "profile" : "action" });
    return;
  }
  if (event === "willDisappear") { actionSettings.delete(context); return; }
  if (event === "didReceiveGlobalSettings") { integrationSettings = payload.settings || {}; return; }
  if (event === "keyDown") {
    const settings = actionSettings.get(context) || payload.settings || {};
    if (pendingCommands.has(context)) return;
    pendingCommands.add(context);
    try {
      if (!settings.targetId) throw new Error("Sélectionnez une commande ShenPulse pour cette touche.");
      await controllerRequest("/execute", { method: "POST", body: { targetType: settings.targetType || (message.action?.endsWith(".profile") ? "profile" : "action"), targetId: settings.targetId } });
      streamDeckSend("showOk", context);
    } catch {
      streamDeckSend("showAlert", context);
    } finally { pendingCommands.delete(context); }
    return;
  }
  if (event !== "sendToPlugin") return;
  const requestId = payload.requestId;
  try {
    if (payload.command === "pair") {
      integrationSettings.endpoint = payload.endpoint;
      const paired = await controllerRequest("/pair", { method: "POST", body: { code: String(payload.code), name: "Stream Deck" } });
      integrationSettings = { endpoint: controllerEndpoint(), token: paired.token, deviceId: paired.deviceId };
      streamDeckSend("setGlobalSettings", pluginId, integrationSettings);
      streamDeckSend("sendToPropertyInspector", context, { requestId, paired: true });
    } else if (payload.command === "targets") {
      const targets = await controllerRequest("/targets");
      streamDeckSend("sendToPropertyInspector", context, { requestId, paired: Boolean(integrationSettings.token), targets });
    }
  } catch (error) {
    streamDeckSend("sendToPropertyInspector", context, { requestId, error: error.message, paired: false });
  }
}

window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent) {
  pluginId = uuid;
  streamDeckSocket = new WebSocket(`ws://127.0.0.1:${Number(port)}`);
  streamDeckSocket.onopen = () => {
    streamDeckSocket.send(JSON.stringify({ event: registerEvent, uuid }));
    streamDeckSend("getGlobalSettings", uuid);
  };
  streamDeckSocket.onmessage = (event) => {
    try { receiveStreamDeckEvent(JSON.parse(event.data)).catch(() => {}); } catch { /* Ignore invalid host messages. */ }
  };
};
