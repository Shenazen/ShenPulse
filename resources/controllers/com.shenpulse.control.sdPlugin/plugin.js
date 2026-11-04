"use strict";

let streamDeckSocket = null;
let integrationSettings = {};
const actionSettings = new Map();
const pendingCommands = new Set();
let localConnectionPromise = null;

function refreshLocalConnection() {
  if (!window.document?.createElement) return Promise.resolve();
  if (localConnectionPromise) return localConnectionPromise;
  localConnectionPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => { script.remove(); reject(Error("La connexion locale à ShenPulse ne répond pas.")); }, 5000);
    script.src = `local-connection.js?t=${Date.now()}`;
    script.onload = () => {
      clearTimeout(timer); script.remove();
      integrationSettings = window.ShenPulseLocalConnection?.token ? window.ShenPulseLocalConnection : {};
      if (!integrationSettings.token) reject(Error("Ouvrez ShenPulse, puis utilisez Reconnecter Stream Deck dans Contrôleurs.")); else resolve();
    };
    script.onerror = () => { clearTimeout(timer); script.remove(); integrationSettings = {}; reject(Error("Réinstallez le plugin depuis ShenPulse → Contrôleurs.")); };
    document.head.append(script);
  }).finally(() => { localConnectionPromise = null; });
  return localConnectionPromise;
}
function streamDeckSend(event, context, payload, action) {
  if (streamDeckSocket?.readyState === WebSocket.OPEN) streamDeckSocket.send(JSON.stringify({ event, context, ...(action ? { action } : {}), ...(payload !== undefined ? { payload } : {}) }));
}
function controllerEndpoint() {
  const parsed = new URL(String(integrationSettings.endpoint || "http://127.0.0.1:21217"));
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw Error("Adresse ShenPulse invalide.");
  return parsed.origin;
}
async function controllerRequest(route, options = {}) {
  await refreshLocalConnection();
  let response;
  try {
    response = await fetch(controllerEndpoint() + route, { method: options.body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${integrationSettings.token}` }, body: options.body ? JSON.stringify(options.body) : undefined, signal: AbortSignal.timeout(10000) });
  } catch { throw Error("ShenPulse est indisponible. Ouvrez l’application sur ce PC puis réessayez."); }
  const payload = await response.json().catch(() => { throw Error("Réponse ShenPulse illisible."); });
  if (!response.ok) throw Error(payload.error || "La commande a été refusée par ShenPulse.");
  return payload;
}
function targetTypeFor(action, settings = {}) {
  if (action?.endsWith(".profile")) return "profile";
  if (action?.endsWith(".rule")) return "rule";
  if (action?.endsWith(".automation")) return "automation";
  if ([".match", ".counter", ".timer", ".music", ".wheel"].some(suffix => action?.endsWith(suffix))) return "command";
  return settings.targetType || "action";
}
function updateTitle(context, settings) {
  if (settings.autoTitle !== false && settings.targetLabel) streamDeckSend("setTitle", context, { title: settings.targetLabel.slice(0, 70), target: 0 });
}
async function executeButton(context, action, settings) {
  if (!settings.targetId) throw Error("Choisissez une commande pour cette touche.");
  const targets = await controllerRequest("/targets");
  const result = await controllerRequest("/execute", { body: { targetType: targetTypeFor(action, settings), targetId: settings.targetId, options: settings.options || {}, expectedProfileId: targets.activeProfile?.id } });
  if (!result.ok) throw Error(result.error || "La commande n’a pas été confirmée.");
  streamDeckSend("showOk", context);
  return result;
}
async function receiveStreamDeckEvent(message) {
  const { event, context, action, payload = {} } = message;
  if (["willAppear", "didReceiveSettings"].includes(event)) {
    const settings = { ...payload.settings, targetType: targetTypeFor(action, payload.settings) };
    actionSettings.set(context, { action, settings }); updateTitle(context, settings); return;
  }
  if (event === "willDisappear") { actionSettings.delete(context); return; }
  if (event === "keyDown") {
    if (pendingCommands.has(context)) return;
    pendingCommands.add(context);
    try { await executeButton(context, action, actionSettings.get(context)?.settings || payload.settings || {}); }
    catch (error) { streamDeckSend("showAlert", context); streamDeckSend("sendToPropertyInspector", context, { error: error.message }, action); }
    finally { pendingCommands.delete(context); }
    return;
  }
  if (event !== "sendToPlugin") return;
  try {
    if (payload.command === "targets") {
      const targets = await controllerRequest("/targets");
      streamDeckSend("sendToPropertyInspector", context, { requestId: payload.requestId, paired: true, targets }, action);
    } else if (payload.command === "test") {
      if (pendingCommands.has(context)) throw Error("Une commande est déjà en cours pour cette touche.");
      pendingCommands.add(context);
      try {
        await executeButton(context, action, payload.settings || {});
        streamDeckSend("sendToPropertyInspector", context, { requestId: payload.requestId, executed: true }, action);
      } finally { pendingCommands.delete(context); }
    }
  } catch (error) { streamDeckSend("sendToPropertyInspector", context, { requestId: payload.requestId, error: error.message }, action); }
}
window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent) {
  streamDeckSocket = new WebSocket(`ws://127.0.0.1:${Number(port)}`);
  streamDeckSocket.onopen = () => streamDeckSocket.send(JSON.stringify({ event: registerEvent, uuid }));
  streamDeckSocket.onmessage = event => { try { receiveStreamDeckEvent(JSON.parse(event.data)).catch(() => {}); } catch { /* Ignore malformed host events. */ } };
};
