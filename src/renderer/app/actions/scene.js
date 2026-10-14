"use strict";

const SCENE_ACTIONS = new Set(["scene-copy", "scene-save", "scene-format", "scene-add",
  "scene-select", "scene-toggle", "scene-reorder", "scene-remove"]);

registerActionHandler(SCENE_ACTIONS, async ({ action, target, id }) => {
  if (!SCENE_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  const draft = currentSceneDraft();
  const index = draft.widgets.findIndex((widget) => widget.id === id);
  if (action === "scene-copy") {
    const url = snapshot.localOverlayUrls?.scene;
    if (!url) return toast("Source indisponible", "Activez les sources navigateur dans les paramètres.", true);
    await api.copy(url);
    return toast("URL de scène copiée", `${draft.width} × ${draft.height} px, fond transparent.`);
  }
  if (action === "scene-save") {
    return perform(async () => {
      acceptSnapshot(await api.saveSettings({ overlayScene: ShenPulseSceneLayout.normalizeScene(draft) }));
      sceneComposerDraft = ShenPulseSceneLayout.normalizeScene(snapshot.state.settings.overlayScene);
      render();
    }, "Scène enregistrée dans votre profil");
  }
  if (action === "scene-format") {
    const portrait = target.dataset.format !== "landscape";
    const width = portrait ? 1080 : 1920;
    const height = portrait ? 1920 : 1080;
    for (const widget of draft.widgets) {
      widget.x = widget.x / draft.width * width;
      widget.y = widget.y / draft.height * height;
      widget.width = widget.width / draft.width * width;
      widget.height = widget.height / draft.height * height;
    }
    draft.width = width;
    draft.height = height;
  }
  if (action === "scene-add") {
    if (draft.widgets.length >= ShenPulseSceneLayout.MAX_WIDGETS) return;
    const key = content.querySelector("[data-scene-add-key]")?.value;
    if (!composableSceneWidgets().some((route) => route.key === key)) return;
    const [width = 600, height = 300] = overlayCatalog.definition(key)?.sourceSize || [];
    const occupied = new Set(draft.widgets.filter((entry) => entry.key === "alerts").map((entry) => entry.screen));
    const screen = key === "alerts" ? Array.from({ length: 8 }, (_value, position) => position + 1)
      .find((candidate) => !occupied.has(candidate)) : 1;
    if (!screen) return toast("Tous les écrans sont présents", "Chaque écran audio n’est ajouté qu’une fois pour éviter une lecture en double.", true);
    const widget = { id: `scene-${cryptoId()}`, key, x: 40, y: 260,
      width: Math.min(draft.width - 80, width), height: Math.min(draft.height - 80, height),
      visible: true, opacity: 100, screen };
    draft.widgets.push(widget);
    sceneSelectedWidgetId = widget.id;
  }
  if (action === "scene-select" && index >= 0) sceneSelectedWidgetId = id;
  if (action === "scene-toggle" && index >= 0) draft.widgets[index].visible = !draft.widgets[index].visible;
  if (action === "scene-remove" && index >= 0) {
    draft.widgets.splice(index, 1);
    sceneSelectedWidgetId = draft.widgets.at(-1)?.id || "";
  }
  if (action === "scene-reorder" && index >= 0) {
    const targetIndex = Math.max(0, Math.min(draft.widgets.length - 1,
      index + (target.dataset.direction === "up" ? 1 : -1)));
    [draft.widgets[index], draft.widgets[targetIndex]] = [draft.widgets[targetIndex], draft.widgets[index]];
  }
  sceneComposerDraft = ShenPulseSceneLayout.normalizeScene(draft);
  render();
});
