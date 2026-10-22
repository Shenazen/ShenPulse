"use strict";

/** Choix des logos, publié avec les réglages de visibilité du catalogue. */
function renderAdminGamePlatforms(gameId, settings) {
  const pack = snapshot.packs.find(pack => pack.id === gameId);
  return `<div class="admin-game-platforms">
    <div class="admin-game-platform-preview">${gamePlatformLogos(pack, settings) || "<small>Aucun logo</small>"}</div>
    <button type="button" class="button small ghost" data-action="admin-game-platforms" data-id="${escapeHtml(gameId)}" ${adminBusy ? "disabled" : ""}>Choisir les logos</button>
  </div>`;
}

function openAdminGamePlatformsEditor(gameId) {
  if (!isVerifiedAdminSession()) throw new Error("L’accès propriétaire est requis.");
  const pack = snapshot.packs.find(pack => pack.id === gameId);
  if (!pack) throw new Error("Jeu introuvable.");
  const ownerUid = accountSession.uid;
  const selected = gamePlatformIds(pack, adminDashboard.siteSettings);
  openEditor({
    title: `Logos · ${pack.name}`,
    kicker: "ADMINISTRATION · JAQUETTE DU JEU",
    submitLabel: "Enregistrer les logos",
    variant: "admin-game-platforms",
    body: `<p class="admin-platform-help">Coche les logos à afficher sur la jaquette. Tu peux en choisir plusieurs ou tout décocher pour n’en afficher aucun.</p>
      <fieldset class="admin-game-platform-options"><legend>Logos affichés</legend>
        ${visibilityTools.GAME_PLATFORM_IDS.map(id => `<label class="admin-game-platform-option">
          <input type="checkbox" name="platforms" value="${escapeHtml(id)}" ${selected.includes(id) ? "checked" : ""}>
          <span class="admin-platform-icon platform-${escapeHtml(id)}" aria-hidden="true">${gamePlatformIcon(id)}</span>
          <span>${escapeHtml(GAME_PLATFORM_LABELS[id])}</span>
        </label>`).join("")}
      </fieldset>`,
    onSubmit: async data => {
      if (!isVerifiedAdminSession() || accountSession.uid !== ownerUid) throw new Error("La session propriétaire a changé. Rouvre le sélecteur de logos.");
      await saveAdminGamePlatforms(gameId, data.getAll("platforms"));
    }
  });
}

async function saveAdminGamePlatforms(gameId, platforms) {
  if (!isVerifiedAdminSession()) throw new Error("L’accès propriétaire est requis.");
  if (!snapshot.packs.some(pack => pack.id === gameId)) throw new Error("Jeu introuvable.");
  const ownerUid = accountSession.uid;
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  const key = adminVisibilityStorageKey(gameId);
  next.games[key] = { ...next.games[key], ...visibilityTools.gamePlatformConfig({ platforms }) };
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
