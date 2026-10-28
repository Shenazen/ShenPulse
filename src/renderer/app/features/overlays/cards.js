"use strict";

/**
 * Cartes d'overlays et synchronisation des aperçus.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function overlayPreview(item, config = null) {
  const effectiveConfig = config || overlayConfig(item.key);
  return overlayRuntimeFrame(item, effectiveConfig, {
    context: "card",
    placeholder: overlayCardPlaceholder(item, effectiveConfig)
  });
}

function overlayDesignPicker(item, allowed = overlayUnlocked(item)) {
  if (!item.options?.length) return "";
  const selection = selectedOverlayDesign(item);
  return `<label class="overlay-design-picker">
    <span>Design · ${item.options.length} disponible${item.options.length > 1 ? "s" : ""}${allowed ? "" : " · aperçu"}</span>
    <select data-overlay-design="${escapeHtml(item.key)}" data-overlay-preview-only="${allowed ? "false" : "true"}">
      ${item.options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${selection === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
    </select>
  </label>`;
}

function overlaySourceSize(item) {
  const [width, height] = item.sourceSize || [1920, 1080];
  return {
    width,
    height,
    label: `Largeur ${width} px · Hauteur ${height} px`
  };
}

function overlayProfileName() {
  const profileId = snapshot.state.session.profileId;
  return snapshot.state.profiles?.find((profile) => profile.id === profileId)?.name
    || "Profil actif";
}

function overlayTimerPauseButton(item) {
  const paused = Boolean(overlayConfig(item.key).timerPaused);
  const label = paused ? "Reprendre le timer" : "Mettre le timer en pause";
  return `<button type="button" class="button small ghost overlay-quick-icon" data-action="overlay-quick" data-id="${escapeHtml(item.key)}" data-operation="pause" data-amount="0" title="${label}" aria-label="${label}"><span aria-hidden="true">${paused ? "&#9654;" : "&#10074;&#10074;"}</span></button>`;
}

function overlayQuickActions(item, allowed = true) {
  if (["timer", "multiplierTimer", "winCounter", "wheel", "coinJar"].includes(item.key)) return "";
  const definitions = {
    wheel: [["test", 0, "Lancer"]]
  };
  const actions = definitions[item.key] || [];
  if (!actions.length) return "";
  return `<div class="overlay-quick-actions" aria-label="Actions rapides">
    <span>Actions rapides</span>
    <div>${actions.map(([operation, amount, label]) =>
      `<button type="button" class="button tiny ghost" data-action="overlay-quick" data-id="${escapeHtml(item.key)}" data-operation="${operation}" data-amount="${amount}" ${allowed ? "" : "disabled"}>${escapeHtml(label)}</button>`
    ).join("")}</div>
  </div>`;
}

function overlayWinCounterButtons() {
  return [["remove", "Retirer une win", "−1"], ["add", "Ajouter une win", "+1"]].map(([operation, label, text]) =>
    `<button type="button" class="button small ghost overlay-quick-icon" data-action="overlay-quick" data-id="winCounter" data-operation="${operation}" data-amount="1" title="${label}" aria-label="${label}">${text}</button>`
  ).join("");
}

/**
 * Encadre une catégorie du catalogue sans dupliquer ses ornements sur les
 * cartes. Les images sont purement décoratives : le titre reste du texte HTML
 * sélectionnable, traduisible et annoncé avec le nombre d'overlays.
 */
function renderOverlayCategorySection(section) {
  if (!section.items?.length) return "";
  const title = section.id === "counters" ? "Objectifs & compteurs" : section.label;
  return `<section class="overlay-category-section" data-overlay-category="${escapeHtml(section.id)}">
    <header class="overlay-category-heading">
      <img class="overlay-category-frame" src="assets/studio/overlay-section-frame.webp" alt="" aria-hidden="true" width="1600" height="307" decoding="async">
      <h3>${escapeHtml(title)}<span class="overlay-category-count"> · ${section.items.length} overlay${section.items.length > 1 ? "s" : ""}</span></h3>
    </header>
    <div class="overlay-catalog-grid">${section.items.map((item) => renderOverlayCard(item)).join("")}</div>
    <img class="overlay-category-divider" src="assets/studio/overlay-section-divider.webp" alt="" aria-hidden="true" width="1600" height="228" loading="lazy" decoding="async">
  </section>`;
}

