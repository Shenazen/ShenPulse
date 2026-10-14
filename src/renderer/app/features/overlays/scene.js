"use strict";

let sceneComposerDraft = null;
let sceneComposerContext = "";
let sceneSelectedWidgetId = "";
let scenePreviewRevision = 0;

function currentSceneDraft() {
  const context = `${snapshot?.state?.settings?.account?.uid || ""}:${snapshot?.state?.session?.profileId || ""}`;
  if (!sceneComposerDraft || context !== sceneComposerContext) {
    sceneComposerContext = context;
    sceneComposerDraft = ShenPulseSceneLayout.normalizeScene(snapshot?.state?.settings?.overlayScene);
    sceneSelectedWidgetId = sceneComposerDraft.widgets[0]?.id || "";
  }
  return sceneComposerDraft;
}

function sceneWidgetLabel(key) {
  return overlayCatalog.definition(key)?.name || {
    alerts: "Alertes & médias", goals: "Objectifs", feed: "Activité LIVE"
  }[key] || key;
}

function composableSceneWidgets() {
  return overlayCatalog.routes.filter((route) =>
    ShenPulseSceneLayout.routeFor(route.key) && (!route.requiresPro || hasProAccess()) &&
    (!overlayCatalog.definition(route.key) || canAccessOverlay(overlayCatalog.definition(route.key)))
  );
}

function scenePreviewSource() {
  const base = snapshot?.localOverlayUrls?.scene || "";
  if (!base) return "";
  const url = new URL(base);
  url.searchParams.set("preview", "static");
  return url.toString();
}

