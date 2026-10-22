"use strict";

function renderAdminGameVersion(gameId, settings) {
  const minimum = visibilityTools.gameMinimumVersionFor(settings, gameId, snapshot.packs.find(pack => pack.id === gameId)?.minAppVersion);
  return `<div class="admin-game-version">
    <span>Version minimale ShenPulse</span>
    <button type="button" class="button small ghost" data-action="admin-game-version" data-id="${escapeHtml(gameId)}" aria-label="Modifier la version minimale de ${escapeHtml(snapshot.packs.find(pack => pack.id === gameId)?.name || gameId)}" ${adminBusy ? "disabled" : ""}>${minimum ? `≥ ${escapeHtml(minimum)}` : "Toutes les versions"}</button>
  </div>`;
}

function openAdminGameVersionEditor(gameId) {
  if (!isVerifiedAdminSession()) throw new Error("L’accès propriétaire est requis.");
  const pack = snapshot.packs.find(pack => pack.id === gameId);
  if (!pack) throw new Error("Jeu introuvable.");
  const ownerUid = accountSession.uid;
  const minimum = visibilityTools.gameMinimumVersionFor(adminDashboard.siteSettings, gameId, pack.minAppVersion);
  openEditor({
    title: `Version minimale · ${pack.name}`,
    kicker: "ADMINISTRATION · VISIBILITÉ DU JEU",
    submitLabel: "Enregistrer la version minimale",
    variant: "admin-game-version",
    body: `<p class="admin-platform-help">Quand le jeu est visible par tous, il apparaît uniquement dans ShenPulse à partir de cette version, incluse.</p>
      <label class="field full">
        <span>Version minimale de ShenPulse</span>
        <input name="minAppVersion" type="text" maxlength="128" value="${escapeHtml(minimum)}" placeholder="Ex. 2.0.5" autocomplete="off" spellcheck="false" autofocus>
        <small>Laisse le champ vide pour autoriser toutes les versions. Version actuelle : ${escapeHtml(snapshot.appVersion || "inconnue")}.</small>
      </label>
      <p class="admin-platform-help">Le choix « Moi uniquement » permet de préparer et tester le jeu avant sa publication. « Masqué » continue de le masquer à tout le monde.</p>`,
    onSubmit: async data => {
      if (!isVerifiedAdminSession() || accountSession.uid !== ownerUid) throw new Error("La session propriétaire a changé. Rouvre le réglage de version.");
      await saveAdminGameVersion(gameId, data.get("minAppVersion"));
    }
  });
}

async function saveAdminGameVersion(gameId, value) {
  if (!isVerifiedAdminSession()) throw new Error("L’accès propriétaire est requis.");
  if (!snapshot.packs.some(pack => pack.id === gameId)) throw new Error("Jeu introuvable.");
  const raw = String(value ?? "").trim();
  const minimum = visibilityTools.normalizeAppVersion(raw);
  if (raw && !minimum) throw new Error("Version invalide. Utilise le format 2.0.5 ou laisse le champ vide.");
  const ownerUid = accountSession.uid;
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  const key = adminVisibilityStorageKey(gameId);
  const entry = { ...next.games[key] };
  if (minimum) entry.minAppVersion = minimum;
  else delete entry.minAppVersion;
  next.games[key] = entry;
  adminBusy = true;
  try {
    const saved = await api.admin.saveSiteSettings(next);
    if (!isVerifiedAdminSession() || accountSession.uid !== ownerUid) return;
    adminDashboard.siteSettings = saved;
    const published = await api.admin.visibility();
    if (isVerifiedAdminSession() && accountSession.uid === ownerUid) siteVisibility = published;
  } finally {
    adminBusy = false;
    render();
  }
}