function renderOverlayCard(item, { allowed = overlayUnlocked(item), presentation = null } = {}) {
  const accountReady = isAccountAuthenticated();
  const url = accountReady && allowed ? presentation?.url || overlayUrl(item) : "";
  const size = overlaySourceSize(presentation?.sourceSize ? { ...item, sourceSize: presentation.sourceSize } : item);
  const isMatchOverlay = item.previewKind === "match";
  // Le générateur commun applique les droits et vérifie l'URL HTTPS Match.
  // Aucune carte ne prépare ni ne copie un fichier vidéo déchiffré.
  const matchStudioUrl = isMatchOverlay && typeof creatorMatchesStudioSourceUrl === "function"
    ? creatorMatchesStudioSourceUrl() : "";
  const categoryLabel = {
    counters: "Compteurs",
    rankings: "Classements",
    interactions: "Interactions",
    actions: "Actions",
    events: "Événements",
    points: "Points",
    likes: "Likes",
    gifts: "Cadeaux",
    games: "Jeux",
    music: "Musique",
    seasonal: "Saisonnier",
    tools: "Outils",
    matches: "Matchs"
  }[item.category] || item.category;
  const previewVariant = String(item.previewKind || "generic")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  return `<article class="overlay-catalog-card overlay-catalog-card--${escapeHtml(previewVariant)} ${allowed ? "" : "locked"}" data-overlay-card="${escapeHtml(item.key)}">
    <div class="overlay-preview">${presentation?.preview || overlayPreview(item)}</div>
    <div class="overlay-card-copy">
      <div class="overlay-card-title">
        <span>${item.icon}</span>
        <div><h3>${escapeHtml(item.name)}</h3><small>${escapeHtml(categoryLabel)}</small></div>
        <span class="badge ${allowed ? "success" : "warning"}">${allowed ? (item.requiresPro ? "PRO" : "LOCAL") : (item.requiresPro ? "PRO REQUIS" : "INDISPONIBLE")}</span>
      </div>
      <p>${escapeHtml(item.description)}</p>
      <div class="overlay-card-meta">
        <span class="overlay-source-size">
          <small>${isMatchOverlay ? "Source Match protégée" : "Source OBS recommandée"}</small>
          <span class="overlay-source-dimensions">
            <span><small>Largeur</small><strong>${size.width} px</strong></span>
            <span><small>Hauteur</small><strong>${size.height} px</strong></span>
          </span>
        </span>
        <span><small>Configuration liée</small><strong>${escapeHtml(overlayProfileName())}</strong></span>
      </div>
      ${presentation?.controls || ""}
      ${presentation?.showDesign === false ? "" : overlayDesignPicker(item, allowed && accountReady)}
      ${overlayQuickActions(item, allowed && accountReady)}
      ${accountReady
        ? ""
        : `<div class="overlay-guest-preview-actions">
            <button class="button small primary" type="button" data-action="preview-overlay" data-id="${escapeHtml(item.key)}">Voir l’animation</button>
            <span>Essai local et temporaire, sans enregistrer le design.</span>
          </div>`}
      ${allowed || !accountReady
        ? ""
        : `<div class="overlay-locked-actions"><span>L’aperçu et les réglages restent accessibles. La source protégée et l’automatisation nécessitent Pro ou Premium.</span><div><button class="button small" data-action="configure-overlay" data-id="${escapeHtml(item.key)}">Configurer l’aperçu</button><button class="button small warning" data-navigate="membership">Voir les abonnements</button></div></div>`}
    </div>
    ${allowed && accountReady
      ? `<div class="overlay-card-footer">
          ${isMatchOverlay
            ? `<div class="url-field"><code>${escapeHtml(matchStudioUrl || "Source HTTPS indisponible")}</code><button class="button small" data-action="copy" data-value="${escapeHtml(matchStudioUrl)}" ${matchStudioUrl ? "" : "disabled"}>Copier pour TikTok Studio</button></div>`
            : `<div class="url-field"><code>${escapeHtml(url)}</code><button class="button small" data-action="copy" data-value="${escapeHtml(url)}">Copier</button></div>`}
          <div class="entity-actions">
            <button class="button small primary" data-action="${escapeHtml(presentation?.previewAction || "preview-overlay")}" data-id="${escapeHtml(item.key)}">${escapeHtml(presentation?.previewLabel || (isMatchOverlay ? "Relancer à 0" : "Tester en direct"))}</button>
            ${presentation?.hideConfigure ? "" : `<button class="button small" data-action="configure-overlay" data-id="${escapeHtml(item.key)}">Configurer</button>`}
            ${presentation?.hideQuickActions ? "" : ["likeGoal", "timer", "multiplierTimer", "winCounter", "coinJar"].includes(item.key)
              ? `${["timer", "multiplierTimer"].includes(item.key) ? overlayTimerPauseButton(item) : ""}${item.key === "winCounter" ? overlayWinCounterButtons() : ""}<button type="button" class="button small ghost" data-action="overlay-quick" data-id="${escapeHtml(item.key)}" data-operation="reset" data-amount="0">Réinitialiser</button>`
              : ["topDonors", "topTappers", "wheel"].includes(item.key) ? "" : `<button class="button small" data-action="open-url" data-value="${escapeHtml(isMatchOverlay ? matchStudioUrl : url)}" ${isMatchOverlay && !matchStudioUrl ? "disabled" : ""}>Ouvrir</button>
                 ${isMatchOverlay ? "" : `<button class="button small ghost" data-action="copy" data-value="${escapeHtml(localOverlayUrl(item))}">OBS local</button>`}`}
          </div>
        </div>`
      : ""}
  </article>`;
}

