function isCoinPusherLocalArtwork(value) {
  return /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,/i.test(
    String(value || "").trim()
  );
}

function coinPusherArtworkPreviewUrl(value, target) {
  const url = String(value || "").trim();
  if (
    target === "platform" &&
    (!url || url === "/overlay-assets/coin-pusher/platform-default.webp")
  ) {
    return COIN_PUSHER_DEFAULT_PREVIEW_IMAGE;
  }
  if (!url) return "";
  if (isCoinPusherLocalArtwork(url)) return url;
  if (/^https?:\/\//i.test(url)) return url.slice(0, 4000);
  if (/^(?:\.\/|\/)[a-z0-9_./-]+$/i.test(url)) return url.slice(0, 4000);
  return "";
}

function renderCoinPusherThemeChoice({
  checked,
  description,
  features,
  kicker,
  label,
  theme
}) {
  return `<label class="coin-pusher-theme-choice coin-pusher-theme-choice--${theme}">
    <input type="radio" name="theme" value="${theme}" ${checked ? "checked" : ""}>
    <span class="coin-pusher-theme-preview" aria-hidden="true">
      <span class="coin-pusher-mini-machine">
        <i class="coin-pusher-mini-crown"></i>
        <i class="coin-pusher-mini-board"></i>
        <i class="coin-pusher-mini-pusher"></i>
        <i class="coin-pusher-mini-bed"></i>
        <i class="coin-pusher-mini-gem"></i>
      </span>
    </span>
    <span class="coin-pusher-theme-copy">
      <small>${escapeHtml(kicker)}</small>
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(description)}</span>
      <em>${features.map((feature) => `<i>${escapeHtml(feature)}</i>`).join("")}</em>
    </span>
    <span class="coin-pusher-theme-radio" aria-hidden="true"></span>
  </label>`;
}

function renderCoinPusherArtworkPanel(target, config) {
  const platform = target === "platform";
  const fieldName = platform ? "platformImageUrl" : "plinkoImageUrl";
  const value = String(config[fieldName] || "").trim();
  const previewUrl = coinPusherArtworkPreviewUrl(value, target);
  const local = isCoinPusherLocalArtwork(value);
  const title = platform ? "Plateforme principale" : "Fond vertical Plinko";
  const help = platform
    ? "Cette image habille le plateau sur lequel les pièces sont poussées."
    : "Cette image apparaît derrière les plots de la zone de chute.";
  return `<article class="coin-pusher-artwork-panel" data-coin-pusher-artwork-panel="${target}">
    <header>
      <span><small>${platform ? "PLATEAU" : "PLINKO"}</small><strong>${title}</strong></span>
      <em data-coin-pusher-artwork-status>${local ? "WEBP LOCAL OPTIMISÉ" : value ? "IMAGE PAR URL" : "VISUEL PAR DÉFAUT"}</em>
    </header>
    <div class="coin-pusher-artwork-preview ${platform ? "is-platform" : "is-plinko"}" data-coin-pusher-artwork-preview="${target}">
      <img ${previewUrl ? `src="${escapeHtml(previewUrl)}"` : ""} alt="" ${previewUrl ? "" : "hidden"}>
      ${platform
        ? '<span class="coin-pusher-preview-pusher"></span><span class="coin-pusher-preview-coins">● ● ● ● ●</span>'
        : '<span class="coin-pusher-preview-pegs"></span><span class="coin-pusher-preview-drop">SP</span>'}
      <small>APERÇU DANS LA MACHINE</small>
    </div>
    <p>${help}</p>
    <input type="hidden" name="${fieldName}" value="${escapeHtml(value)}" data-coin-pusher-artwork-value="${target}">
    <label class="coin-pusher-artwork-url">
      <span>URL de l’image <small>facultatif</small></span>
      <input type="url" maxlength="4000" value="${local ? "" : escapeHtml(value)}" data-coin-pusher-artwork-url="${target}" placeholder="${local ? "Image WebP locale enregistrée" : "https://…"}">
    </label>
    <div class="coin-pusher-artwork-actions">
      <label class="coin-pusher-artwork-import">
        <span>↥</span> Importer une photo
        <input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" data-coin-pusher-artwork-file="${target}">
      </label>
      <button type="button" class="button ghost" data-action="reset-coin-pusher-artwork" data-artwork-target="${target}">↻ Défaut</button>
    </div>
  </article>`;
}

function updateCoinPusherArtworkDraft(source, value, { syncUrl = true } = {}) {
  const target = source?.dataset.artworkTarget ||
    source?.dataset.coinPusherArtworkUrl ||
    source?.dataset.coinPusherArtworkFile;
  if (!target) return;
  const form = source.closest('[data-integrated-game-settings="coin-pusher"]');
  const panel = form?.querySelector(
    `[data-coin-pusher-artwork-panel="${target}"]`
  );
  if (!panel) return;
  const cleanValue = String(value || "").trim();
  const storedInput = panel.querySelector(
    `[data-coin-pusher-artwork-value="${target}"]`
  );
  const urlInput = panel.querySelector(
    `[data-coin-pusher-artwork-url="${target}"]`
  );
  const preview = panel.querySelector(
    `[data-coin-pusher-artwork-preview="${target}"]`
  );
  const image = preview?.querySelector("img");
  const status = panel.querySelector("[data-coin-pusher-artwork-status]");
  const local = isCoinPusherLocalArtwork(cleanValue);
  const previewUrl = coinPusherArtworkPreviewUrl(cleanValue, target);

  if (storedInput) storedInput.value = cleanValue;
  if (urlInput && syncUrl) {
    urlInput.value = local ? "" : cleanValue;
    urlInput.placeholder = local
      ? "Image WebP locale enregistrée"
      : "https://…";
  }
  if (image) {
    image.hidden = !previewUrl;
    if (previewUrl) image.src = previewUrl;
    else image.removeAttribute("src");
  }
  if (status) {
    status.textContent = local
      ? "WEBP LOCAL OPTIMISÉ"
      : cleanValue
        ? "IMAGE PAR URL"
        : "VISUEL PAR DÉFAUT";
  }
}

function resetCoinPusherArtwork(button) {
  updateCoinPusherArtworkDraft(button, "");
  toast(
    "Visuel par défaut restauré",
    "Enregistrez les réglages pour appliquer ce changement."
  );
}

async function importCoinPusherArtwork(input) {
  const file = input.files?.[0];
  if (!file) return;
  const panel = input.closest("[data-coin-pusher-artwork-panel]");
  const importLabel = input.closest(".coin-pusher-artwork-import");
  const validType = /^image\/(?:avif|gif|jpe?g|png|webp)$/i.test(file.type) ||
    /\.(?:avif|gif|jpe?g|png|webp)$/i.test(file.name);
  if (!validType) {
    input.value = "";
    return toast(
      "Format non pris en charge",
      "Choisissez une photo PNG, JPG, GIF, AVIF ou WebP.",
      true
    );
  }
  if (file.size > COIN_PUSHER_ARTWORK_MAX_SOURCE_BYTES) {
    input.value = "";
    return toast(
      "Photo trop lourde",
      "Le fichier doit peser moins de 20 Mo.",
      true
    );
  }

  input.disabled = true;
  importLabel?.classList.add("busy");
  panel?.setAttribute("aria-busy", "true");
  try {
    const dataUrl = await optimizeCoinPusherArtwork(file);
    updateCoinPusherArtworkDraft(input, dataUrl);
    toast(
      "Photo prête",
      "Elle a été optimisée en WebP. Enregistrez les réglages pour l’utiliser dans le jeu."
    );
  } catch (error) {
    toast(
      "Import impossible",
      error.message || String(error),
      true
    );
  } finally {
    input.disabled = false;
    input.value = "";
    importLabel?.classList.remove("busy");
    panel?.removeAttribute("aria-busy");
  }
}

async function optimizeCoinPusherArtwork(file) {
  const decoded = await decodeCoinPusherArtwork(file);
  let smallestDataUrl = "";
  try {
    const initialScale = Math.min(
      1,
      COIN_PUSHER_ARTWORK_MAX_DIMENSION /
        Math.max(decoded.width, decoded.height)
    );
    const qualities = [0.84, 0.76, 0.68, 0.6, 0.52, 0.46];
    for (let pass = 0; pass < 5; pass += 1) {
      const scale = initialScale * Math.pow(0.82, pass);
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) {
        throw new Error("ShenPulse ne peut pas optimiser cette image.");
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, width, height);
      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL("image/webp", quality);
        if (!/^data:image\/webp;base64,/i.test(dataUrl)) {
          throw new Error("L’export WebP est indisponible sur cet appareil.");
        }
        if (!smallestDataUrl || dataUrl.length < smallestDataUrl.length) {
          smallestDataUrl = dataUrl;
        }
        if (dataUrl.length <= COIN_PUSHER_ARTWORK_TARGET_LENGTH) {
          return dataUrl;
        }
      }
    }
  } finally {
    decoded.dispose();
  }
  if (
    smallestDataUrl &&
    smallestDataUrl.length <= COIN_PUSHER_ARTWORK_TARGET_LENGTH * 1.15
  ) {
    return smallestDataUrl;
  }
  throw new Error(
    "La photo reste trop complexe après optimisation. Choisissez un visuel plus simple."
  );
}

async function decodeCoinPusherArtwork(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image"
      });
      return {
        dispose: () => bitmap.close(),
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width
      };
    } catch {
      // Les formats non pris en charge passent par une image HTML.
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const candidate = new Image();
      candidate.decoding = "async";
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () =>
        reject(new Error("Le fichier image ne peut pas être décodé."));
      candidate.src = objectUrl;
    });
    return {
      dispose: () => URL.revokeObjectURL(objectUrl),
      height: image.naturalHeight,
      source: image,
      width: image.naturalWidth
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
