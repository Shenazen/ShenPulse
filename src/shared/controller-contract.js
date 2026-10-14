(function (root, factory) {
  "use strict";
  const contract = factory();
  if (typeof module === "object" && module.exports) module.exports = contract;
  else root.ShenPulseControllerContract = contract;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function normalizeMidiMessage(data = [], deviceId = "") {
    const status = Number(data[0]);
    if (!Number.isInteger(status) || status < 128 || status > 239) return null;
    const command = status & 0xf0;
    if (![0x90, 0x80, 0xb0].includes(command)) return null;
    const number = Number(data[1]);
    const value = Number(data[2]);
    if (![number, value].every((part) => Number.isInteger(part) && part >= 0 && part <= 127)) return null;
    return { deviceId: String(deviceId || "").slice(0, 240), channel: (status & 15) + 1, kind: command === 0xb0 ? "cc" : "note", number, value: command === 0x80 ? 0 : value };
  }

  function midiMappingMatches(mapping, message) {
    return Boolean(mapping?.enabled !== false && message &&
      (!mapping.deviceId || mapping.deviceId === message.deviceId) &&
      mapping.channel === message.channel && mapping.kind === message.kind &&
      mapping.number === message.number && message.value >= mapping.threshold);
  }

  function controllerActionTargets(state = {}) {
    return (state.rules || []).flatMap((rule) => (rule.actions || [])
      .filter((action) => action.id && action.type !== "action.group")
      .map((action, index) => ({
        id: String(action.id),
        name: String(action.name || (rule.actions.length > 1 ? `${rule.name || "Commande"} · ${index + 1}` : rule.name) || "Action"),
        type: String(action.type || ""),
        ruleId: String(rule.id || ""),
        enabled: rule.enabled !== false && action.enabled !== false
      })));
  }

  return { normalizeMidiMessage, midiMappingMatches, controllerActionTargets };
});
