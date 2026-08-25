function soundPickerField(
  name,
  selectedUrl = "",
  {
    label = "Son à jouer",
    selectedName = "",
    optional = false
  } = {}
) {
  const selected =
    soundLibraryEntry(selectedUrl) ||
    mediaSessionEntries.get(selectedUrl) ||
    (selectedUrl
      ? {
          id: selectedUrl,
          name: selectedName || mediaNameFromUrl(selectedUrl),
          detail: "Son externe",
          category: "audio",
          url: selectedUrl
        }
      : null) ||
    {
      id: "",
      name: optional ? "Aucun son sélectionné" : "Choisir un son",
      detail: optional
        ? "Cette action sera affichée sans accompagnement audio."
        : "Ouvrez la bibliothèque globale.",
      url: ""
    };
  const value = selectedUrl || selected.url;
  return `<div class="field full compact-media-picker" data-media-picker-root data-picker-kind="sound" data-picker-optional="${optional ? "true" : "false"}">
    <span>${escapeHtml(label)}</span>
    <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-media-value>
    <input type="hidden" name="${escapeHtml(`${name}Name`)}" value="${escapeHtml(selected.name)}" data-media-name>
    <div class="compact-media-selection" data-media-selection>
      ${soundSelectionMarkup(selected)}
      <div class="compact-media-actions">
        ${value ? `<button type="button" class="sound-preview-button" data-media-preview-url="${escapeHtml(value)}" title="Écouter">▶</button>` : ""}
        ${optional && value ? '<button type="button" class="button ghost small" data-clear-media>Retirer</button>' : ""}
        <button type="button" class="button small" data-open-media-library data-kind="sound" data-input="${escapeHtml(name)}" data-optional="${optional ? "true" : "false"}">Ouvrir la bibliothèque</button>
      </div>
    </div>
    <small>Catalogue web MyInstants, aperçu immédiat et import personnel Backblaze.</small>
  </div>`;
}

function normalizeCatalogSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mediaPickerField(
  name,
  label,
  selectedUrl = "",
  selectedName = "",
  { optional = true } = {}
) {
  const selected =
    mediaLibraryEntry(selectedUrl) ||
    mediaSessionEntries.get(selectedUrl) ||
    (selectedUrl
      ? {
          id: selectedUrl,
          name: selectedName || mediaNameFromUrl(selectedUrl),
          detail: "Média externe",
          kind: mediaKindFromUrl(selectedUrl),
          source: "external",
          url: selectedUrl
        }
      : null);
  return `<div class="field full compact-media-picker" data-media-picker-root data-picker-kind="visual" data-picker-optional="${optional ? "true" : "false"}">
    <span>${escapeHtml(label)}</span>
    <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(selectedUrl)}" data-media-value>
    <input type="hidden" name="${escapeHtml(`${name}Name`)}" value="${escapeHtml(selected?.name || "")}" data-media-name>
    <div class="compact-media-selection" data-media-selection>
      ${visualSelectionMarkup(selected)}
      <div class="compact-media-actions">
        ${optional && selectedUrl ? '<button type="button" class="button ghost small" data-clear-media>Retirer</button>' : ""}
        <button type="button" class="button small" data-open-media-library data-kind="visual" data-input="${escapeHtml(name)}" data-optional="${optional ? "true" : "false"}">Ouvrir la bibliothèque média</button>
      </div>
    </div>
    <small>Catalogue web d’images, GIF, vidéos et animations, ou import personnel Backblaze.</small>
  </div>`;
}

function soundSelectionMarkup(item) {
  return `<span class="compact-media-icon">♫</span>
    <span class="compact-media-copy"><strong>${escapeHtml(item?.name || "Aucun son sélectionné")}</strong><small>${escapeHtml(item?.detail || "")}</small></span>
    <span class="badge cyan">${escapeHtml(item?.category || "audio")}</span>`;
}

function visualSelectionMarkup(item) {
  if (!item?.url) {
    return `<span class="compact-media-icon">▧</span>
      <span class="compact-media-copy"><strong>Aucun média sélectionné</strong><small>Ajoutez une image, un GIF, une vidéo ou une animation.</small></span>`;
  }
  return `${mediaPreviewMarkup(item, "compact-media-thumb")}
    <span class="compact-media-copy"><strong>${escapeHtml(item.name || mediaNameFromUrl(item.url))}</strong><small>${escapeHtml(item.detail || mediaKindLabel(item.kind))}</small></span>
    <span class="badge cyan">${escapeHtml(mediaKindLabel(item.kind))}</span>`;
}

