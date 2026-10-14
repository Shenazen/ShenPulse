"use strict";

/** Sanitized public Firebase presence; local detection is never a public-directory fallback. */
let creatorHomeLivePage = 0;
const CREATOR_HOME_LIVE_PAGE_SIZE = 3;
function creatorHomeLiveAvatarUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

function creatorHomeLocalLives(value = snapshot) {
  if (!isAccountAuthenticated()) return [];
  const state = value?.state || {};
  const settings = state.settings || {};
  const connections = state.connections || [];
  const rows = [];
  const activeConnection = (id, types) => connections.find((entry) =>
    entry.id === id && types.includes(entry.type) && entry.enabled === true &&
    entry.status === "connected" && (!entry.liveStatus || entry.liveStatus === "live")
  );
  const tiktok = settings.tiktok || {};
  const tiktokConnection = activeConnection("source_tiktok", ["tiktok-direct", "tiktok-relay"]);
  if (tiktok.status === "live" && tiktokConnection) {
    const username = String(tiktokConnection.config?.username || tiktok.username || "").replace(/^@+/, "").slice(0, 80);
    const broadcaster = username && String(tiktok.broadcaster?.username || "").replace(/^@+/, "").toLowerCase() === username.toLowerCase()
      ? tiktok.broadcaster || {} : {};
    const viewers = tiktok.currentViewers;
    rows.push({
      id: "source_tiktok", platform: "TikTok", accent: "pink",
      username: String(broadcaster.username || username).replace(/^@+/, "").slice(0, 80),
      avatarUrl: creatorHomeLiveAvatarUrl(broadcaster.avatarUrl),
      // A measured zero is meaningful. Unknown counts never come from session participants or comments.
      viewers: Number.isInteger(viewers) && viewers >= 0 ? viewers : null
    });
  }
  const kick = settings.kick || {};
  const kickConnection = activeConnection("source_kick", ["kick-native"]);
  if (kick.live === true && kickConnection) {
    const viewers = Number(kick.viewers);
    rows.push({
      id: "source_kick", platform: "Kick", accent: "green",
      username: String(kick.account?.name || "").replace(/^@+/, "").slice(0, 160),
      avatarUrl: creatorHomeLiveAvatarUrl(kick.account?.avatarUrl),
      // Kick's API adapter uses zero when viewer_count is absent. Never present that fallback as a measurement.
      viewers: Number.isFinite(viewers) && viewers > 0 ? Math.floor(viewers) : null
    });
  }
  // Chat connection, a manual session or an online relay does not prove an actual broadcast.
  return rows;
}

function creatorHomeLiveModel() {
  const directory = snapshot?.liveDirectory || {};
  const authenticated = isAccountAuthenticated();
  const rows = (Array.isArray(directory.rows) ? directory.rows : []).slice(0, 100).filter((row) =>
    row && typeof row.id === "string" && ["TikTok", "Kick"].includes(row.platform) &&
    typeof row.username === "string" && row.username.length > 0 && row.username.length <= 160
  ).map((row) => ({
    id: row.id.slice(0, 200), platform: row.platform, username: row.username,
    accent: row.platform === "Kick" ? "green" : "pink",
    avatarUrl: creatorHomeLiveAvatarUrl(row.avatarUrl),
    viewers: Number.isInteger(row.viewers) && row.viewers >= 0 ? row.viewers : null,
    own: authenticated && row.own === true
  }));
  creatorHomeLivePage = Math.max(0, Math.min(creatorHomeLivePage, Math.ceil(rows.length / CREATOR_HOME_LIVE_PAGE_SIZE) - 1));
  return {
    authenticated, rows, available: directory.available === true, connected: directory.connected === true,
    capped: directory.capped === true || (Array.isArray(directory.rows) && directory.rows.length > 100), page: creatorHomeLivePage,
    dashboard: authenticated && canNavigateTo("dashboard"),
    locale: typeof studioLocale === "function" ? studioLocale() : snapshot?.state?.settings?.locale || "fr-FR"
  };
}

function creatorHomeLiveIdentitySignature(model) {
  return JSON.stringify({ ...model, rows: model.rows.map(({ viewers, ...identity }) => identity) });
}

