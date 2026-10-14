"use strict";

/**
 * Entrée HTTPS du lecteur local : navigation de premier niveau uniquement.
 * Aucun fetch HTTP depuis HTTPS, iframe, modification de permission, vidéo
 * hébergée ni clé privée. Le serveur local revalide la capacité et l'accès Pro.
 * Le mode est explicite : les sources publiques ordinaires restent inchangées.
 */
(function prepareLocalMatchEntry() {
  const query = new URLSearchParams(location.search);
  const route = /^\/m\/(\d{12})\/([A-Za-z0-9_-]{24,128})\/?$/.exec(location.pathname);
  if (!route || location.protocol !== "https:" || query.getAll("transport").length !== 1 ||
      query.get("transport") !== "local" || query.has("widget") || query.has("preview") ||
      query.has("embedded") || window.top !== window.self) return;

  const entry = { navigating: false, status: "waiting", ready: null };
  globalThis.shenPulseMatchLocalEntry = entry;
  const report = (status) => {
    entry.status = status;
    document.documentElement.dataset.matchLocalEntry = status;
    const render = () => {
      const node = document.createElement("p");
      node.id = "match-local-entry-status";
      node.setAttribute("role", "status");
      node.textContent = status === "update-required"
        ? "Mettez ShenPulse à jour pour lire les animations localement dans TikTok Studio."
        : "Lecteur local indisponible. Ouvrez ShenPulse sur ce PC et actualisez cette source.";
      Object.assign(node.style, { color: "white", background: "rgba(16,9,28,.92)",
        font: "20px/1.5 sans-serif", padding: "18px", borderRadius: "12px" });
      document.body.appendChild(node);
      document.documentElement.classList.remove("overlay-booting");
    };
    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
    return false;
  };
  entry.ready = (async () => {
    const bootstrap = globalThis.shenPulseRelayBootstrap;
    // Le cache de six heures n'est jamais une autorisation de navigation.
    if (!bootstrap || bootstrap.channel !== route[2]) return report("unavailable");
    let deadline;
    const documentValue = await Promise.race([
      bootstrap.request,
      new Promise((resolve) => { deadline = setTimeout(() => resolve(null), 6000); })
    ]).catch(() => null);
    clearTimeout(deadline);
    const source = documentValue?.matchSource || {};
    const updatedAt = Date.parse(documentValue?.presence?.updatedAt || "");
    const age = Date.now() - updatedAt;
    const port = Number(source.localPort || 0);
    if (source.enabled !== true || source.accountNumber !== route[1] ||
        documentValue?.presence?.connected !== true || !Number.isFinite(updatedAt) ||
        age < -60_000 || age > 120_000 || !Number.isInteger(port) || port < 1 || port > 65_535) {
      return report("unavailable");
    }
    if (source.localEntryVersion !== 1) return report("update-required");
    const url = new URL(`http://127.0.0.1:${port}/match-bridge/${route[1]}/${route[2]}`);
    entry.navigating = true;
    entry.status = "navigating";
    document.documentElement.dataset.matchLocalEntry = entry.status;
    // Navigation standard vers l'application locale : la page et les vidéos
    // suivantes ont la même origine. Aucun accès croisé HTTP/HTTPS à contourner.
    location.replace(url.toString());
    return true;
  })();
})();
