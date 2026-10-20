"use strict";

let creatorMatchesVisualStatusCache = null;
let creatorMatchesVisualStatusRequest = null;
let creatorMatchesVisualStatusCheckedAt = 0;

/** Read-only status, never a capture request. Window titles and IDs are not
 * retained in this presentation cache or included in the page. */
function creatorMatchesVisualStatusConfigKey() {
  return JSON.stringify(snapshot?.state?.settings?.matches?.visualBonus || null);
}

function creatorMatchesVisualStatusCurrent() {
  const cached = creatorMatchesVisualStatusCache;
  try {
    if (cached?.configKey === creatorMatchesVisualStatusConfigKey()) {
      assertCreatorMatchesOwner(cached.owner);
      return cached.status;
    }
  } catch { /* A previous account or profile never supplies this status. */ }
  return null;
}

function creatorMatchesVisualStatusView(status = creatorMatchesVisualStatusCurrent(), config = snapshot?.state?.settings?.matches?.visualBonus) {
  const selfScreen = config?.ownerMode === "self-screen";
  if (config?.enabled !== true) return {
    code: "disabled", title: "Lecture visuelle désactivée",
    detail: "Le premier bonus court peut ne pas être transmis par TikTok. Pour le détecter sans attendre de cadeau, configurez une fenêtre compatible et la zone du bonus, avec identification visible ou déclaration explicite de votre propre écran."
  };
  if (status?.state === "layout-changed") return { code: "layout-changed", title: "Disposition modifiée : confirmation requise",
    detail: "La disposition du match a changé. La lecture de la zone déclarée est arrêtée : affichez un nouvel aperçu, vérifiez votre position et confirmez à nouveau le bandeau de votre propre côté." };
  if (status?.state === "confirmation-required") return { code: "confirmation-required", title: "Zone à confirmer à nouveau",
    detail: "Le LIVE, le compte ou le calibrage a changé. La lecture de la zone déclarée est arrêtée : un nouvel aperçu et une nouvelle confirmation de votre propre côté sont nécessaires." };
  if (["unavailable", "capture-unavailable", "ocr-unavailable"].includes(status?.state)) return {
    code: "error", title: "Lecture visuelle indisponible",
    detail: status.state === "ocr-unavailable" ? "La reconnaissance Windows n’est pas disponible. Vérifiez les réglages locaux. Les bonus réellement reçus de TikTok restent détectés normalement."
      : "La lecture locale est interrompue. Rouvrez les réglages pour vérifier la fenêtre et les zones choisies. Les bonus réellement reçus de TikTok restent détectés normalement."
  };
  if (status?.state === "recovering") return { code: "recovering", title: "Reconnexion de la lecture locale",
    detail: "La lecture tente de reprendre uniquement la fenêtre que vous avez choisie. Aucun bonus n’est inventé pendant cette interruption." };
  if (!status || status.state === "choose-window" || !status.hasSelection) return {
    code: "choose-window", title: "Fenêtre à choisir sur ce PC",
    detail: selfScreen ? "L’option est enregistrée, mais aucune fenêtre n’est sélectionnée. Après chaque relance de ShenPulse, choisissez la fenêtre, affichez un nouvel aperçu et confirmez explicitement votre propre zone ; cette confirmation n’est jamais restaurée."
      : "L’option est enregistrée, mais aucune fenêtre n’est sélectionnée. Après chaque relance de ShenPulse, choisissez à nouveau la fenêtre compatible et vérifiez les deux zones."
  };
  if (status.state === "waiting-match" || snapshot?.state?.session?.running !== true) return {
    code: "waiting-match", title: "En attente du LIVE et du match",
    detail: "La fenêtre est choisie. La lecture attend un match identifié sur votre propre LIVE ; elle ne dépend pas de la réception d’un cadeau."
  };
  if (status.active && status.state === "reading") return selfScreen ? { code: "reading", title: "Lecture active — zone déclarée par vous",
    detail: "Le bandeau est lu dans la zone que vous avez confirmée. Votre identité n’est pas vérifiée par l’image : un bandeau global ou adverse peut être ambigu. Si vous déplacez les panneaux, vérifiez le cadrage. Les contrôles du match et du compte TikTok restent appliqués." }
    : { code: "reading", title: "Lecture visuelle active",
      detail: "Les deux zones sont lues localement pendant toute la manche. Gardez le bandeau et votre identité visibles dans la fenêtre choisie ; deux images concordantes confirment le bonus." };
  return { code: "starting", title: "Démarrage de la lecture locale",
    detail: "La fenêtre choisie est en cours de préparation. Aucun effet n’est déclenché par cet affichage de statut." };
}