function overlayCardElement(key) {
  return [...content.querySelectorAll("[data-overlay-card]")].find(
    (card) => card.dataset.overlayCard === key
  ) || null;
}

function publicOverlayRelayPresentation(relay = snapshot?.publicOverlayRelay || {}) {
  if (relay.connected) {
    return [
      "success",
      "CONNECTÉ",
      "Les URL HTTPS reçoivent les événements en temps réel."
    ];
  }
  if (relay.status === "connecting") {
    return [
      "cyan",
      "CONNEXION",
      "Initialisation sécurisée du relais cloud…"
    ];
  }
  return [
    "warning",
    "HORS LIGNE",
    "Les URL restent stables et se reconnecteront automatiquement."
  ];
}

function syncPublicOverlayRelayStatus(relay = snapshot?.publicOverlayRelay || {}) {
  const card = content.querySelector("[data-public-overlay-relay]");
  if (!card) return;
  const [tone, label, detail] = publicOverlayRelayPresentation(relay);
  const description = card.querySelector("[data-public-overlay-relay-detail]");
  const badge = card.querySelector("[data-public-overlay-relay-badge]");
  if (description) {
    description.textContent = detail;
  }
  if (badge) {
    badge.className = `badge ${tone}`;
    badge.textContent = label;
  }
}

function sendOverlayPreviewFrameEvent(frame, channel, payload) {
  if (!frame?.contentWindow) return false;
  try {
    frame.contentWindow.postMessage(
      {
        source: "shenpulse-overlay-card",
        channel,
        payload
      },
      new URL(frame.src).origin
    );
    return true;
  } catch {
    // L'aperçu peut être remplacé pendant une navigation ou un changement de page.
    return false;
  }
}