function mediaNameFromUrl(value) {
  try {
    const pathname = new URL(value, "http://127.0.0.1").pathname;
    return decodeURIComponent(pathname.split("/").pop() || "Média")
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ");
  } catch {
    return "Média externe";
  }
}

function mediaLibraryEntry(url) {
  return (
    MEDIA_LIBRARY.find((item) => item.url === url) ||
    mediaSessionEntries.get(url) ||
    null
  );
}

function mediaKindFromUrl(value) {
  const cleanValue = String(value || "").split(/[?#]/)[0].toLowerCase();
  if (cleanValue.endsWith(".gif")) return "gif";
  if (/\.(mp4|webm)$/.test(cleanValue)) return "video";
  if (cleanValue.endsWith(".json")) return "animation";
  return "image";
}

function mediaKindLabel(kind) {
  return (
    {
      animation: "Animation",
      gif: "GIF",
      image: "Image",
      sound: "Son",
      video: "Vidéo"
    }[kind] || "Média"
  );
}

function resolvedMediaUrl(value) {
  const source = String(value || "");
  if (!source.startsWith("/overlay/media/")) return source;
  const base = snapshot?.localOverlayUrls?.base || "";
  const token = snapshot?.state?.settings?.overlayToken || "";
  if (!base) return source;
  return `${base}${source}${source.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

function mediaPreviewMarkup(item, className = "") {
  if (!item?.url) return `<span class="${escapeHtml(className)}">▧</span>`;
  const source = escapeHtml(
    resolvedMediaUrl(item.previewUrl || item.url)
  );
  const name = escapeHtml(item.name || "Média");
  const kind = item.kind || mediaKindFromUrl(item.url);
  if (kind === "animation") {
    return `<lottie-player class="${escapeHtml(className)}" src="${source}" background="transparent" speed="1" loop autoplay aria-label="${name}"></lottie-player>`;
  }
  if (kind === "video") {
    return `<video class="${escapeHtml(className)}" src="${source}" muted loop autoplay playsinline aria-label="${name}"></video>`;
  }
  return `<img class="${escapeHtml(className)}" src="${source}" alt="${name}" loading="lazy">`;
}

function openMediaLibrary(trigger) {
  const root = trigger.closest("[data-media-picker-root]");
  const valueInput = root?.querySelector("[data-media-value]");
  if (!root || !valueInput) return;
  const selectedUrl = valueInput.value;
  const selected =
    (root.dataset.pickerKind === "sound"
      ? soundLibraryEntry(selectedUrl)
      : mediaLibraryEntry(selectedUrl)) ||
    mediaSessionEntries.get(selectedUrl) ||
    null;
  mediaLibraryContext = {
    root,
    inputName: trigger.dataset.input || valueInput.name,
    kind: trigger.dataset.kind === "sound" ? "sound" : "visual",
    optional:
      trigger.dataset.optional === "true" ||
      root.dataset.pickerOptional === "true"
  };
  mediaLibrarySource =
    selected?.source === "custom" ? "custom" : "web";
  mediaLibraryKind = "all";
  mediaLibrarySelected = selected;
  mediaLibraryRemoteSounds = [];
  mediaLibraryRemoteMedia = [];
  mediaLibraryRemotePage = 1;
  mediaLibraryRemoteHasMore = false;
  mediaLibrarySearchInput.value = "";
  mediaLibraryTitle.textContent =
    mediaLibraryContext.kind === "sound"
      ? "Choisir un son"
      : "Choisir une image, un GIF ou une vidéo";
  updateMediaLibraryUploadButton();
  renderMediaLibrary();
  if (!mediaLibraryDialog.open) mediaLibraryDialog.showModal();
  if (mediaLibrarySource === "web") loadRemoteMediaLibrary();
  requestAnimationFrame(() => mediaLibrarySearchInput.focus());
}

function closeMediaLibrary() {
  clearTimeout(mediaLibrarySearchTimer);
  mediaLibraryRequestSequence += 1;
  mediaLibraryContext = null;
  mediaLibrarySelected = null;
  mediaLibraryLoading = false;
  if (mediaLibraryDialog.open) mediaLibraryDialog.close("cancel");
}

function mediaLibrarySourceOptions() {
  const options =
    mediaLibraryContext?.kind === "sound"
      ? [
          ["web", "Catalogue web MyInstants"],
          ["custom", "Mes sons importés"]
        ]
      : [
          ["web", "Catalogue web"],
          ["custom", "Mes médias importés"]
        ];
  return options
    .map(
      ([value, label]) =>
        `<button type="button" class="${mediaLibrarySource === value ? "active" : ""}" data-media-source="${value}">${escapeHtml(label)}</button>`
    )
    .join("");
}

function mediaLibraryFilterOptions(items) {
  if (mediaLibraryContext?.kind === "visual") {
    return [
      ["all", "Tous"],
      ["image", "Images"],
      ["gif", "GIF"],
      ["video", "Vidéos"],
      ["animation", "Animations"]
    ];
  }
  const categories = [
    ...new Set(items.map((item) => item.category).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right, "fr"));
  return [
    ["all", "Tous"],
    ...categories.map((category) => [category, category])
  ];
}

function mediaLibraryItems() {
  const isSound = mediaLibraryContext?.kind === "sound";
  let items = [];
  if (isSound && mediaLibrarySource === "web") {
    items = mediaLibraryRemoteSounds;
  } else if (isSound) {
    items = SOUND_LIBRARY.filter((item) => item.source === "custom");
  } else if (mediaLibrarySource === "web") {
    items = mediaLibraryRemoteMedia;
  } else {
    items = MEDIA_LIBRARY.filter((item) => item.source === "custom");
  }
  const query = normalizeCatalogSearch(mediaLibrarySearchInput.value);
  return items.filter((item) => {
    const categoryMatch =
      mediaLibraryKind === "all" ||
      (isSound
        ? item.category === mediaLibraryKind
        : (item.kind || mediaKindFromUrl(item.url)) === mediaLibraryKind);
    const queryMatch =
      !query ||
      normalizeCatalogSearch(
        `${item.name || ""} ${item.detail || ""} ${item.category || ""}`
      ).includes(query);
    return categoryMatch && queryMatch;
  });
}

function renderMediaLibrary() {
  if (!mediaLibraryContext) return;
  const items = mediaLibraryItems();
  const filters = mediaLibraryFilterOptions(
    mediaLibraryContext.kind === "sound"
      ? SOUND_LIBRARY.filter((item) => item.source === "custom")
      : mediaLibrarySource === "web"
        ? mediaLibraryRemoteMedia
        : MEDIA_LIBRARY.filter((item) => item.source === "custom")
  );
  if (!filters.some(([value]) => value === mediaLibraryKind)) {
    mediaLibraryKind = "all";
  }
  mediaLibrarySources.innerHTML = mediaLibrarySourceOptions();
  mediaLibraryFilters.innerHTML =
    mediaLibrarySource === "web" &&
    mediaLibraryContext.kind === "sound"
      ? ""
      : filters
          .map(
            ([value, label]) =>
              `<button type="button" class="${mediaLibraryKind === value ? "active" : ""}" data-media-kind="${escapeHtml(value)}">${escapeHtml(label)}</button>`
          )
          .join("");
  mediaLibraryStatus.innerHTML = mediaLibraryLoading
    ? `<span class="media-library-spinner"></span><strong>Recherche en cours…</strong>`
    : `<strong>${items.length} résultat${items.length > 1 ? "s" : ""}</strong><span>${
        mediaLibrarySource === "web"
          ? mediaLibraryContext.kind === "sound"
            ? "MyInstants · aperçu avant utilisation"
            : "Wikimedia Commons & animations TikFinity"
          : "Vos imports personnels Backblaze"
      }</span>`;
  if (mediaLibraryContext.kind === "sound") {
    mediaLibraryResults.className = "media-library-results sound-results";
    mediaLibraryResults.innerHTML = items.length
      ? items.map(soundLibraryResultMarkup).join("")
      : mediaLibraryEmptyMarkup();
    if (
      mediaLibrarySource === "web" &&
      mediaLibraryRemoteHasMore &&
      !mediaLibraryLoading
    ) {
      mediaLibraryResults.insertAdjacentHTML(
        "beforeend",
        `<button class="button media-library-more" type="button" data-media-load-more>Afficher plus de sons</button>`
      );
    }
  } else {
    mediaLibraryResults.className = "media-library-results visual-results";
    mediaLibraryResults.innerHTML = items.length
      ? items.map(visualLibraryResultMarkup).join("")
      : mediaLibraryEmptyMarkup();
  }
  mediaLibraryConfirmButton.disabled = !mediaLibrarySelected;
}

function soundLibraryResultMarkup(item) {
  const selected =
    mediaLibrarySelected?.id === item.id ||
    mediaLibrarySelected?.url === item.url;
  return `<article class="media-sound-row ${selected ? "selected" : ""}" data-media-card data-media-id="${escapeHtml(item.id || item.url)}">
    <button type="button" class="sound-preview-button" data-media-preview-url="${escapeHtml(item.url)}" title="Écouter ${escapeHtml(item.name)}">▶</button>
    <button type="button" class="media-sound-select" data-media-select="${escapeHtml(item.id || item.url)}">
      <span><strong>${escapeHtml(item.name || "Son")}</strong><small>${escapeHtml(item.detail || "Son de la bibliothèque")}</small></span>
      <span class="badge cyan">${escapeHtml(item.category || "audio")}</span>
      <span class="media-choice-mark">${selected ? "✓ Sélectionné" : "Choisir"}</span>
    </button>
  </article>`;
}

function visualLibraryResultMarkup(item) {
  const selected =
    mediaLibrarySelected?.id === item.id ||
    mediaLibrarySelected?.url === item.url;
  return `<button type="button" class="media-visual-card ${selected ? "selected" : ""}" data-media-select="${escapeHtml(item.id || item.url)}">
    <span class="media-visual-preview">${mediaPreviewMarkup(item, "media-result-preview")}</span>
    <span class="media-visual-copy"><strong>${escapeHtml(item.name || "Média")}</strong><small>${escapeHtml(item.detail || mediaKindLabel(item.kind))}</small></span>
    <span class="media-visual-meta"><span class="badge cyan">${escapeHtml(mediaKindLabel(item.kind || mediaKindFromUrl(item.url)))}</span><b>${selected ? "✓ Sélectionné" : "Choisir"}</b></span>
  </button>`;
}

function mediaLibraryEmptyMarkup() {
  const isCustom = mediaLibrarySource === "custom";
  return `<div class="media-library-empty">
    <span>◇</span>
    <strong>${isCustom ? "Aucun média personnalisé" : "Aucun résultat"}</strong>
    <p>${isCustom ? "Utilisez le bouton d’import pour envoyer un fichier depuis votre PC vers votre espace Backblaze." : "Essayez une autre recherche ou un autre filtre."}</p>
  </div>`;
}

function findMediaLibraryItem(id) {
  const items =
    mediaLibraryContext?.kind === "sound"
      ? [...SOUND_LIBRARY, ...mediaLibraryRemoteSounds]
      : [...MEDIA_LIBRARY, ...mediaLibraryRemoteMedia];
  return (
    items.find((item) => item.id === id || item.url === id) ||
    mediaSessionEntries.get(id) ||
    null
  );
}

async function loadRemoteMediaLibrary({ append = false } = {}) {
  if (!mediaLibraryContext || mediaLibrarySource !== "web") return;
  const isSound = mediaLibraryContext.kind === "sound";
  const requestSequence = ++mediaLibraryRequestSequence;
  const requestedPage = append ? mediaLibraryRemotePage + 1 : 1;
  mediaLibraryLoading = true;
  if (!append) {
    if (isSound) mediaLibraryRemoteSounds = [];
    else mediaLibraryRemoteMedia = [];
  }
  renderMediaLibrary();
  try {
    const query = mediaLibrarySearchInput.value.trim();
    const result = isSound
      ? await api.searchSounds({
          query,
          page: requestedPage,
          locale: navigator.language || "fr"
        })
      : mediaLibraryKind === "animation"
        ? { media: [], hasMore: false }
        : await api.searchMedia({
            query,
            page: requestedPage,
            kind: mediaLibraryKind
          });
    if (
      requestSequence !== mediaLibraryRequestSequence ||
      mediaLibrarySource !== "web"
    ) {
      return;
    }
    const webAnimations =
      !isSound && requestedPage === 1
        ? MEDIA_LIBRARY.filter(
            (item) =>
              item.source === "tikfinity" &&
              (mediaLibraryKind === "all" ||
                mediaLibraryKind === "animation") &&
              (!normalizeCatalogSearch(query) ||
                normalizeCatalogSearch(
                  `${item.name} ${item.detail}`
                ).includes(normalizeCatalogSearch(query)))
          )
        : [];
    const nextItems = isSound
      ? Array.isArray(result?.sounds)
        ? result.sounds
        : []
      : [
          ...webAnimations,
          ...(Array.isArray(result?.media) ? result.media : [])
        ];
    for (const item of nextItems) {
      mediaSessionEntries.set(item.url, item);
    }
    const existingItems = isSound
      ? mediaLibraryRemoteSounds
      : mediaLibraryRemoteMedia;
    const mergedItems = append
      ? [
          ...existingItems,
          ...nextItems.filter(
            (item) =>
              !existingItems.some(
                (existing) =>
                  existing.id === item.id || existing.url === item.url
              )
          )
        ]
      : nextItems;
    if (isSound) mediaLibraryRemoteSounds = mergedItems;
    else mediaLibraryRemoteMedia = mergedItems;
    mediaLibraryRemotePage = requestedPage;
    mediaLibraryRemoteHasMore = Boolean(
      result?.hasMore &&
        (isSound ? result?.sounds?.length : result?.media?.length)
    );
  } catch (error) {
    if (requestSequence !== mediaLibraryRequestSequence) return;
    mediaLibraryRemoteHasMore = false;
    toast(
      "Catalogue web indisponible",
      error.message || String(error),
      true
    );
  } finally {
    if (requestSequence === mediaLibraryRequestSequence) {
      mediaLibraryLoading = false;
      renderMediaLibrary();
    }
  }
}

function updateMediaLibraryUploadButton({ busy = false } = {}) {
  const isSound = mediaLibraryContext?.kind === "sound";
  mediaLibraryUploadButton.innerHTML = busy
    ? `<span class="media-import-icon">↥</span><span><strong>Envoi vers Backblaze…</strong><small>Veuillez patienter pendant le transfert.</small></span>`
    : `<span class="media-import-icon">＋</span><span><strong>${
        isSound ? "Importer mon propre son" : "Importer mon propre média"
      }</strong><small>Depuis votre PC · stockage personnel Backblaze</small></span>`;
}

function updateCompactMediaPicker(root, item) {
  const valueInput = root?.querySelector("[data-media-value]");
  const nameInput = root?.querySelector("[data-media-name]");
  const selection = root?.querySelector("[data-media-selection]");
  if (!valueInput || !nameInput || !selection) return;
  const kind = root.dataset.pickerKind;
  const optional = root.dataset.pickerOptional === "true";
  valueInput.value = item?.url || "";
  nameInput.value = item?.name || "";
  const previewButton =
    kind === "sound" && item?.url
      ? `<button type="button" class="sound-preview-button" data-media-preview-url="${escapeHtml(item.url)}" title="Écouter">▶</button>`
      : "";
  const clearButton =
    optional && item?.url
      ? '<button type="button" class="button ghost small" data-clear-media>Retirer</button>'
      : "";
  selection.innerHTML = `${
    kind === "sound"
      ? soundSelectionMarkup(item)
      : visualSelectionMarkup(item)
  }
    <div class="compact-media-actions">
      ${previewButton}
      ${clearButton}
      <button type="button" class="button small" data-open-media-library data-kind="${kind === "sound" ? "sound" : "visual"}" data-input="${escapeHtml(valueInput.name)}" data-optional="${optional ? "true" : "false"}">${kind === "sound" ? "Ouvrir la bibliothèque" : "Ouvrir la bibliothèque média"}</button>
    </div>`;
}

function confirmMediaLibrarySelection() {
  if (!mediaLibraryContext || !mediaLibrarySelected) return;
  updateCompactMediaPicker(mediaLibraryContext.root, mediaLibrarySelected);
  mediaLibraryContext = null;
  mediaLibrarySelected = null;
  mediaLibraryDialog.close("selected");
}

function clearMediaPicker(root) {
  updateCompactMediaPicker(root, null);
}

async function uploadMediaFromLibrary() {
  if (!mediaLibraryContext) return;
  const featureId =
    mediaLibraryContext.kind === "sound"
      ? "backblaze.sounds"
      : "backblaze.media";
  if (!canAccessFeature(featureId)) {
    return toast(
      "Import indisponible",
      "Cette bibliothèque personnalisée est masquée par l’administration.",
      true
    );
  }
  mediaLibraryUploadButton.disabled = true;
  updateMediaLibraryUploadButton({ busy: true });
  try {
    const result = await api.uploadCustomMedia(mediaLibraryContext.kind);
    if (result?.canceled) return;
    if (result?.snapshot) acceptSnapshot(result.snapshot);
    const item = result?.media;
    if (!item) throw new Error("Le média importé est introuvable.");
    mediaSessionEntries.set(item.url, item);
    mediaLibrarySelected = item;
    mediaLibrarySource = "custom";
    mediaLibraryKind = "all";
    mediaLibrarySearchInput.value = "";
    confirmMediaLibrarySelection();
    toast(
      "Média ajouté à l’action",
      `${item.name} est sélectionné. Enregistrez l’action pour conserver ce choix.`
    );
  } catch (error) {
    toast("Import impossible", error.message || String(error), true);
  } finally {
    mediaLibraryUploadButton.disabled = false;
    updateMediaLibraryUploadButton();
  }
}

const globalMediaLibrary = Object.freeze({
  open: openMediaLibrary,
  close: closeMediaLibrary,
  clear: clearMediaPicker,
  confirm: confirmMediaLibrarySelection,
  refresh: renderMediaLibrary,
  upload: uploadMediaFromLibrary
});
window.ShenPulseMediaLibrary = globalMediaLibrary;
