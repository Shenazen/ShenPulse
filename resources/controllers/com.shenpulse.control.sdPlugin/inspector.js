"use strict";

let inspectorSocket = null;
let inspectorContext = "";
let inspectorAction = "";
let inspectorSettings = {};
let inspectorRequestId = 0;
const targetSelect = document.getElementById("target");
const inspectorStatus = document.getElementById("status");

function sendInspectorRequest(command, values = {}) {
  if (inspectorSocket?.readyState !== WebSocket.OPEN) return;
  inspectorStatus.textContent = "Connexion à ShenPulse…";
  inspectorSocket.send(JSON.stringify({ event: "sendToPlugin", action: inspectorAction, context: inspectorContext, payload: { command, requestId: ++inspectorRequestId, ...values } }));
}

function displayTargets(targets) {
  const entries = inspectorAction.endsWith(".profile") ? targets.profiles || [] : targets.actions || [];
  targetSelect.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Choisissez une commande";
  targetSelect.append(empty);
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name || entry.id;
    option.selected = entry.id === inspectorSettings.targetId;
    targetSelect.append(option);
  }
}

targetSelect.addEventListener("change", () => {
  inspectorSettings = { ...inspectorSettings, targetId: targetSelect.value, targetType: inspectorAction.endsWith(".profile") ? "profile" : "action" };
  inspectorSocket?.send(JSON.stringify({ event: "setSettings", context: inspectorContext, payload: inspectorSettings }));
});
document.getElementById("refresh").addEventListener("click", () => sendInspectorRequest("targets"));
document.getElementById("pair").addEventListener("click", () => sendInspectorRequest("pair", { code: document.getElementById("code").value.trim(), endpoint: document.getElementById("endpoint").value.trim() }));

window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent, info, actionInfo) {
  const parsed = JSON.parse(actionInfo);
  inspectorContext = parsed.context || uuid;
  inspectorAction = parsed.action || "";
  inspectorSettings = parsed.payload?.settings || {};
  inspectorSocket = new WebSocket(`ws://127.0.0.1:${Number(port)}`);
  inspectorSocket.onopen = () => {
    inspectorSocket.send(JSON.stringify({ event: registerEvent, uuid }));
    sendInspectorRequest("targets");
  };
  inspectorSocket.onmessage = (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.event !== "sendToPropertyInspector") return;
    const payload = message.payload || {};
    if (payload.error) { inspectorStatus.textContent = payload.error; return; }
    inspectorStatus.textContent = payload.paired ? "ShenPulse connecté" : "Appairage nécessaire";
    if (payload.targets) displayTargets(payload.targets);
    else if (payload.paired) { document.getElementById("code").value = ""; sendInspectorRequest("targets"); }
  };
};