function hydrateOverlayPreviewFrame(frame) {
  const key =
    frame?.dataset.overlayPreviewKey ||
    frame?.closest("[data-overlay-card]")?.dataset.overlayCard ||
    frame?.closest("[data-overlay-config-editor]")?.dataset.overlayConfigEditor ||
    "";
  if (!key) return false;
  return sendOverlayPreviewFrameEvent(
    frame,
    "session-state",
    snapshot?.state?.overlaySession || {}
  );
}

function postOverlayCardEvent(key, channel, payload) {
  const frames = [
    overlayCardElement(key)?.querySelector(
      '[data-overlay-runtime-preview="true"]'
    ),
    dialogBody.querySelector(
      `[data-overlay-config-editor="${CSS.escape(key)}"] [data-overlay-live-preview]`
    )
  ].filter(
    (frame, index, entries) =>
      frame?.contentWindow && entries.indexOf(frame) === index
  );
  if (!frames.length) return false;
  for (const frame of frames) {
    const send = () => sendOverlayPreviewFrameEvent(frame, channel, payload);
    send();
    if (!frame.dataset.overlayPreviewReady) {
      frame.addEventListener("load", send, { once: true });
    }
  }
  return true;
}

function postOverlayPreviewEvent(channel, payload) {
  if (!overlayPreviewsVisible()) return;
  const frames = [
    ...content.querySelectorAll('[data-overlay-runtime-preview="true"]'),
    ...(dialog.open ? dialogBody.querySelectorAll("[data-overlay-live-preview]") : [])
  ];
  for (const frame of frames) {
    if (!frame.contentWindow || frame.src === "about:blank") continue;
    const send = () => sendOverlayPreviewFrameEvent(frame, channel, payload);
    send();
    if (!frame.dataset.overlayPreviewReady) {
      frame.addEventListener("load", send, { once: true });
    }
  }
}

function hasOverlayRuntimePreview() {
  return Boolean(content.querySelector('[data-overlay-runtime-preview="true"]:not([src="about:blank"]), [data-scene-preview]') ||
    (dialog.open && dialogBody.querySelector('[data-overlay-live-preview]:not([src="about:blank"])')));
}

function overlayPreviewValuesEqual(before, after, depth = 4) {
  if (before === after) return true;
  if (!before || !after || typeof before !== "object" || typeof after !== "object" || depth === 0) return false;
  const keys = Object.keys(before);
  if (keys.length !== Object.keys(after).length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(after, key) &&
    overlayPreviewValuesEqual(before[key], after[key], depth - 1));
}

function overlayPreviewSessionChanged(previous, next) {
  // Bounded plain runtime data (40 events / 100 leaderboard rows), compared only for an active preview.
  // Avoid allocating two full JSON strings on every TikTok/viewer metadata patch.
  return !overlayPreviewValuesEqual(previous?.state?.overlaySession, next?.state?.overlaySession);
}

function updateOverlayCardConfigUi(key, config) {
  const item = overlayDefinitions().find((entry) => entry.key === key);
  const card = overlayCardElement(key);
  if (!item || !card) return;

  const isMatchOverlay = item.previewKind === "match";
  const url = isMatchOverlay
    ? (typeof creatorMatchesStudioSourceUrl === "function" ? creatorMatchesStudioSourceUrl() : "")
    : overlayUrl(item, config);
  const footer = card.querySelector(".overlay-card-footer");
  const code = footer?.querySelector(".url-field code");
  if (code) code.textContent = url || (isMatchOverlay ? "Source HTTPS indisponible" : "");
  footer
    ?.querySelectorAll(
      '.url-field [data-action="copy"], [data-action="open-url"]'
    )
    .forEach((button) => {
      button.dataset.value = url;
      if (isMatchOverlay) button.disabled = !url;
    });

  if (["timer", "multiplierTimer"].includes(key)) {
    const toggle = card.querySelector(
      '[data-action="overlay-quick"][data-operation="pause"]'
    );
    const paused = Boolean(config.timerPaused);
    const label = paused ? "Reprendre le timer" : "Mettre le timer en pause";
    if (toggle) {
      toggle.title = label;
      toggle.setAttribute("aria-label", label);
      const icon = toggle.querySelector('[aria-hidden="true"]');
      if (icon) icon.textContent = paused ? "▶" : "❚❚";
    }
  }
}

