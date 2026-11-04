"use strict";

function programmedSoundPickerField(name, selectedId = "", excludeId = "") {
  const rows = soundActionRows().filter(row => row.action.type === "audio.play" && row.action.id !== excludeId);
  return `<input type="hidden" name="${escapeHtml(name)}ActionId" value="${escapeHtml(selectedId)}" data-media-linked-action>
    <label class="field full"><span>Ou choisir un son déjà configuré</span><select data-programmed-sound-picker><option value="">Bibliothèque / fichier</option>${rows.map(row => `<option value="${escapeHtml(row.action.id)}" ${row.action.id === selectedId ? "selected" : ""}>${escapeHtml(row.rule.name)} · ${escapeHtml(actionDescription(row.action))}</option>`).join("")}</select></label>`;
}

function selectProgrammedSound(select) {
  const root = select.closest("[data-media-picker-root]");
  const row = soundActionRows().find(item => item.action.id === select.value);
  if (!root) return;
  if (!select.value) return updateCompactMediaPicker(root, null);
  if (!row) return;
  updateCompactMediaPicker(root, { url: row.action.config.url, name: row.action.config.soundName || row.rule.name, actionId: row.action.id, detail: `Lié à ${row.rule.name}`, category: "son configuré" });
}

function readProgrammedSoundReference(data, name, currentAction) {
  const id = String(data.get(`${name}ActionId`) || "");
  if (!id) return "";
  const actions = flattenActions().map(row => row.action);
  const candidate = { ...currentAction, config: { ...currentAction.config, soundActionId: id } };
  if (!ShenPulseActionAudio.resolve(candidate, actions)) throw new Error("Ce son lié est introuvable ou crée une boucle. Choisissez un autre son.");
  return id;
}

/** Modifier la même donnée depuis Sons sans renommer ni réarmer son scénario. */
function openLinkedSoundEditor(row) {
  const original = row.sourceAction || row.action;
  const media = ["overlay.media", "overlay.alert"].includes(original.type);
  const config = original.config || {};
  openEditor({ title: "Modifier le son lié", kicker: `LIÉ À L’ACTION · ${row.rule.name}`,
    body: `<div class="form-grid"><p class="full">Ce son appartient à l’action « ${escapeHtml(row.rule.name)} ». Son déclencheur reste celui de l’action.</p>${soundPickerField("linkedSound", media ? config.soundUrl : config.url, { selectedName: config.soundName || "", selectedActionId: config.soundActionId || "", excludeActionId: original.id, optional: media })}${field("volume", "Volume", config.volume ?? 1, "number", 'min="0" max="1" step="0.05"')}</div>`,
    onSubmit: async data => {
      const reference = readProgrammedSoundReference(data, "linkedSound", original);
      const url = String(data.get("linkedSound") || "");
      if (!media && !url && !reference) throw new Error("Choisissez un son à jouer.");
      const actions = [...row.rule.actions];
      actions[row.actionIndex] = { ...original, config: { ...config, [media ? "soundUrl" : "url"]: url, soundName: data.get("linkedSoundName"), soundActionId: reference, volume: Number(data.get("volume")) } };
      await api.upsert("rules", { ...row.rule, actions });
      snapshot = await api.getSnapshot();
    }
  });
}