function renderSceneComposer() {
  if (!isAccountAuthenticated()) return "";
  const draft = currentSceneDraft();
  const choices = composableSceneWidgets();
  const selected = draft.widgets.find((widget) => widget.id === sceneSelectedWidgetId);
  return `<section class="scene-composer card" data-scene-composer>
    <header class="scene-composer-header">
      <div><span class="eyebrow">SCÈNE LIVE</span><h3>Votre show, une seule source</h3>
      <p>Composez vos widgets sur une scène transparente puis ajoutez son URL dans votre logiciel de diffusion.</p></div>
      <div class="button-row">
        <button class="button small ghost" disabled title="La scène HTTPS sera disponible après publication du service d’overlays à jour.">LIVE Studio · publication nécessaire</button>
        <button class="button small ghost" data-action="scene-copy" data-delivery="local">Copier URL OBS</button>
        <button class="button small primary" data-action="scene-save">Enregistrer la scène</button>
      </div>
    </header>
    <div class="scene-composer-toolbar">
      <label>Nom de la scène<input data-scene-meta="name" maxlength="100" value="${escapeHtml(draft.name)}"></label>
      <div class="scene-format-buttons">
        <button class="button small ${draft.height > draft.width ? "primary" : "ghost"}" data-action="scene-format" data-format="portrait">Portrait 9:16</button>
        <button class="button small ${draft.width > draft.height ? "primary" : "ghost"}" data-action="scene-format" data-format="landscape">Paysage 16:9</button>
      </div>
      <label class="scene-widget-picker">Ajouter un widget<select data-scene-add-key>${choices.map((route) =>
        `<option value="${escapeHtml(route.key)}">${escapeHtml(sceneWidgetLabel(route.key))}</option>`).join("")}</select></label>
      <button class="button small" data-action="scene-add" ${draft.widgets.length >= ShenPulseSceneLayout.MAX_WIDGETS ? "disabled" : ""}>+ Ajouter</button>
    </div>
    <div class="scene-composer-workspace">
      <div class="scene-preview-pane">
        <div class="scene-preview-surface" data-scene-surface style="aspect-ratio:${draft.width}/${draft.height}">
          <iframe data-scene-preview title="Aperçu de votre scène ShenPulse" src="${escapeHtml(scenePreviewSource())}" sandbox="allow-scripts allow-same-origin" tabindex="-1"></iframe>
          <div class="scene-selection-layer" data-scene-selection-layer>${renderSceneSelectionBoxes(draft)}</div>
        </div>
        <p class="scene-source-hint">${draft.width} × ${draft.height} px · ${draft.widgets.filter((widget) => widget.visible).length} widgets visibles · Déplacez les cadres pour composer votre scène.</p>
      </div>
      <aside class="scene-layers-panel">
        <div class="scene-layers-title"><strong>Calques</strong><span>${draft.widgets.length} / ${ShenPulseSceneLayout.MAX_WIDGETS}</span></div>
        <div class="scene-layers-list">${[...draft.widgets].reverse().map((widget) => `<div class="scene-layer ${widget.id === sceneSelectedWidgetId ? "selected" : ""}">
          <button class="scene-layer-select" data-action="scene-select" data-id="${escapeHtml(widget.id)}"><span>${widget.visible ? "◉" : "○"}</span><strong>${escapeHtml(sceneWidgetLabel(widget.key))}</strong></button>
          <button class="scene-layer-command" data-action="scene-toggle" data-id="${escapeHtml(widget.id)}" title="${widget.visible ? "Masquer" : "Afficher"}">${widget.visible ? "◌" : "◉"}</button>
          <button class="scene-layer-command" data-action="scene-reorder" data-id="${escapeHtml(widget.id)}" data-direction="up" title="Passer au premier plan">↑</button>
          <button class="scene-layer-command" data-action="scene-reorder" data-id="${escapeHtml(widget.id)}" data-direction="down" title="Passer à l’arrière-plan">↓</button>
          <button class="scene-layer-command" data-action="scene-remove" data-id="${escapeHtml(widget.id)}" title="Retirer de la scène">×</button>
        </div>`).join("") || `<p class="muted">Ajoutez votre premier widget.</p>`}</div>
        ${selected ? `<div class="scene-widget-inspector"><strong>${escapeHtml(sceneWidgetLabel(selected.key))}</strong>
          <div class="scene-coordinate-grid">${[["x", "Position X"], ["y", "Position Y"], ["width", "Largeur"], ["height", "Hauteur"]].map(([key, label]) =>
            `<label>${label}<input type="number" min="${["width", "height"].includes(key) ? 80 : 0}" max="3840" data-scene-field="${key}" data-id="${escapeHtml(selected.id)}" value="${selected[key]}"></label>`).join("")}</div>
          <label>Opacité<input type="range" min="0" max="100" data-scene-field="opacity" data-id="${escapeHtml(selected.id)}" value="${selected.opacity}"></label>
          ${selected.key === "alerts" ? `<label>Écran audio<input type="number" min="1" max="8" data-scene-field="screen" data-id="${escapeHtml(selected.id)}" value="${selected.screen}"></label>` : ""}
          ${overlayCatalog.definition(selected.key) ? `<button class="button small ghost" data-action="configure-overlay" data-id="${escapeHtml(selected.key)}">Design & réglages du widget</button>` : ""}
        </div>` : ""}
        <p class="scene-save-hint">La composition est enregistrée dans le profil actif. Les réglages des widgets sont partagés avec leurs sources individuelles.</p>
      </aside>
    </div>
  </section>`;
}

function renderSceneSelectionBoxes(draft) {
  return draft.widgets.filter((widget) => widget.visible).map((widget) =>
    `<button type="button" class="scene-selection-box ${widget.id === sceneSelectedWidgetId ? "selected" : ""}" data-scene-drag="${escapeHtml(widget.id)}"
      aria-label="Déplacer ${escapeHtml(sceneWidgetLabel(widget.key))}"
      style="left:${widget.x / draft.width * 100}%;top:${widget.y / draft.height * 100}%;width:${widget.width / draft.width * 100}%;height:${widget.height / draft.height * 100}%">
      <span>${escapeHtml(sceneWidgetLabel(widget.key))}</span></button>`
  ).join("");
}