function creatorHomeLiveViewersMarkup(viewers, locale) {
  return `<span class="home-live-viewers" title="${viewers === null ? "Nombre de spectateurs indisponible" : "spectateurs actuellement"}" data-home-viewers-known="${viewers !== null}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg><strong data-studio-user-content>${viewers === null ? "—" : escapeHtml(new Intl.NumberFormat(locale).format(viewers))}</strong></span>`;
}

function creatorHomeLiveCard(row, model) {
  const initials = String(row.username || row.platform).slice(0, 2).toUpperCase();
  const publicUrl = creatorHomeLiveProfileUrl(row);
  return `<article class="home-live-card accent-${row.accent}" data-home-live-source="${escapeHtml(row.id)}">
    <header class="home-live-card-header"><span class="home-live-badge"><span aria-hidden="true"></span>LIVE</span>${creatorHomeLiveViewersMarkup(row.viewers, model.locale)}</header>
    <div class="home-live-card-copy"><span class="home-live-avatar" data-studio-user-content><span class="home-live-avatar-picture"><span>${escapeHtml(initials)}</span>${row.avatarUrl ? `<img src="${escapeHtml(row.avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}</span><span class="home-live-avatar-dot" aria-hidden="true"></span></span><div class="home-live-card-identity"><strong${row.username ? " data-studio-user-content" : ""}>${row.username ? `@${escapeHtml(row.username)}` : "Votre live"}</strong><span class="home-live-platform-label">${row.platform === "TikTok" ? "En direct sur TikTok" : "En direct sur Kick"}</span></div></div>
    ${row.own && model.dashboard ? '<button type="button" class="home-live-card-open" data-navigate="dashboard" aria-label="Ouvrir mon live"></button>' : publicUrl ? `<button type="button" class="home-live-card-open" data-home-live-profile="${escapeHtml(publicUrl)}" aria-label="Voir ce live"></button>` : ""}
  </article>`;
}

function creatorHomeLiveProfileUrl(row) {
  const username = String(row.username || "");
  if (row.platform === "TikTok" && /^[a-zA-Z0-9._]{1,30}$/.test(username)) return `https://www.tiktok.com/@${username}/live`;
  if (row.platform === "Kick" && /^[a-zA-Z0-9_-]{1,160}$/.test(username)) return `https://kick.com/${username}`;
  return "";
}

function creatorHomeLiveCount(model) {
  return !model.connected && !model.rows.length ? "—" : `${model.rows.length}${model.capped ? "+" : ""}`;
}