function creatorMatchesVisualStatusMarkup() {
  const view = creatorMatchesVisualStatusView();
  return `<aside class="matches-vision-notice" data-matches-vision-status data-state="${view.code}"><div><strong data-matches-vision-status-title role="status">${escapeHtml(view.title)}</strong><p data-matches-vision-status-detail>${escapeHtml(view.detail)}</p><small>Lecture facultative sur ce PC, sans cloud ni enregistrement. Un affichage uniquement sur téléphone ne peut pas être lu ici.</small></div><button type="button" class="button small ghost" data-action="matches-visual-configure">${view.code === "disabled" ? "Configurer la lecture locale" : "Vérifier les réglages"}</button></aside>`;
}

function creatorMatchesAcceptVisualStatus(status, owner) {
  assertCreatorMatchesOwner(owner);
  if (!status || typeof status.enabled !== "boolean") return;
  creatorMatchesVisualStatusCache = { owner, configKey: creatorMatchesVisualStatusConfigKey(), status: {
    enabled: status.enabled, active: status.active === true, state: typeof status.state === "string" ? status.state : "unavailable",
    hasSelection: typeof status.sourceId === "string" && Boolean(status.sourceId)
  } };
  creatorMatchesPaintVisualStatus();
}

function creatorMatchesPaintVisualStatus() {
  const target = typeof content !== "undefined" ? content.querySelector("[data-matches-vision-status]") : null;
  if (!target) return;
  const view = creatorMatchesVisualStatusView();
  target.dataset.state = view.code;
  target.querySelector("[data-matches-vision-status-title]").textContent = view.title;
  target.querySelector("[data-matches-vision-status-detail]").textContent = view.detail;
}