function hydrateSceneComposerPreview(frame) {
  if (!frame?.contentWindow) return;
  const draft = currentSceneDraft();
  const targetOrigin = new URL(frame.src).origin;
  const send = (channel, payload) => frame.contentWindow.postMessage({
    source: "shenpulse-overlay-card", channel, payload
  }, targetOrigin);
  send("scene", { ...draft, proAccess: hasProAccess() });
  for (const widget of draft.widgets) {
    send("configuration", { overlayKey: widget.key, config: overlayConfig(widget.key) });
  }
  send("bootstrap", { overlayScene: { ...draft, proAccess: hasProAccess() },
    overlaySession: snapshot.state.overlaySession, statistics: snapshot.state.statistics,
    session: snapshot.state.session, goals: snapshot.state.goals });
}

function refreshScenePreview({ boxes = false } = {}) {
  const root = content.querySelector("[data-scene-composer]");
  if (!root) return;
  if (boxes) root.querySelector("[data-scene-selection-layer]").innerHTML = renderSceneSelectionBoxes(currentSceneDraft());
  const revision = ++scenePreviewRevision;
  requestAnimationFrame(() => {
    if (revision === scenePreviewRevision) hydrateSceneComposerPreview(root.querySelector("[data-scene-preview]"));
  });
}

function bindSceneComposer(root = content) {
  const composer = root.querySelector("[data-scene-composer]");
  if (!composer || composer.dataset.sceneBound) return;
  composer.dataset.sceneBound = "true";
  const frame = composer.querySelector("[data-scene-preview]");
  frame?.addEventListener("load", () => hydrateSceneComposerPreview(frame));
  composer.addEventListener("input", (event) => {
    const meta = event.target.closest("[data-scene-meta]");
    if (meta) currentSceneDraft()[meta.dataset.sceneMeta] = meta.value;
    const field = event.target.closest("[data-scene-field]");
    if (!field) return;
    const widget = currentSceneDraft().widgets.find((entry) => entry.id === field.dataset.id);
    if (!widget) return;
    widget[field.dataset.sceneField] = Number(field.value);
    sceneComposerDraft = ShenPulseSceneLayout.normalizeScene(currentSceneDraft());
    refreshScenePreview({ boxes: true });
  });
  composer.addEventListener("pointerdown", (event) => {
    const box = event.target.closest("[data-scene-drag]");
    if (!box || !isAccountAuthenticated()) return;
    const draft = currentSceneDraft();
    const widget = draft.widgets.find((entry) => entry.id === box.dataset.sceneDrag);
    if (!widget) return;
    event.preventDefault();
    sceneSelectedWidgetId = widget.id;
    const surface = composer.querySelector("[data-scene-surface]").getBoundingClientRect();
    const origin = { clientX: event.clientX, clientY: event.clientY, x: widget.x, y: widget.y };
    box.setPointerCapture(event.pointerId);
    box.classList.add("selected");
    const move = (next) => {
      widget.x = Math.round(Math.max(0, Math.min(draft.width - 20,
        origin.x + (next.clientX - origin.clientX) / surface.width * draft.width)));
      widget.y = Math.round(Math.max(0, Math.min(draft.height - 20,
        origin.y + (next.clientY - origin.clientY) / surface.height * draft.height)));
      box.style.left = `${widget.x / draft.width * 100}%`;
      box.style.top = `${widget.y / draft.height * 100}%`;
      refreshScenePreview();
    };
    const finish = () => {
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", finish);
      box.removeEventListener("pointercancel", finish);
      sceneComposerDraft = ShenPulseSceneLayout.normalizeScene(draft);
      render();
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", finish, { once: true });
    box.addEventListener("pointercancel", finish, { once: true });
  });
}

window.addEventListener("message", (event) => {
  const frame = content.querySelector("[data-scene-preview]");
  if (!frame || frame.contentWindow !== event.source ||
    event.data?.source !== "shenpulse-overlay-runtime" || event.data.type !== "ready") return;
  hydrateSceneComposerPreview(frame);
});