function previewOverlayDesignSelection(item, value) {
  overlayDesignSelections[item.key] = value;
  const card = overlayCardElement(item.key);
  const frame = card?.querySelector(
    '[data-overlay-runtime-preview="true"]'
  );
  if (!frame) return;
  const send = () => {
    postOverlayCardEvent(item.key, "design", {
      parameter: item.parameter || "theme",
      value
    });
  };
  send();
  if (!frame.dataset.overlayPreviewReady) {
    frame.addEventListener("load", send, { once: true });
  }
}

function overlayConfigurationPayload(item, config) {
  try {
    const payload = Object.fromEntries(
      new URL(
        overlayUrl(item, config, {
          includePublicConfiguration: true
        })
      ).searchParams.entries()
    );
    for (const key of [
      "view",
      "token",
      "channel",
      "preview",
      "screen",
      "kind",
      "match"
    ]) {
      delete payload[key];
    }
    return payload;
  } catch {
    return {};
  }
}

async function publishOverlayConfiguration(key, config) {
  const item = overlayDefinitions().find((entry) => entry.key === key);
  if (!item || typeof api.publishOverlayConfiguration !== "function") return;
  await api.publishOverlayConfiguration(
    key,
    overlayConfigurationPayload(item, config)
  );
}

async function saveOverlayConfig(
  key,
  nextConfig,
  { rerender = true, updateCard = false } = {}
) {
  const scrollTop = content.scrollTop;
  if (updateCard) {
    locallyHandledOverlayConfigs.set(key, JSON.stringify(nextConfig || {}));
  }
  try {
    acceptSnapshot(await api.saveSettings({
      ...snapshot.state.settings,
      overlayConfigs: {
        ...(snapshot.state.settings.overlayConfigs || {}),
        [key]: nextConfig
      }
    }));
    await publishOverlayConfiguration(key, nextConfig);
    if (typeof refreshScenePreview === "function") refreshScenePreview();
  } catch (error) {
    if (updateCard) locallyHandledOverlayConfigs.delete(key);
    throw error;
  }
  if (updateCard) {
    updateOverlayCardConfigUi(key, nextConfig);
    setTimeout(() => {
      if (
        locallyHandledOverlayConfigs.get(key) ===
        JSON.stringify(nextConfig || {})
      ) {
        locallyHandledOverlayConfigs.delete(key);
      }
    }, 1500);
  }
  if (rerender) {
    render();
    content.scrollTop = scrollTop;
  }
  return nextConfig;
}

async function persistOverlayDesignSelection(item, value) {
  const config = overlayConfig(item.key);
  let next = { ...config };
  if (item.key === "wheel") {
    const normalized = normalizeWheelConfig(config);
    const wheels = normalized.wheels.map((wheel) =>
      wheel.id === normalized.selectedWheelId
        ? { ...wheel, design: value === "royal" ? "royal" : "classic" }
        : wheel
    );
    next = { ...normalized, design: value, wheels };
  } else {
    const property = item.parameter === "model"
      ? "model"
      : item.parameter === "variant"
        ? "variant"
        : "theme";
    next[property] = value;
  }
  previewOverlayDesignSelection(item, value);
  if (!overlayUnlocked(item)) return next;
  await saveOverlayConfig(item.key, next, {
    rerender: false,
    updateCard: true
  });
  return next;
}