function syncCreatorMatchesVisualStatus() {
  const panel = typeof content !== "undefined" ? content.querySelector("[data-creator-matches-panel]") : null;
  if (typeof currentPage === "undefined" || currentPage !== "matches" || typeof creatorMatchesTab === "undefined" || creatorMatchesTab !== "automations" ||
    !panel?.querySelector("[data-matches-vision-status]") || !isAccountAuthenticated() || !hasProAccess() || !canNavigateTo("matches") ||
    typeof creatorMatchesOwnerKey === "function" && panel.dataset.matchesOwner !== creatorMatchesOwnerKey() ||
    typeof rendererVisualsActive === "function" && !rendererVisualsActive()) {
    creatorMatchesVisualStatusRequest = null; creatorMatchesVisualStatusCheckedAt = 0; return;
  }
  creatorMatchesPaintVisualStatus();
  if (snapshot?.state?.settings?.matches?.visualBonus?.enabled !== true || snapshot?.state?.session?.running !== true ||
    typeof api.matches.visualStatus !== "function") { creatorMatchesVisualStatusRequest = null; return; }
  try { if (creatorMatchesVisualStatusRequest) assertCreatorMatchesOwner(creatorMatchesVisualStatusRequest.owner); }
  catch { creatorMatchesVisualStatusRequest = null; creatorMatchesVisualStatusCheckedAt = 0; }
  if (creatorMatchesVisualStatusRequest || Date.now() - creatorMatchesVisualStatusCheckedAt < 1000) return;
  const owner = creatorMatchesCaptureOwner(), configKey = creatorMatchesVisualStatusConfigKey();
  const request = { owner, panel, configKey }; creatorMatchesVisualStatusRequest = request;
  creatorMatchesVisualStatusCheckedAt = Date.now();
  const current = () => {
    assertCreatorMatchesOwner(owner);
    return !(creatorMatchesVisualStatusRequest !== request || currentPage !== "matches" || creatorMatchesTab !== "automations" ||
      content.querySelector("[data-creator-matches-panel]") !== panel || configKey !== creatorMatchesVisualStatusConfigKey() ||
      snapshot?.state?.session?.running !== true || typeof rendererVisualsActive === "function" && !rendererVisualsActive());
  };
  Promise.resolve().then(() => current() ? api.matches.visualStatus() : null).then((status) => {
    if (current()) creatorMatchesAcceptVisualStatus(status, owner);
  }).catch(() => {
    try { if (current()) creatorMatchesAcceptVisualStatus({ enabled: true, active: false, state: "unavailable" }, owner); }
    catch { /* No response, error, window title or account data crosses scope. */ }
  }).finally(() => {
    if (creatorMatchesVisualStatusRequest === request) creatorMatchesVisualStatusRequest = null;
  });
}

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
  let ownerMode = ["studio-self", "self-screen"].includes(status?.ownerMode) ? status.ownerMode : "username";
  let ownPosition = status?.ownPosition === "top-left" ? "top-left" : "left";
  let previewSource = "", previewAtMs = 0, version = 0, busy = false, selectedRegion = "bannerROI", drag = null;
  const username = String(snapshot?.state?.settings?.tiktok?.username || "").replace(/^@+/, "");
  const stateLabel = creatorMatchesVisualStatusView({ ...status, hasSelection: Boolean(selectedSource) }, { enabled: status?.enabled, ownerMode }).title;
  openEditor({ title: "Lecture visuelle locale", kicker: "MATCHS · OPTION FACULTATIVE", variant: "wide",
    submitLabel: "Activer", pendingLabel: "Activation…", successMessage: "Lecture visuelle locale activée",
    body: `<div class="matches-vision-editor"><p class="matches-editor-note">Le premier bonus court peut ne pas être transmis par TikTok. ShenPulse peut lire une ou deux petites zones d’une fenêtre compatible, sans attendre de cadeau. <strong>Aucun cloud, aucune image enregistrée ni envoyée.</strong></p>
      <p class="matches-vision-state" role="status">${escapeHtml(stateLabel)}</p>
      <label class="field"><span>Fenêtre TikTok à lire</span><select data-vision-source><option value="">Choisir une fenêtre…</option>${rows.map((row) => `<option value="${escapeHtml(row.id)}" ${row.id === selectedSource ? "selected" : ""}>${escapeHtml(row.name)}</option>`).join("")}</select><small>Après chaque redémarrage de ShenPulse, sélectionnez à nouveau la fenêtre. Ce choix n’est pas enregistré.</small></label>
      <label class="field"><span>Comment identifier votre côté du match ?</span><select data-vision-owner-mode><option value="username" ${ownerMode === "username" ? "selected" : ""}>@pseudo dans la zone</option><option value="studio-self" ${ownerMode === "studio-self" ? "selected" : ""}>TikTok Studio : encart « Toi » (1 contre 1)</option><option value="self-screen" ${ownerMode === "self-screen" ? "selected" : ""}>Mon propre écran — zone déclarée</option></select><small>Le mode Studio est un choix explicite : votre nom vérifié et « Toi » doivent être visibles dans la même zone. En équipe ou si l’identité est ambiguë, utilisez votre @ dans une autre fenêtre compatible, ou déclarez explicitement votre propre écran ci-dessous.</small></label>
      <div class="matches-vision-self-settings" data-vision-self-settings hidden><label class="field"><span>Ma position dans cette disposition</span><select data-vision-own-position><option value="left" ${ownPosition === "left" ? "selected" : ""}>À gauche — 1 contre 1</option><option value="top-left" ${ownPosition === "top-left" ? "selected" : ""}>En haut à gauche — 3 ou 4 créateurs</option></select></label><p class="matches-editor-note">Dans ce mode, aucun nom ni « Toi » n’est lu : <strong>votre identité n’est pas vérifiée par l’image.</strong> La position est déclarée par vous, pas reconnue automatiquement. Un bandeau global ou concernant l’adversaire ne prouve pas votre bonus. Gardez uniquement le bandeau de votre propre côté dans le rectangle ; les contrôles du match et du compte TikTok restent appliqués.</p></div>
      <div class="matches-vision-toolbar"><button type="button" class="button ghost small" data-vision-preview>Afficher un aperçu local</button><button type="button" class="button ghost small" data-vision-disable ${status?.enabled ? "" : "disabled"}>Désactiver</button></div>
      <div class="matches-vision-zone-choices"><button type="button" class="button small is-selected" data-vision-region="bannerROI" aria-pressed="true">1 · Zone du ×2 / ×3</button><button type="button" class="button small ghost" data-vision-region="ownerROI" aria-pressed="false">2 · <span data-vision-owner-choice>Zone de votre @</span></button></div>
      <p class="matches-editor-note">Dans l’aperçu, tracez un rectangle autour du bandeau du bonus (30 % de la fenêtre maximum)<span data-vision-identity-instructions>, puis autour de votre identité (10 % maximum)</span>. <span data-vision-owner-guide>Votre @ doit rester visible.</span> Ne sélectionnez pas le bonus de l’adversaire. Créateur suivi : <strong data-studio-user-content>@${escapeHtml(username || "votre pseudo TikTok")}</strong>.</p>
      <div class="matches-vision-preview" data-vision-stage hidden><img data-vision-image alt="Aperçu local de la fenêtre choisie, non enregistré" draggable="false"><div class="matches-vision-selection" data-vision-box="bannerROI" hidden><span>×2 / ×3</span></div><div class="matches-vision-selection is-owner" data-vision-box="ownerROI" hidden><span data-vision-owner-box>Votre @</span></div></div>
      <p class="matches-vision-feedback" data-vision-feedback role="status">Choisissez une fenêtre puis affichez son aperçu pour tracer les deux zones.</p>
      <label class="matches-vision-self-confirmation" data-vision-self-confirmation hidden><input type="checkbox" data-vision-own-screen-confirmed><span data-vision-own-screen-confirmation-label></span></label>
      <p class="matches-editor-note">Seul un ×2 ou ×3 réellement actif est pris en compte, après environ une seconde de confirmation. Une annonce de défi ne suffit pas. Les automatisations doivent aussi être activées ; cet écran ne lance aucun test ni effet.</p></div>`,
    onSubmit: async () => {
      assertCurrent();
      const selfScreen = ownerMode === "self-screen";
      if (busy || !selectedSource || previewSource !== selectedSource || !regions.bannerROI || (!selfScreen && !regions.ownerROI)) throw new Error(selfScreen
        ? "Choisissez une fenêtre, affichez un aperçu récent et tracez le bandeau de votre propre côté avant d’activer."
        : "Choisissez une fenêtre, affichez l’aperçu et tracez les deux zones avant d’activer.");
      if (selfScreen && (!previewAtMs || Date.now() - previewAtMs > 120000)) throw new Error("L’aperçu est trop ancien. Affichez un nouvel aperçu, retracez le bandeau et confirmez votre propre côté.");
      if (selfScreen && !confirmation.checked) throw new Error("Confirmez explicitement que le bandeau sélectionné concerne votre côté et pas celui de l’adversaire.");
      busy = true; update();
      try {
        const result = await api.matches.saveVisual({ enabled: true, sourceId: selectedSource,
          bannerROI: { ...regions.bannerROI }, ownerROI: selfScreen ? null : { ...regions.ownerROI },
          ...(selfScreen ? { ownerMode, ownPosition, ownScreenConfirmed: true } : ownerMode === "studio-self" ? { ownerMode } : {}) }, scope);
        assertCurrent(); creatorMatchesAcceptResult(result, owner);
        creatorMatchesAcceptVisualStatus(result?.vision, owner);
      } finally { if (session === dialogSessionId && dialog.contains(editor)) { busy = false; update(); } }
    } });
  const session = dialogSessionId, editor = dialog.querySelector(".matches-vision-editor");
  const source = editor.querySelector("[data-vision-source]"), image = editor.querySelector("[data-vision-image]");
  const mode = editor.querySelector("[data-vision-owner-mode]");
  const position = editor.querySelector("[data-vision-own-position]"), confirmation = editor.querySelector("[data-vision-own-screen-confirmed]");
  const stage = editor.querySelector("[data-vision-stage]"), feedback = editor.querySelector("[data-vision-feedback]");
  const preview = editor.querySelector("[data-vision-preview]"), disable = editor.querySelector("[data-vision-disable]");
  function assertCurrent() {
    assertCreatorMatchesOwner(owner);
    if (session !== dialogSessionId || !dialog.open || !dialog.contains(editor)) throw new Error("Cette fenêtre de réglage a changé. Rouvrez la lecture visuelle locale.");
  }
  function update() {
    const selfScreen = ownerMode === "self-screen";
    dialogSubmitButton.disabled = !(!busy && selectedSource && previewSource === selectedSource && regions.bannerROI &&
      (selfScreen ? confirmation.checked && previewAtMs > 0 && Date.now() - previewAtMs <= 120000 : regions.ownerROI));
    preview.disabled = busy || !selectedSource; source.disabled = busy; mode.disabled = busy; position.disabled = busy;
    editor.querySelector("[data-vision-self-settings]").hidden = !selfScreen;
    editor.querySelector("[data-vision-self-confirmation]").hidden = !selfScreen;
    editor.querySelector('[data-vision-region="ownerROI"]').hidden = selfScreen;
    editor.querySelector('[data-vision-region="ownerROI"]').disabled = selfScreen;
    editor.querySelector("[data-vision-identity-instructions]").hidden = selfScreen;
    editor.querySelectorAll("[data-vision-region]").forEach((button) => {
      const selected = button.dataset.visionRegion === selectedRegion;
      button.classList.toggle("is-selected", selected); button.classList.toggle("ghost", !selected); button.setAttribute("aria-pressed", String(selected));
    });
    confirmation.disabled = busy || !selfScreen || previewSource !== selectedSource || !regions.bannerROI;
    editor.querySelector("[data-vision-own-screen-confirmation-label]").textContent = `Je confirme que ce bandeau concerne mon côté ${ownPosition === "top-left" ? "en haut à gauche" : "à gauche"}, pas celui de l’adversaire. Cette déclaration n’est pas une vérification d’identité par l’image.`;
    editor.querySelector("[data-vision-owner-choice]").textContent = ownerMode === "studio-self" ? "Zone de votre nom + Toi" : "Zone de votre @";
    editor.querySelector("[data-vision-owner-box]").textContent = ownerMode === "studio-self" ? "Votre nom + Toi" : "Votre @";
    editor.querySelector("[data-vision-owner-guide]").textContent = selfScreen
      ? "Tracez uniquement le bandeau ×2 / ×3 de votre côté déclaré, puis cochez la confirmation. Aucun deuxième rectangle d’identité n’est demandé."
      : ownerMode === "studio-self"
      ? "Dans Studio, encadrez ensemble votre nom de créateur et le libellé « Toi », pas la ligne « Adversaire ». Le nom doit identifier sans ambiguïté votre côté du 1 contre 1."
      : "Votre @ doit rester visible dans cette zone ; un simple nom d’affichage ne suffit pas dans ce mode.";
    for (const key of ["bannerROI", "ownerROI"]) {
      const box = editor.querySelector(`[data-vision-box="${key}"]`), region = regions[key];
      box.hidden = !region || !previewSource || selfScreen && key === "ownerROI";
      if (region) Object.assign(box.style, { left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` });
    }
  }
  source.addEventListener("change", () => {
    selectedSource = source.value; version += 1; previewSource = ""; previewAtMs = 0; drag = null; confirmation.checked = false;
    image.removeAttribute("src"); stage.hidden = true; regions.bannerROI = null; regions.ownerROI = null;
    feedback.textContent = ownerMode === "self-screen" ? "Affichez un aperçu de cette fenêtre, puis tracez le bandeau de votre propre côté."
      : "Affichez un aperçu de cette fenêtre, puis tracez les deux zones."; update();
  });
  mode.addEventListener("change", () => {
    ownerMode = ["studio-self", "self-screen"].includes(mode.value) ? mode.value : "username";
    version += 1; previewSource = ""; previewAtMs = 0; drag = null; confirmation.checked = false; selectedRegion = "bannerROI";
    image.removeAttribute("src"); stage.hidden = true;
    regions.bannerROI = null; regions.ownerROI = null;
    feedback.textContent = ownerMode === "self-screen" ? "Le mode a changé. Affichez un nouvel aperçu, tracez votre bandeau puis confirmez explicitement votre côté."
      : "Le mode d’identification a changé. Affichez un nouvel aperçu puis tracez à nouveau les deux zones."; update();
  });
  position.addEventListener("change", () => {
    ownPosition = position.value === "top-left" ? "top-left" : "left";
    version += 1; previewSource = ""; previewAtMs = 0; drag = null; confirmation.checked = false;
    image.removeAttribute("src"); stage.hidden = true; regions.bannerROI = null; regions.ownerROI = null;
    feedback.textContent = "Votre position a changé. Affichez un nouvel aperçu, tracez votre bandeau puis confirmez à nouveau votre côté."; update();
  });
  confirmation.addEventListener("change", update);
  preview.addEventListener("click", async () => {
    if (busy || !selectedSource) return;
    const requestVersion = ++version, requestedSource = selectedSource;
    confirmation.checked = false; previewAtMs = 0;
    if (ownerMode === "self-screen") {
      previewSource = ""; regions.bannerROI = null; regions.ownerROI = null; image.removeAttribute("src"); stage.hidden = true;
    }
    busy = true; update();
    try {
      assertCurrent(); const result = await api.matches.visualPreview(requestedSource, scope); assertCurrent();
      if (requestVersion !== version || requestedSource !== selectedSource) return;
      if (typeof result?.image !== "string" || result.image.length > 8 * 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(result.image)) throw new Error("L’aperçu local n’est pas disponible pour cette fenêtre.");
      image.src = result.image; previewSource = requestedSource; previewAtMs = Date.now(); stage.hidden = false;
      feedback.textContent = ownerMode === "self-screen" ? "Tracez uniquement le bandeau de votre propre côté, puis cochez la confirmation. L’identité n’est pas lue dans ce mode."
        : ownerMode === "studio-self"
        ? "Tracez la zone du ×2 / ×3, puis la zone contenant ensemble votre nom de créateur et « Toi »."
        : "Tracez la zone du ×2 / ×3, puis choisissez « Zone de votre @ » et tracez votre pseudo.";
    } catch (error) { if (session === dialogSessionId && dialog.open) showDialogError(error.message); }
    finally { if (session === dialogSessionId && dialog.open) { busy = false; update(); } }
  });
  disable.addEventListener("click", async () => {
    if (busy) return;
    busy = true; disable.disabled = true; update();
    try {
      assertCurrent(); const result = await api.matches.saveVisual({ enabled: false }, scope); assertCurrent();
      creatorMatchesAcceptResult(result, owner); editor.querySelector(".matches-vision-state").textContent = "Désactivée";
      creatorMatchesAcceptVisualStatus(result?.vision, owner);
      feedback.textContent = "La lecture visuelle locale est arrêtée. Les données TikTok restent utilisées normalement.";
    } catch (error) { if (session === dialogSessionId && dialog.open) { disable.disabled = false; showDialogError(error.message); } }
    finally { if (session === dialogSessionId && dialog.open) { busy = false; update(); } }
  });
  editor.querySelectorAll("[data-vision-region]").forEach((button) => button.addEventListener("click", () => {
    if (ownerMode === "self-screen" && button.dataset.visionRegion !== "bannerROI") return;
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
    confirmation.checked = false; update();
    event.preventDefault(); drag = { first, key: selectedRegion, pointerId: event.pointerId }; stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const second = point(event); if (!second) return;
    confirmation.checked = false;
    regions[drag.key] = creatorMatchesVisualRectangle(drag.first, second, drag.key === "bannerROI" ? 0.3 : 0.1);
    feedback.textContent = regions[drag.key] ? `${drag.key === "bannerROI" ? "Zone du bonus" : "Zone de votre @"} définie.`
      : `Rectangle trop grand ou trop petit : ${drag.key === "bannerROI" ? "30" : "10"} % maximum de la fenêtre.`;
    update();
  });
  const endDrag = (event) => { if (drag?.pointerId === event.pointerId) { drag = null; stage.releasePointerCapture?.(event.pointerId); } };
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);
  function cleanup() { version += 1; image.removeAttribute("src"); previewSource = ""; previewAtMs = 0; confirmation.checked = false; drag = null; observer.disconnect(); dialog.removeEventListener("close", cleanup); }
  const observer = new MutationObserver(() => { if (!dialog.contains(editor)) cleanup(); });
  observer.observe(dialogBody, { childList: true }); dialog.addEventListener("close", cleanup, { once: true });
  update();
}
