/** Charge et met en cache les images et la police ; exporte le PNG. */

import { MINECRAFT_FONT_FACE, MINECRAFT_FONT_SRC } from "./constants.mjs";

const imageLoadCache = /* @__PURE__ */ new Map();

let minecraftFontLoadPromise = null;

function ensureMinecraftOverlayFont() {
  if (minecraftFontLoadPromise) return minecraftFontLoadPromise;
  minecraftFontLoadPromise = (async () => {
    if (typeof document === "undefined" || typeof FontFace === "undefined" || !document.fonts) return;
    try {
      const alreadyLoaded = Array.from(document.fonts).some((font) => font.family === MINECRAFT_FONT_FACE);
      if (!alreadyLoaded) {
        const font = new FontFace(MINECRAFT_FONT_FACE, `url("${MINECRAFT_FONT_SRC}")`, {
          style: "normal",
          weight: "900"
        });
        document.fonts.add(await font.load());
      }
      await document.fonts.load(`900 32px "${MINECRAFT_FONT_FACE}"`);
    } catch {
    }
  })();
  return minecraftFontLoadPromise;
}

function loadOverlayImage(src, timeoutMs = 4500) {
  const cleanSrc = String(src || "").trim();
  if (!cleanSrc) return Promise.resolve(null);
  const cached = imageLoadCache.get(cleanSrc);
  if (cached) return cached;
  const promise = new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = cleanSrc;
  });
  imageLoadCache.set(cleanSrc, promise);
  return promise;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Export PNG impossible."));
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function defaultOverlayFilename() {
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return `shenpulse-bedrock-box-overlay-${day}.png`;
}

export { imageLoadCache, minecraftFontLoadPromise, ensureMinecraftOverlayFont, loadOverlayImage, canvasToBlob, defaultOverlayFilename };

