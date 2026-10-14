"use strict";

/** catalogs : module « media », sans initialisation externe au chargement. */
const fs = require("node:fs");
const path = require("node:path");
const { safeString } = require("../utils");

const TIKFINITY_LOTTIE_PRESETS = [
  ["10086-well-done", "Well Done", "general"],
  ["10193-cup", "Coupe", "general"],
  ["10236-reward-badge", "Badge de récompense", "general"],
  ["10341-it-animation", "Animation IT", "general"],
  ["10475-drawing-a-love", "Cœur dessiné", "general"],
  ["10530-heart-animation", "Animation cœur", "general"],
  ["10651-jumpin-pumpkin", "Citrouille bondissante", "celebration"],
  ["10653-halloween-candy", "Bonbons Halloween", "celebration"],
  ["10849-halloween-pumpkin", "Citrouille Halloween", "celebration"],
  ["11034-sparkles", "Étincelles", "celebration"]
];

function createMediaCatalog(resourcesDirectory) {
  const mediaDirectory = path.join(resourcesDirectory, "overlays", "media");
  const catalog = [];
  for (const filePath of walkFiles(mediaDirectory)) {
    const relative = path.relative(mediaDirectory, filePath).replace(/\\/g, "/");
    if (relative.startsWith("sounds/")) continue;
    const extension = path.extname(relative).toLowerCase();
    const kind = mediaKind(extension);
    if (!kind) continue;
    const segments = relative.split("/");
    const category =
      segments[0] === "widgets"
        ? segments[1] || "widgets"
        : segments[0] || kind;
    catalog.push({
      id: `included:${relative}`,
      name: mediaTitle(path.basename(relative, extension)),
      detail: `${mediaKindLabel(kind)} inclus · ${categoryLabel(category)}`,
      category,
      kind,
      source: "included",
      url: `/overlay/media/${relative}`
    });
  }
  for (const [id, name, category] of TIKFINITY_LOTTIE_PRESETS) {
    catalog.push({
      id: `tikfinity:${id}`,
      name,
      detail: "Animation Lottie prédéfinie · Tikfinity",
      category,
      kind: "animation",
      source: "tikfinity",
      url: `/overlay/media/lottie/${id}.json`
    });
  }
  return catalog.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind, "fr") ||
      left.name.localeCompare(right.name, "fr", {
        sensitivity: "base",
        numeric: true
      })
  );
}

async function searchWikimediaMedia({
  query = "",
  page = 1,
  kind = "all"
} = {}) {
  const cleanQuery = safeString(query, 80).trim();
  const pageNumber = Math.min(20, Math.max(1, Number(page) || 1));
  const supportedKind = ["all", "image", "gif", "video"].includes(kind)
    ? kind
    : "all";
  const kindTerms = {
    all: "",
    image: " filetype:bitmap",
    gif: " filetype:bitmap",
    video: " filetype:video"
  };
  const searchText = `${
    cleanQuery || "livestream overlay animation"
  }${kindTerms[supportedKind]}`.trim();
  const requestUrl = new URL("https://commons.wikimedia.org/w/api.php");
  requestUrl.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: searchText,
    gsrlimit: "40",
    gsroffset: String((pageNumber - 1) * 40),
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "480",
    origin: "*"
  }).toString();
  const response = await fetch(requestUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ShenPulse/1.0 (Microsoft Store desktop app)"
    }
  });
  if (!response.ok) {
    throw new Error(
      `Catalogue média web indisponible (${response.status}).`
    );
  }
  const media = normalizeWikimediaMediaPayload(await response.json()).filter(
    (item) =>
      supportedKind === "all" ||
      item.kind === supportedKind ||
      (supportedKind === "image" && item.kind === "image")
  );
  return {
    source: "wikimedia",
    query: cleanQuery,
    page: pageNumber,
    kind: supportedKind,
    hasMore: media.length > 0,
    media
  };
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(target));
    else if (entry.isFile()) results.push(target);
  }
  return results;
}

function mediaKind(extension) {
  if ([".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension)) {
    return extension === ".gif" ? "gif" : "image";
  }
  if ([".mp4", ".webm"].includes(extension)) return "video";
  return "";
}

function mediaKindLabel(kind) {
  return {
    animation: "Animation",
    gif: "GIF",
    image: "Image",
    video: "Vidéo"
  }[kind] || "Média";
}

function categoryLabel(value) {
  return mediaTitle(String(value || "").replace(/_/g, "-"));
}

function mediaTitle(value) {
  return String(value || "")
    .replace(/^\d+[-_]?/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function normalizeWikimediaMediaPayload(payload = {}) {
  const pages = Array.isArray(payload?.query?.pages)
    ? payload.query.pages
    : [];
  return pages
    .map((page) => {
      const info = page?.imageinfo?.[0] || {};
      const mime = String(info.mime || "").toLowerCase();
      const kind =
        mime === "image/gif"
          ? "gif"
          : mime === "video/webm"
            ? "video"
            : [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/svg+xml"
              ].includes(mime)
              ? "image"
              : "";
      if (!kind || !info.url) return null;
      const originalUrl = String(info.url);
      const previewUrl = String(info.thumburl || originalUrl);
      const title = String(page.title || "Média Wikimedia")
        .replace(/^File:/i, "")
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const license = stripHtml(
        info.extmetadata?.LicenseShortName?.value ||
          info.extmetadata?.UsageTerms?.value ||
          ""
      );
      return {
        id: `wikimedia:${page.pageid || originalUrl}`,
        name: safeString(title || "Média Wikimedia", 180),
        detail: `Wikimedia Commons${license ? ` · ${license}` : ""}`,
        category: kind,
        kind,
        source: "wikimedia",
        url: kind === "image" ? previewUrl : originalUrl,
        previewUrl,
        pageUrl: String(info.descriptionurl || "")
      };
    })
    .filter(Boolean);
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { TIKFINITY_LOTTIE_PRESETS, createMediaCatalog, searchWikimediaMedia, walkFiles, mediaKind, mediaKindLabel, categoryLabel, mediaTitle, normalizeWikimediaMediaPayload, stripHtml };

