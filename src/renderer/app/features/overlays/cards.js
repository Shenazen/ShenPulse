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

function overlayQuickActions(item, allowed = true) {
  if (["timer", "multiplierTimer"].includes(item.key)) {
    const paused = Boolean(overlayConfig(item.key).timerPaused);
    const toggleLabel = paused ? "Reprendre le timer" : "Mettre le timer en pause";
    const toggleIcon = paused ? "&#9654;" : "&#10074;&#10074;";
    return `<div class="overlay-quick-actions overlay-quick-actions--timer" aria-label="Actions rapides">
      <span>Actions rapides</span>
      <div>
        <button type="button" class="button tiny ghost overlay-quick-icon" data-action="overlay-quick" data-id="${escapeHtml(item.key)}" data-operation="pause" data-amount="0" title="${toggleLabel}" aria-label="${toggleLabel}" ${allowed ? "" : "disabled"}><span aria-hidden="true">${toggleIcon}</span></button>
        <button type="button" class="button tiny ghost overlay-quick-icon" data-action="overlay-quick" data-id="${escapeHtml(item.key)}" data-operation="reset" data-amount="0" title="Réinitialiser le timer" aria-label="Réinitialiser le timer" ${allowed ? "" : "disabled"}><span aria-hidden="true">&#8635;</span></button>
      </div>
    </div>`;
  }
  const definitions = {
    likeGoal: [
      ["add", 1000, "＋1 000"],
      ["reset", 0, "Réinitialiser"]
    ],
    coinJar: [
      ["add", 10, "＋10"],
      ["remove", 10, "−10"],
      ["reset", 0, "Vider"]
    ],
    winCounter: [
      ["remove", 1, "−1"],
      ["add", 1, "＋1"],
      ["reset", 0, "Réinitialiser"]
    ],
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

function renderOverlayCard(item, { allowed = overlayUnlocked(item) } = {}) {
  const accountReady = isAccountAuthenticated();
  const url = accountReady && allowed ? overlayUrl(item) : "";
  const size = overlaySourceSize(item);
  const isMatchOverlay = item.previewKind === "match";
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
    <div class="overlay-preview">${overlayPreview(item)}</div>
    <div class="overlay-card-copy">
      <div class="overlay-card-title">
        <span>${item.icon}</span>
        <div><h3>${escapeHtml(item.name)}</h3><small>${escapeHtml(categoryLabel)}</small></div>
        <span class="badge ${allowed ? "success" : "warning"}">${allowed ? (item.requiresPro ? "PRO" : "LOCAL") : (item.requiresPro ? "PRO REQUIS" : "INDISPONIBLE")}</span>
      </div>
      <p>${escapeHtml(item.description)}</p>
      <div class="overlay-card-meta">
        <span class="overlay-source-size">
          <small>${isMatchOverlay ? "Source Lien protégée" : "Source OBS recommandée"}</small>
          <span class="overlay-source-dimensions">
            <span><small>Largeur</small><strong>${size.width} px</strong></span>
            <span><small>Hauteur</small><strong>${size.height} px</strong></span>
          </span>
        </span>
        <span><small>Configuration liée</small><strong>${escapeHtml(overlayProfileName())}</strong></span>
      </div>
      ${overlayDesignPicker(item, allowed && accountReady)}
      ${overlayQuickActions(item, allowed && accountReady)}
      ${accountReady
        ? ""
        : `<div class="overlay-guest-preview-actions">
            <button class="button small primary" type="button" data-action="preview-overlay" data-id="${escapeHtml(item.key)}">Voir l’animation</button>
            <span>Essai local et temporaire, sans enregistrer le design.</span>
          </div>`}
      ${allowed || !accountReady
        ? ""
        : `<div class="overlay-locked-actions"><span>L’aperçu et tous les réglages restent accessibles. Seule l’URL OBS est protégée.</span><div><button class="button small" data-action="configure-overlay" data-id="${escapeHtml(item.key)}">Configurer l’aperçu</button><button class="button small warning" data-navigate="membership">Voir les abonnements</button></div></div>`}
    </div>
    ${allowed && accountReady
      ? `<div class="overlay-card-footer">
          <div class="url-field"><code>${escapeHtml(url)}</code><button class="button small" data-action="copy" data-value="${escapeHtml(url)}">Copier</button></div>
          <div class="entity-actions">
            <button class="button small primary" data-action="preview-overlay" data-id="${escapeHtml(item.key)}">${isMatchOverlay ? "Lire dans la file" : "Tester en direct"}</button>
            <button class="button small" data-action="configure-overlay" data-id="${escapeHtml(item.key)}">Configurer</button>
            <button class="button small" data-action="open-url" data-value="${escapeHtml(url)}">Ouvrir</button>
            <button class="button small ghost" data-action="copy" data-value="${escapeHtml(localOverlayUrl(item))}">OBS local</button>
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
  const message = {
    source: "shenpulse-overlay-card",
    channel,
    payload
  };
  for (const frame of frames) {
    const send = () => {
      try {
        frame.contentWindow?.postMessage(message, new URL(frame.src).origin);
      } catch {
        // The preview may have left the DOM while navigating.
      }
    };
    send();
    if (!frame.dataset.overlayPreviewReady) {
      frame.addEventListener("load", send, { once: true });
    }
  }
  return true;
}

function postOverlayPreviewEvent(channel, payload) {
  const frames = content.querySelectorAll(
    '[data-overlay-runtime-preview="true"]'
  );
  for (const frame of frames) {
    if (!frame.contentWindow) continue;
    const message = {
      source: "shenpulse-overlay-card",
      channel,
      payload
    };
    const send = () => {
      try {
        frame.contentWindow?.postMessage(
          message,
          new URL(frame.src).origin
        );
      } catch {
        // A preview can disappear when the user changes page.
      }
    };
    send();
    if (!frame.dataset.overlayPreviewReady) {
      frame.addEventListener("load", send, { once: true });
    }
  }
}

function overlaySessionLifecycleSignature(value) {
  const runtime = value?.state?.overlaySession || {};
  return JSON.stringify(runtime);
}

function updateOverlayCardConfigUi(key, config) {
  const item = overlayDefinitions().find((entry) => entry.key === key);
  const card = overlayCardElement(key);
  if (!item || !card) return;

  const url = overlayUrl(item, config);
  const footer = card.querySelector(".overlay-card-footer");
  const code = footer?.querySelector(".url-field code");
  if (code) code.textContent = url;
  footer
    ?.querySelectorAll(
      '.url-field [data-action="copy"], [data-action="open-url"]'
    )
    .forEach((button) => {
      button.dataset.value = url;
    });

  if (["timer", "multiplierTimer"].includes(key)) {
    const toggle = card.querySelector(
      '.overlay-quick-actions--timer [data-operation="pause"]'
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
  const frame = overlayCardElement(item.key)?.querySelector(
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
