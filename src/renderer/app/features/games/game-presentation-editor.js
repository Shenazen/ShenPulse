"use strict";

/** Brouillon de présentation : seuls les clics sur Enregistrer écrivent le profil. */
let gamePackPresentationEditor = null;

function openGamePackPresentationEditor(pack = supermarketPack()) {
  if (!ShenPulseGameWorkspacePolicy.customizable(pack) || !requireGameAccess(pack)) return;
  const base = supermarketContext(pack);
  const editor = {
    scope: { packId: pack.id, profileId: base.profileId, accountUid: base.accountUid },
    base, draft: structuredClone(base.preview.presentation), root: null, sessionId: 0
  };
  openEditor({ title: "Personnaliser l’affichage", kicker: pack.name, variant: "game-presentation",
    body: '<div class="game-presentation-editor"><div data-game-presentation-settings></div><div data-game-presentation-preview></div></div>',
    successMessage: "Présentation enregistrée",
    onSubmit: async () => { assertGamePresentationEditor(editor); await saveSupermarketOverlayPresentation(editor.draft); }
  });
  editor.root = dialogBody.querySelector(".game-presentation-editor");
  editor.sessionId = dialogSessionId;
  gamePackPresentationEditor = editor;
  refreshGamePresentationEditor(editor);
}

function assertGamePresentationEditor(editor) {
  const scope = editor.scope;
  if (gamePackPresentationEditor !== editor || !editor.root?.isConnected || !dialog.open || editor.sessionId !== dialogSessionId ||
      supermarketPack()?.id !== scope.packId || snapshot.state.session.profileId !== scope.profileId ||
      (snapshot.state.settings.account?.uid || "") !== scope.accountUid) throw new Error("Le jeu, le compte ou le profil a changé. Rouvrez la personnalisation.");
}

function gamePresentationEditorContext(editor) {
  const source = value => {
    if (!value) return "";
    const url = new URL(value, location.href);
    url.searchParams.set("editorPreview", "1");
    return url.href;
  };
  return { ...editor.base, preview: { ...editor.base.preview, editor: true, presentation: editor.draft,
    sourceUrl: source(editor.base.preview.sourceUrl), winsSourceUrl: source(editor.base.preview.winsSourceUrl) } };
}

function publishGamePresentationDraft(editor) {
  if (!editor.root?.isConnected || !dialog.open || editor.sessionId !== dialogSessionId) return;
  for (const frame of editor.root.querySelectorAll("iframe")) {
    frame.contentWindow?.postMessage({ source: "shenpulse-game-presentation", packId: editor.scope.packId, profileId: editor.scope.profileId, presentation: editor.draft }, new URL(frame.src).origin);
  }
}

function refreshGamePresentationEditor(editor, { controls = true } = {}) {
  assertGamePresentationEditor(editor);
  const C = ShenPulseGameWorkspace, ctx = gamePresentationEditorContext(editor);
  if (controls) {
    const settings = editor.root.querySelector("[data-game-presentation-settings]");
    settings.innerHTML = C.renderPreviewSettings(ctx);
    for (const button of settings.querySelectorAll("[data-action]")) {
      button.dataset.gamePresentationCommand = button.dataset.action;
      delete button.dataset.action;
    }
  }
  const host = editor.root.querySelector("[data-game-presentation-preview]"), markup = C.renderLivePreview(ctx);
  if (!editor.markup || !C.patchPreview(host, editor.markup, markup)) {
    host.innerHTML = markup;
    for (const frame of host.querySelectorAll("iframe")) frame.addEventListener("load", () => publishGamePresentationDraft(editor));
  }
  if (typeof bindOverlayRuntimeFrames === "function") bindOverlayRuntimeFrames(host);
  editor.markup = markup;
  publishGamePresentationDraft(editor);
}

function changeGamePresentationDraft(editor, patch, options) {
  assertGamePresentationEditor(editor);
  editor.draft = { ...editor.draft, ...patch };
  refreshGamePresentationEditor(editor, options);
}

dialog.addEventListener("click", event => {
  const button = event.target.closest("[data-game-presentation-command]");
  const editor = gamePackPresentationEditor;
  if (!button || !editor?.root?.contains(button)) return;
  event.preventDefault();
  try {
    const command = button.dataset.gamePresentationCommand;
    if (command === "market-overlay-model") changeGamePresentationDraft(editor, { model: Number(button.dataset.value) });
    else if (command === "market-preview-mode") changeGamePresentationDraft(editor, { motion: button.dataset.value === "animated" ? "animated" : "fixed" });
    else if (command === "market-overlay-color") changeGamePresentationDraft(editor, { backgroundColor: button.dataset.value });
    else if (command === "market-overlay-layout" && ["cardPlacement", "cameraPlacement", "rowOrder"].includes(button.dataset.layoutKey)) changeGamePresentationDraft(editor, { [button.dataset.layoutKey]: button.dataset.value });
  } catch (error) { showDialogError(error.message || String(error)); }
});

dialog.addEventListener("input", event => {
  const editor = gamePackPresentationEditor, target = event.target;
  if (!editor?.root?.contains(target)) return;
  try {
    if (target.matches("[data-market-card-size]")) {
      const size = Math.min(160, Math.max(80, Number(target.value) || 100));
      target.closest("label").querySelector("output").textContent = size + " %";
      target.setAttribute("aria-valuetext", size + " pour cent");
      changeGamePresentationDraft(editor, { cardSize: size }, { controls: false });
    } else if (target.matches("[data-market-overlay-color]")) changeGamePresentationDraft(editor, { backgroundColor: target.value }, { controls: false });
  } catch (error) { showDialogError(error.message || String(error)); }
});

dialog.addEventListener("close", () => { if (!dialog.open) gamePackPresentationEditor = null; });