function creatorHomeLiveBody(model) {
  const pages = Math.ceil(model.rows.length / CREATOR_HOME_LIVE_PAGE_SIZE);
  const visibleRows = model.rows.slice(model.page * CREATOR_HOME_LIVE_PAGE_SIZE, (model.page + 1) * CREATOR_HOME_LIVE_PAGE_SIZE);
  const status = !model.available ? "Annuaire indisponible" : !model.connected ? "Reconnexion à l’annuaire…" : "";
  return `<header class="home-live-heading"><h3 id="home-live-heading"><span class="home-live-heading-dot" aria-hidden="true"></span>En direct avec ShenPulse</h3><span class="home-live-count" role="status"><strong data-studio-user-content>${creatorHomeLiveCount(model)}</strong><span>en direct</span></span>${status ? `<span class="home-live-scope" role="status">${status}</span>` : ""}${pages > 1 ? `<nav class="home-live-pagination" aria-label="Parcourir les créateurs en direct"><button type="button" data-home-live-page="previous" aria-label="Créateurs précédents" ${model.page === 0 ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"></path></svg></button><span data-studio-user-content>${model.page + 1}/${pages}</span><button type="button" data-home-live-page="next" aria-label="Créateurs suivants" ${model.page >= pages - 1 ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"></path></svg></button></nav>` : ""}</header>
    ${visibleRows.length ? `<div class="home-live-grid">${visibleRows.map((row) => creatorHomeLiveCard(row, model)).join("")}</div>`
      : `<div class="home-live-empty"><span class="home-live-empty-icon" aria-hidden="true">◉</span><div><strong>${model.connected ? "Aucun créateur en direct pour le moment." : status || "Connexion à l’annuaire…"}</strong><p>${model.connected ? "Retrouvez ici les créateurs qui ont choisi de partager leur LIVE ShenPulse." : "Les présences sont actualisées automatiquement dès que la connexion est disponible."}</p></div></div>`}`;
}

function renderCreatorHomeLive() {
  const model = creatorHomeLiveModel();
  return `<section class="creator-home-live" data-home-live data-home-live-signature="${escapeHtml(JSON.stringify(model))}" data-home-live-identity-signature="${escapeHtml(creatorHomeLiveIdentitySignature(model))}" aria-labelledby="home-live-heading">${creatorHomeLiveBody(model)}</section>`;
}

function bindCreatorHomeLiveAvatars(section) {
  if (!section.dataset.homeLiveBound) {
    section.dataset.homeLiveBound = "true";
    section.addEventListener("click", (event) => {
      const pageButton = event.target.closest("[data-home-live-page]");
      if (pageButton && !pageButton.disabled) {
        creatorHomeLivePage += pageButton.dataset.homeLivePage === "next" ? 1 : -1;
        const focusedPage = pageButton.dataset.homeLivePage;
        syncCreatorHomeLive();
        section.querySelector(`[data-home-live-page="${focusedPage}"]`)?.focus({ preventScroll: true });
        return;
      }
      const profileButton = event.target.closest("[data-home-live-profile]");
      if (!profileButton) return;
      // Derive the URL again from the current feed, never trust a modified DOM attribute.
      const card = profileButton.closest("[data-home-live-source]");
      const row = creatorHomeLiveModel().rows.find((entry) => entry.id === card?.dataset.homeLiveSource);
      const url = row && creatorHomeLiveProfileUrl(row);
      if (url) void Promise.resolve(api.openExternal(url)).catch((error) => {
        if (typeof toast === "function") toast("Ouverture du live impossible", error.message || String(error), true);
      });
    });
  }
  section.querySelectorAll(".home-live-avatar img").forEach((image) => {
    if (image.dataset.homeAvatarBound) return;
    image.dataset.homeAvatarBound = "true";
    image.addEventListener("error", () => image.remove(), { once: true });
  });
}

function syncCreatorHomeLiveViewers(section, model) {
  const cards = [...section.querySelectorAll("[data-home-live-source]")];
  for (const row of model.rows) {
    const card = cards.find((entry) => entry.dataset.homeLiveSource === row.id);
    if (!card) continue;
    const current = card.querySelector(".home-live-viewers");
    if (current) {
      const label = row.viewers === null ? "—" : new Intl.NumberFormat(model.locale).format(row.viewers);
      const number = current.querySelector("strong");
      if (number.textContent !== label) number.textContent = label;
      const known = String(row.viewers !== null);
      if (current.dataset.homeViewersKnown !== known) {
        current.dataset.homeViewersKnown = known;
        current.title = row.viewers === null ? "Nombre de spectateurs indisponible" : "spectateurs actuellement";
        if (typeof applyStudioLanguage === "function") applyStudioLanguage(card.querySelector(".home-live-card-header"));
      }
    } else {
      card.querySelector(".home-live-card-header").insertAdjacentHTML("beforeend", creatorHomeLiveViewersMarkup(row.viewers, model.locale));
      if (typeof applyStudioLanguage === "function") applyStudioLanguage(card.querySelector(".home-live-card-header"));
    }
  }
  const count = section.querySelector(".home-live-count > strong");
  if (count.textContent !== creatorHomeLiveCount(model)) count.textContent = creatorHomeLiveCount(model);
}

function syncCreatorHomeLive() {
  const section = content.querySelector("[data-home-live]");
  if (!section) return false;
  const model = creatorHomeLiveModel();
  const signature = JSON.stringify(model);
  bindCreatorHomeLiveAvatars(section);
  if (section.dataset.homeLiveSignature === signature) return true;
  const identitySignature = creatorHomeLiveIdentitySignature(model);
  if (section.dataset.homeLiveIdentitySignature === identitySignature) {
    syncCreatorHomeLiveViewers(section, model);
    section.dataset.homeLiveSignature = signature;
    return true;
  }
  const focused = section.contains(document.activeElement)
    ? document.activeElement.closest("[data-home-live-source]")?.dataset.homeLiveSource : "";
  section.innerHTML = creatorHomeLiveBody(model);
  section.dataset.homeLiveSignature = signature;
  section.dataset.homeLiveIdentitySignature = identitySignature;
  bindCreatorHomeLiveAvatars(section);
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(section);
  if (focused) {
    const card = [...section.querySelectorAll("[data-home-live-source]")].find((element) => element.dataset.homeLiveSource === focused);
    card?.querySelector("button")?.focus({ preventScroll: true });
  }
  return true;
}
