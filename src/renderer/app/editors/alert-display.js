"use strict";

function actionAlertDisplayFields(config = {}, { standalone = false } = {}) {
  const alert = config.alert || {};
  const otherTypes = Object.keys(ACTION_TYPE_LABELS).filter(type => type !== "overlay.media").join(" ");
  return `<div class="action-alert-editor full">
    ${standalone ? '<input type="checkbox" name="alertEnabled" value="true" data-action-alert-enabled checked hidden>' : `<label class="action-alert-enable"><span class="switch"><input type="checkbox" name="alertEnabled" value="true" data-action-alert-enabled ${alert.enabled === true ? "checked" : ""}><span></span></span><span><strong>Afficher le viewer et/ou un texte</strong><small>Une alerte sur votre LIVE, avec ou sans média.</small></span></label>`}
    <fieldset class="action-alert-options" data-action-alert-options>
      <label class="field full"><span>Texte personnalisé</span><textarea name="alertMessage" maxlength="500" rows="2" placeholder="{avatar} Merci {username} !">${escapeHtml(Object.hasOwn(alert, "message") ? alert.message : "{avatar} Merci {username} !")}</textarea><small>Insérez la photo, le nom et les informations de la personne qui déclenche l’action. Sans texte, son nom reste affiché.</small></label>
      <div class="action-alert-variables full" aria-label="Variables du texte">${Object.entries({ avatar: "Photo de profil du viewer qui déclenche cette action.", username: "Identifiant @ du viewer, sans le signe @.", nickname: "Nom d’affichage choisi par le viewer.", giftname: "Nom du cadeau reçu.", repeatcount: "Nombre de cadeaux du combo reçu.", coins: "Nombre total de pièces du cadeau ou du combo reçu.", likecount: "Nombre de likes transmis par cet événement.", totallikecount: "Total des likes du LIVE.", comment: "Commentaire envoyé par le viewer.", submonth: "Nombre de mois d’abonnement du viewer." }).map(([name, help]) => `<span class="action-alert-variable"><button type="button" data-action-alert-variable="${name}" title="Insérer {${name}}">{${name}}</button><span class="action-variable-info" tabindex="0" role="note" aria-label="${escapeHtml(help)}" data-tooltip="${escapeHtml(help)}">i</span></span>`).join("")}</div>
      <div class="form-grid full">${field("alertColor", "Couleur du texte", alert.color || "#ffffff", "color")}
        ${field("alertStrokeColor", "Contour des lettres", alert.strokeColor || "#000000", "color")}
        ${field("alertFontSize", "Taille du texte (px)", alert.fontSize ?? 42, "number", 'min="8" max="240" step="1"')}
        ${field("alertStrokeWidth", "Épaisseur du contour (px)", alert.strokeWidth ?? 1.5, "number", 'min="0" max="20" step="0.5"')}
        <label class="field"><span>Police</span><select name="alertFont">${["Inter", "Arial", "Georgia", "Impact", "Verdana"].map(font => `<option value="${font}" ${(alert.font || "Inter") === font ? "selected" : ""}>${font}</option>`).join("")}</select></label>
        <label class="field"><span>Position du texte</span><select name="alertPosition"><option value="top" ${alert.position === "top" ? "selected" : ""}>En haut</option><option value="bottom" ${alert.position !== "top" ? "selected" : ""}>En bas</option></select></label>
        ${conditionalFields(otherTypes, `<label class="field"><span>Écran Media</span><select name="alertScreen">${Array.from({length: 8}, (_, index) => `<option value="${index + 1}" ${Number(alert.screen || config.screen || 1) === index + 1 ? "selected" : ""}>Écran ${index + 1}</option>`).join("")}</select></label>${field("alertDurationMs", "Durée de l’alerte (ms)", alert.durationMs || 5000, "number", 'min="500" max="60000" step="100"')}`, "action-alert-timing")}
      </div>
      ${conditionalFields("overlay.media", '<p class="action-alert-help">Le nom et le texte utilisent le même écran et la même durée que le média. Vous pouvez aussi laisser le média vide pour afficher uniquement cette alerte.</p>')}
      <p class="action-alert-help">Ajoutez l’URL de l’écran Media choisi dans votre studio (disponible en bas de la page Actions).</p>
    </fieldset>
  </div>`;
}

function readActionAlertDisplay(data, previous = {}, type = "") {
  if (!data.has("alertEnabled")) return { ...previous, enabled: false };
  const message = String(data.get("alertMessage") || "").trim().slice(0, 500);
  // Le nom est déjà dans le texte lorsqu’une variable d’identité est utilisée.
  const showUser = !/\{(?:username|nickname)\}/i.test(message);
  const media = type === "overlay.media";
  return { enabled: true, showUser, message,
    color: /^#[0-9a-f]{6}$/i.test(data.get("alertColor") || "") ? data.get("alertColor") : "#ffffff",
    strokeColor: /^#[0-9a-f]{6}$/i.test(data.get("alertStrokeColor") || "") ? data.get("alertStrokeColor") : "#000000",
    fontSize: alertDisplayNumber(data.get("alertFontSize"), 42, 8, 240),
    strokeWidth: alertDisplayNumber(data.get("alertStrokeWidth"), 1.5, 0, 20),
    font: ["Inter", "Arial", "Georgia", "Impact", "Verdana"].includes(data.get("alertFont")) ? data.get("alertFont") : "Inter",
    position: data.get("alertPosition") === "top" ? "top" : "bottom",
    screen: Math.min(8, Math.max(1, Math.round(Number(data.get(media ? "mediaScreen" : "alertScreen")) || 1))),
    durationMs: Math.min(60000, Math.max(500, Number(data.get(media ? "durationMs" : "alertDurationMs")) || 5000)) };
}

function alertDisplayNumber(value, fallback, min, max) {
  const number = value == null || String(value).trim() === "" ? NaN : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

/** Tester les réglages du brouillon sur les véritables sources Media choisies. */
async function previewActionEditorViewer(context) {
  const parts = context.parts.filter(part => part.type === "overlay.text");
  if (!parts.length) throw new Error("Ajoutez une action « Viewer et/ou texte » pour tester son affichage.");
  const screens = new Set();
  await Promise.all(parts.map(async part => {
    const alert = readActionAlertDisplay(actionComponentFormData(part.panels.get(part.type)), {}, part.type);
    const result = await api.testAction({ type: "overlay.text", config: { alert } });
    if (result?.skipped) throw new Error("Le texte est vide : saisissez un message ou une variable de viewer.");
    screens.add(alert.screen);
  }));
  if (dialog.open && context.root?.isConnected) toast("Test envoyé", "Viewer et texte envoyés sur " + (screens.size > 1 ? "les écrans " : "l’écran ") + [...screens].sort((a,b) => a-b).join(", ") + ". Ouvrez la source correspondante dans votre studio.");
}

function syncActionAlertDisplay(scope = dialogBody) {
  const enabled = scope.querySelector("[data-action-alert-enabled]")?.checked === true;
  const options = scope.querySelector("[data-action-alert-options]");
  if (!options) return;
  options.hidden = !enabled;
  options.disabled = !enabled;
}

dialog.addEventListener("click", event => {
  const button = event.target.closest("[data-action-alert-variable]");
  if (!button) return;
  const input = button.closest(".action-alert-editor")?.querySelector('[name="alertMessage"]');
  if (!input || input.disabled) return;
  const token = `{${button.dataset.actionAlertVariable}}`;
  const start = input.selectionStart, end = input.selectionEnd;
  if (input.value.length - (end - start) + token.length > 500) return;
  input.setRangeText(token, start, end, "end");
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
