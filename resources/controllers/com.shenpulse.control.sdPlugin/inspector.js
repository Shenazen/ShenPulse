"use strict";
let inspectorSocket, inspectorContext = "", inspectorAction = "", inspectorSettings = {}, inspectorRequestId = 0;
let catalog = null, catalogSignature = "", requestTimer = null, waiting = false;
const targetSelect = document.getElementById("target"), status = document.getElementById("status"), fields = document.getElementById("fields");
const testButton = document.getElementById("test");
function typeForAction() {
  if (inspectorAction.endsWith(".profile")) return "profile";
  if (inspectorAction.endsWith(".rule")) return "rule";
  if (inspectorAction.endsWith(".automation")) return "automation";
  return [".match", ".counter", ".timer", ".music", ".wheel"].some(suffix => inspectorAction.endsWith(suffix)) ? "command" : "action";
}
function entriesFor(targets) {
  if (typeForAction() === "command") {
    const prefix = inspectorAction.split(".").at(-1);
    return (targets.commands || []).filter(entry => prefix === "counter" ? entry.id.startsWith("wins.") : prefix === "timer" ? /^(timer|multiplier)\./.test(entry.id) : entry.id.startsWith(prefix + "."));
  }
  return targets[{ action: "actions", profile: "profiles", rule: "rules", automation: "automations" }[typeForAction()]] || [];
}
function saveSettings() {
  inspectorSettings.targetType = typeForAction();
  inspectorSocket?.send(JSON.stringify({ event: "setSettings", action: inspectorAction, context: inspectorContext, payload: inspectorSettings }));
}
function selectedEntry() { return catalog && entriesFor(catalog).find(entry => entry.id === inspectorSettings.targetId); }
function renderFields() {
  fields.replaceChildren();
  for (const field of selectedEntry()?.fields || []) {
    const label = document.createElement("label"); label.textContent = field.label;
    const input = document.createElement(field.type === "select" ? "select" : "input"); input.dataset.key = field.key;
    const configured = inspectorSettings.options?.[field.key] ?? field.default;
    if (field.type === "select") {
      for (const choice of field.options) { const option = document.createElement("option"); option.value = choice.value; option.textContent = choice.label; input.append(option); }
    } else { input.type = "number"; input.min = field.min; input.max = field.max; input.step = field.step || 1; }
    input.value = configured;
    if (field.type === "select" && !input.value) input.value = field.default;
    label.append(input); fields.append(label);
    input.addEventListener("change", () => {
      inspectorSettings.options = { ...(inspectorSettings.options || {}), [field.key]: field.type === "number" && input.value !== "" ? Number(input.value) : input.value };
      saveSettings();
    });
  }
  testButton.disabled = !selectedEntry();
}
function displayTargets(targets) {
  catalog = targets;
  document.getElementById("active-profile").textContent = targets.activeProfile?.name ? `Profil actif : ${targets.activeProfile.name}` : "Aucun profil actif";
  const entries = entriesFor(targets), signature = JSON.stringify(entries);
  if (signature === catalogSignature) return;
  catalogSignature = signature;
  targetSelect.replaceChildren();
  const empty = document.createElement("option"); empty.value = ""; empty.textContent = entries.length ? "Choisir une commande…" : targets.protocolVersion === 2 ? "Aucune commande disponible" : "Mettez ShenPulse à jour"; targetSelect.append(empty);
  for (const entry of entries) {
    const option = document.createElement("option"); option.value = entry.id; option.textContent = entry.name || entry.id; targetSelect.append(option);
  }
  targetSelect.value = inspectorSettings.targetId || "";
  if (inspectorSettings.targetId && !entries.some(entry => entry.id === inspectorSettings.targetId)) {
    const missing = document.createElement("option"); missing.value = inspectorSettings.targetId; missing.textContent = "Commande absente du profil actif"; targetSelect.append(missing); targetSelect.value = inspectorSettings.targetId;
  }
  renderFields();
}
function sendInspectorRequest(command, values = {}) {
  if (inspectorSocket?.readyState !== WebSocket.OPEN || waiting) return;
  waiting = true; const requestId = ++inspectorRequestId;
  status.className = "loading"; status.textContent = command === "test" ? "Exécution de la commande…" : catalog ? "Actualisation…" : "Connexion à ShenPulse…";
  requestTimer = setTimeout(() => { waiting = false; status.className = "error"; status.textContent = "Le plugin ne répond pas. Relancez le plugin ou Stream Deck."; }, 12000);
  inspectorSocket.send(JSON.stringify({ event: "sendToPlugin", action: inspectorAction, context: inspectorContext, payload: { command, requestId, ...values } }));
}
targetSelect.addEventListener("change", () => {
  const previous = inspectorSettings.options || {};
  inspectorSettings = { ...inspectorSettings, targetId: targetSelect.value, targetLabel: targetSelect.selectedOptions[0]?.textContent, options: {} };
  for (const field of selectedEntry()?.fields || []) inspectorSettings.options[field.key] = field.type === "select" && !field.options.some(item => item.value === previous[field.key]) ? field.default : previous[field.key] ?? field.default;
  saveSettings(); renderFields();
});
document.getElementById("auto-title").addEventListener("change", event => { inspectorSettings.autoTitle = event.target.checked; saveSettings(); });
document.getElementById("refresh").addEventListener("click", () => sendInspectorRequest("targets"));
testButton.addEventListener("click", () => sendInspectorRequest("test", { settings: inspectorSettings }));
setInterval(() => { if (!document.hidden) sendInspectorRequest("targets"); }, 5000);
window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent, info, actionInfo) {
  const parsed = JSON.parse(actionInfo);
  // The inspector must use its registered UUID. actionInfo.context can differ.
  inspectorContext = uuid;
  inspectorAction = parsed.action || ""; inspectorSettings = parsed.payload?.settings || {};
  document.getElementById("auto-title").checked = inspectorSettings.autoTitle !== false;
  inspectorSocket = new WebSocket(`ws://127.0.0.1:${Number(port)}`);
  inspectorSocket.onopen = () => { inspectorSocket.send(JSON.stringify({ event: registerEvent, uuid })); sendInspectorRequest("targets"); };
  inspectorSocket.onclose = () => { clearTimeout(requestTimer); waiting = false; status.className = "error"; status.textContent = "Stream Deck est déconnecté. Sélectionnez à nouveau cette touche."; };
  inspectorSocket.onmessage = event => {
    let message; try { message = JSON.parse(event.data); } catch { return; }
    if (message.event === "didReceiveSettings") { inspectorSettings = message.payload?.settings || {}; catalogSignature = ""; if (catalog) displayTargets(catalog); return; }
    if (message.event !== "sendToPropertyInspector") return;
    const payload = message.payload || {};
    if (payload.requestId !== undefined && payload.requestId !== inspectorRequestId) return;
    clearTimeout(requestTimer); waiting = false;
    if (payload.error) { status.className = "error"; status.textContent = payload.error; return; }
    status.className = "success"; status.textContent = payload.executed ? "Commande exécutée ✓" : "Connecté à ShenPulse ✓";
    if (payload.targets) displayTargets(payload.targets);
  };
};
