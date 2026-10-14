"use strict";

/** Affiche les effets de jeu reçus ; aucun service ne démarre au chargement. */

function addGameEffect(payload) {
  const stage = document.getElementById("game-stage");
  const node = document.createElement("article");
  node.className = "overlay-panel game-effect";
  node.innerHTML = `<span class="game-effect-icon">◇</span><span><strong>${escapeHtml(payload.effectName)}</strong><small>Déclenché par ${escapeHtml(payload.viewer)}</small></span>`;
  stage.prepend(node);
  while (stage.children.length > 4) stage.lastElementChild.remove();
  setTimeout(() => node.remove(), 9000);
  if (typeof addMyAction === "function") {
    addMyAction({
      icon: "◇",
      title: payload.effectName || "Effet de jeu",
      detail: `Déclenché par ${payload.viewer || "Viewer"}`
    });
  }
}
