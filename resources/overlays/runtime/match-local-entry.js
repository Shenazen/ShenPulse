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
  let stream = null, stopped = false, statusNode = null, deadline = null, cancelBootstrap = null;
  const stop = () => {
    stopped = true; stream?.close(); clearTimeout(deadline); cancelBootstrap?.(null);
  };
  const report = (status) => {
    entry.status = status;
    document.documentElement.dataset.matchLocalEntry = status;
    const render = () => {
      if (entry.navigating) return;
      const node = statusNode || document.createElement("p");
      if (!statusNode) {
        node.id = "match-local-entry-status";
        node.setAttribute("role", "status");
      }
      node.textContent = status === "update-required"
        ? "Mettez ShenPulse à jour pour lire les animations localement dans TikTok Studio."
        : stopped
          ? "Lecteur local indisponible. Vérifiez votre lien Matchs et votre accès Pro dans ShenPulse."
          : "En attente de ShenPulse sur ce PC. Le lecteur reprendra automatiquement dès sa connexion.";
      Object.assign(node.style, { color: "white", background: "rgba(16,9,28,.92)",
        font: "20px/1.5 sans-serif", padding: "18px", borderRadius: "12px" });
      if (!statusNode) document.body.appendChild(node);
      statusNode = node;
      document.documentElement.classList.remove("overlay-booting");
    };
    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
    return false;
  };
  const refuse = (status = "unavailable") => { stop(); return report(status); };

  /** Une preuve fraîche autorise seulement la navigation ; le serveur local
   * revalide ensuite compte, capacité et abonnement. Ni cache ni ancien flux
   * ne peuvent remplacer une présence en ligne courante.
   */
  const accept = (documentValue, authoritative = false) => {
    if (stopped || entry.navigating) return false;
    if (!documentValue || typeof documentValue !== "object" || Array.isArray(documentValue)) {
      return authoritative ? refuse() : report("unavailable");
    }
    const source = documentValue.matchSource || {};
    const port = Number(source.localPort || 0);
    if (source.enabled !== true || source.accountNumber !== route[1] ||
        !Number.isInteger(port) || port < 1 || port > 65_535) return refuse();
    if (source.localEntryVersion !== 1) return refuse("update-required");
    const updatedAt = Date.parse(documentValue.presence?.updatedAt || "");
    const age = Date.now() - updatedAt;
    if (documentValue.presence?.connected !== true || !Number.isFinite(updatedAt) ||
        age < -60_000 || age > 120_000) return report("unavailable");
    const url = new URL(`http://127.0.0.1:${port}/match-bridge/${route[1]}/${route[2]}`);
    stop();
    entry.navigating = true;
    entry.status = "navigating";
    document.documentElement.dataset.matchLocalEntry = entry.status;
    // Navigation standard : page et vidéos suivantes ont la même origine.
    location.replace(url.toString());
    return true;
  };

  /** Le flux public existant remplace toute scrutation HTTP. Il n'est ouvert
   * qu'en attente d'un démarrage/reconnexion, puis fermé dès la navigation.
   * Un alias supprimé, accès refusé ou compte différent arrête définitivement
   * cette entrée. Une coupure réseau attend le nouveau snapshot Firebase,
   * jamais une réutilisation de la dernière preuve reçue.
   */
  const waitForPresence = () => {
    if (stopped || stream || typeof EventSource !== "function") return;
    let proof = {}, initialized = false;
    const fields = { matchSource: ["enabled", "accountNumber", "localPort", "localEntryVersion"],
      presence: ["connected", "updatedAt"] };
    const assign = (path, value, patch) => {
      const parts = path.split("/").filter(Boolean), [section, field] = parts;
      if (!Object.prototype.hasOwnProperty.call(fields, section) || parts.length > 2) return;
      if (field) {
        if (fields[section].includes(field)) proof[section] = { ...proof[section], [field]: value };
        return;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) { proof[section] = {}; return; }
      const next = patch ? { ...proof[section] } : {};
      for (const key of fields[section]) if (value && Object.prototype.hasOwnProperty.call(value, key)) next[key] = value[key];
      proof[section] = next;
    };
    const mutation = (event, patch) => {
      if (stopped || entry.navigating) return;
      try {
        const value = JSON.parse(event.data), path = String(value.path || "/");
        if (path === "/") {
          if (!value.data || typeof value.data !== "object" || Array.isArray(value.data)) return refuse();
          if (!patch) { proof = {}; initialized = true; }
          if (!initialized) return;
          for (const [key, data] of Object.entries(value.data)) assign(`/${key}`, data, patch);
        } else {
          if (!initialized) return;
          if (patch && value.data && typeof value.data === "object" && !Array.isArray(value.data)) {
            for (const [key, data] of Object.entries(value.data)) assign(`${path}/${key}`, data, false);
          } else assign(path, value.data, false);
        }
        accept(proof, true);
      } catch { /* Une trame malformée n'est jamais une autorisation. */ }
    };
    try {
      stream = new EventSource(`https://shenazenoverlay-default-rtdb.firebaseio.com/publicOverlayRelay/${encodeURIComponent(route[2])}.json`);
      stream.addEventListener("put", (event) => mutation(event, false));
      stream.addEventListener("patch", (event) => mutation(event, true));
      stream.addEventListener("cancel", () => refuse());
      stream.addEventListener("auth_revoked", () => refuse());
      stream.addEventListener("error", () => {
        if (stopped) return;
        proof = {}; initialized = false;
        report("unavailable");
      });
    } catch { report("unavailable"); }
  };
  window.addEventListener("pagehide", stop, { once: true });
  entry.ready = (async () => {
    const bootstrap = globalThis.shenPulseRelayBootstrap;
    // Le cache de six heures n'est jamais une autorisation de navigation.
    if (!bootstrap || bootstrap.channel !== route[2]) return refuse();
    const documentValue = await Promise.race([
      bootstrap.request,
      new Promise((resolve) => { cancelBootstrap = resolve; deadline = setTimeout(() => resolve(null), 6000); })
    ]).catch(() => null);
    clearTimeout(deadline);
    deadline = null; cancelBootstrap = null;
    if (stopped) return false;
    if (accept(documentValue)) return true;
    waitForPresence();
    return false;
  })();
})();
