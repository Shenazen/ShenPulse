"use strict";

// Opening this optional editor never captures a window or starts an effect.
function creatorMatchesVisualRectangle(first, second, limit) {
  const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  const x = Math.min(clamp(first.x), clamp(second.x)), y = Math.min(clamp(first.y), clamp(second.y));
  const width = Math.abs(clamp(first.x) - clamp(second.x)), height = Math.abs(clamp(first.y) - clamp(second.y));
  return width >= 0.005 && height >= 0.005 && width * height <= limit ? { x, y, width, height } : null;
}

function creatorMatchesVisualRegion(value, limit) {
  return value && [value.x, value.y, value.width, value.height].every(Number.isFinite) &&
    value.x >= 0 && value.y >= 0 && value.width > 0 && value.height > 0 &&
    value.x + value.width <= 1 && value.y + value.height <= 1 && value.width * value.height <= limit
    ? { x: value.x, y: value.y, width: value.width, height: value.height } : null;
}

async function openCreatorMatchesVisualEditor() {
  const owner = creatorMatchesCaptureOwner(), scope = creatorMatchesApiScope(owner), initialDialog = dialogSessionId;
  if (typeof api.matches.visualStatus !== "function" || typeof api.matches.visualSources !== "function") throw new Error("Relancez la dernière version de ShenPulse pour utiliser la lecture visuelle locale.");
  assertCreatorMatchesOwner(owner);
  const [status, sources] = await Promise.all([api.matches.visualStatus(), api.matches.visualSources()]);
  assertCreatorMatchesOwner(owner);
  if (initialDialog !== dialogSessionId) return;
  const rows = Array.isArray(sources) ? sources.filter((row) => typeof row?.id === "string" && row.id.length <= 200 &&
    typeof row.name === "string" && row.name.length <= 300).slice(0, 100) : [];
  const regions = { bannerROI: creatorMatchesVisualRegion(status?.bannerROI, 0.3), ownerROI: creatorMatchesVisualRegion(status?.ownerROI, 0.1) };
  let selectedSource = rows.some((row) => row.id === status?.sourceId) ? status.sourceId : "";
  let previewSource = "", version = 0, busy = false, selectedRegion = "bannerROI", drag = null;
  const username = String(snapshot?.state?.settings?.tiktok?.username || "").replace(/^@+/, "");
  const stateLabel = !status?.enabled ? "Désactivée" : status.active ? "Lecture locale active" : "Activée · choisissez à nouveau une fenêtre si nécessaire";
  openEditor({ title: "Lecture visuelle locale", kicker: "MATCHS · OPTION FACULTATIVE", variant: "wide",
    submitLabel: "Activer", pendingLabel: "Activation…", successMessage: "Lecture visuelle locale activée",
    body: `<div class="matches-vision-editor"><p class="matches-editor-note">Pour les bonus non transmis par TikTok, ShenPulse peut lire deux petites zones de la fenêtre choisie. <strong>Aucun cloud, aucune image enregistrée ni envoyée.</strong></p>
      <p class="matches-vision-state" role="status">${escapeHtml(stateLabel)}</p>
      <label class="field"><span>Fenêtre TikTok à lire</span><select data-vision-source><option value="">Choisir une fenêtre…</option>${rows.map((row) => `<option value="${escapeHtml(row.id)}" ${row.id === selectedSource ? "selected" : ""}>${escapeHtml(row.name)}</option>`).join("")}</select><small>Après chaque redémarrage de ShenPulse, sélectionnez à nouveau la fenêtre. Ce choix n’est pas enregistré.</small></label>
      <div class="matches-vision-toolbar"><button type="button" class="button ghost small" data-vision-preview>Afficher un aperçu local</button><button type="button" class="button ghost small" data-vision-disable ${status?.enabled ? "" : "disabled"}>Désactiver</button></div>
      <div class="matches-vision-zone-choices"><button type="button" class="button small is-selected" data-vision-region="bannerROI" aria-pressed="true">1 · Zone du ×2 / ×3</button><button type="button" class="button small ghost" data-vision-region="ownerROI" aria-pressed="false">2 · Zone de votre @</button></div>
      <p class="matches-editor-note">Dans l’aperçu, tracez un rectangle autour du bandeau du bonus (30 % de la fenêtre maximum), puis autour de <strong data-studio-user-content>@${escapeHtml(username || "votre pseudo TikTok")}</strong> (10 % maximum). Votre @ doit rester visible. Ne sélectionnez pas le bonus de l’adversaire.</p>
      <div class="matches-vision-preview" data-vision-stage hidden><img data-vision-image alt="Aperçu local de la fenêtre choisie, non enregistré" draggable="false"><div class="matches-vision-selection" data-vision-box="bannerROI" hidden><span>×2 / ×3</span></div><div class="matches-vision-selection is-owner" data-vision-box="ownerROI" hidden><span>Votre @</span></div></div>
      <p class="matches-vision-feedback" data-vision-feedback role="status">Choisissez une fenêtre puis affichez son aperçu pour tracer les deux zones.</p>
      <p class="matches-editor-note">Seul un ×2 ou ×3 réellement actif est pris en compte, après environ une seconde de confirmation. Une annonce de défi ne suffit pas. Les automatisations doivent aussi être activées ; cet écran ne lance aucun test ni effet.</p></div>`,
    onSubmit: async () => {
      assertCurrent();
      if (busy || !selectedSource || previewSource !== selectedSource || !regions.bannerROI || !regions.ownerROI) throw new Error("Choisissez une fenêtre, affichez l’aperçu et tracez les deux zones avant d’activer.");
      const result = await api.matches.saveVisual({ enabled: true, sourceId: selectedSource,
        bannerROI: { ...regions.bannerROI }, ownerROI: { ...regions.ownerROI } }, scope);
      assertCurrent(); creatorMatchesAcceptResult(result, owner);
    } });
  const session = dialogSessionId, editor = dialog.querySelector(".matches-vision-editor");
  const source = editor.querySelector("[data-vision-source]"), image = editor.querySelector("[data-vision-image]");
  const stage = editor.querySelector("[data-vision-stage]"), feedback = editor.querySelector("[data-vision-feedback]");
  const preview = editor.querySelector("[data-vision-preview]"), disable = editor.querySelector("[data-vision-disable]");
  function assertCurrent() {
    assertCreatorMatchesOwner(owner);
    if (session !== dialogSessionId || !dialog.open || !dialog.contains(editor)) throw new Error("Cette fenêtre de réglage a changé. Rouvrez la lecture visuelle locale.");
  }
  function update() {
    dialogSubmitButton.disabled = !(!busy && selectedSource && previewSource === selectedSource && regions.bannerROI && regions.ownerROI);
    preview.disabled = busy || !selectedSource; source.disabled = busy;
    for (const key of ["bannerROI", "ownerROI"]) {
      const box = editor.querySelector(`[data-vision-box="${key}"]`), region = regions[key];
      box.hidden = !region || !previewSource;
      if (region) Object.assign(box.style, { left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` });
    }
  }
  source.addEventListener("change", () => {
    selectedSource = source.value; version += 1; previewSource = ""; drag = null;
    image.removeAttribute("src"); stage.hidden = true; regions.bannerROI = null; regions.ownerROI = null;
    feedback.textContent = "Affichez un aperçu de cette fenêtre, puis tracez les deux zones."; update();
  });
  preview.addEventListener("click", async () => {
    if (busy || !selectedSource) return;
    const requestVersion = ++version, requestedSource = selectedSource;
    busy = true; update();
    try {
      assertCurrent(); const result = await api.matches.visualPreview(requestedSource, scope); assertCurrent();
      if (requestVersion !== version || requestedSource !== selectedSource) return;
      if (typeof result?.image !== "string" || result.image.length > 8 * 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(result.image)) throw new Error("L’aperçu local n’est pas disponible pour cette fenêtre.");
      image.src = result.image; previewSource = requestedSource; stage.hidden = false;
      feedback.textContent = "Tracez la zone du ×2 / ×3, puis choisissez « Zone de votre @ » et tracez votre pseudo.";
    } catch (error) { if (session === dialogSessionId && dialog.open) showDialogError(error.message); }
    finally { if (session === dialogSessionId && dialog.open) { busy = false; update(); } }
  });
  disable.addEventListener("click", async () => {
    if (busy) return;
    busy = true; disable.disabled = true; update();
    try {
      assertCurrent(); const result = await api.matches.saveVisual({ enabled: false }, scope); assertCurrent();
      creatorMatchesAcceptResult(result, owner); editor.querySelector(".matches-vision-state").textContent = "Désactivée";
      feedback.textContent = "La lecture visuelle locale est arrêtée. Les données TikTok restent utilisées normalement.";
    } catch (error) { if (session === dialogSessionId && dialog.open) { disable.disabled = false; showDialogError(error.message); } }
    finally { if (session === dialogSessionId && dialog.open) { busy = false; update(); } }
  });
  editor.querySelectorAll("[data-vision-region]").forEach((button) => button.addEventListener("click", () => {
    selectedRegion = button.dataset.visionRegion; drag = null;
    editor.querySelectorAll("[data-vision-region]").forEach((choice) => {
      const selected = choice === button; choice.classList.toggle("is-selected", selected); choice.classList.toggle("ghost", !selected); choice.setAttribute("aria-pressed", String(selected));
    });
  }));
  function point(event) {
    const box = stage.getBoundingClientRect();
    return box.width > 0 && box.height > 0 ? { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height } : null;
  }
  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || busy || previewSource !== selectedSource || !image.complete || !image.naturalWidth) return;
    try { assertCurrent(); } catch { return; }
    const first = point(event); if (!first) return;
    event.preventDefault(); drag = { first, key: selectedRegion, pointerId: event.pointerId }; stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const second = point(event); if (!second) return;
    regions[drag.key] = creatorMatchesVisualRectangle(drag.first, second, drag.key === "bannerROI" ? 0.3 : 0.1);
    feedback.textContent = regions[drag.key] ? `${drag.key === "bannerROI" ? "Zone du bonus" : "Zone de votre @"} définie.`
      : `Rectangle trop grand ou trop petit : ${drag.key === "bannerROI" ? "30" : "10"} % maximum de la fenêtre.`;
    update();
  });
  const endDrag = (event) => { if (drag?.pointerId === event.pointerId) { drag = null; stage.releasePointerCapture?.(event.pointerId); } };
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);
  function cleanup() { version += 1; image.removeAttribute("src"); previewSource = ""; drag = null; observer.disconnect(); dialog.removeEventListener("close", cleanup); }
  const observer = new MutationObserver(() => { if (!dialog.contains(editor)) cleanup(); });
  observer.observe(dialogBody, { childList: true }); dialog.addEventListener("close", cleanup, { once: true });
  update();
}
