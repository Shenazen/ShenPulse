"use strict";

/** Messages éphémères du lecteur Match public.
 * Le canal dédié n'accepte ni messages de chat, ni identités internes,
 * ni URL locales/secrets. Seuls les médias HTTPS publics déjà choisis dans
 * la bibliothèque/configuration sont transportés ; aucun fichier n'est uploadé.
 */
const { isIP } = require("node:net");
const { DEFAULT_PUBLIC_OVERLAY_BASE_URL, publicMediaUrl, createRelayMessage } = require("../../shared/public-overlay-protocol");
const { matches, normalizeAnimationVariant } = require("../../../resources/overlays/overlay-catalog");

const MATCH_MESSAGE_CHANNELS = new Set(["match", "match-media", "match-audio"]);
const MATCH_MESSAGE_TTL_MS = 15_000;
const animationNames = new Set(matches.map((item) => item.match));
const identifier = (value) => /^[A-Za-z0-9_-]{1,160}$/.test(String(value || "")) ? String(value) : "";

function publicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.hash &&
      host.includes(".") && !isIP(host) && host !== "localhost" &&
      !/\.(?:localhost|local|internal|lan|home)$/.test(host) ? url : null;
  } catch { return null; }
}

function configuredMatchMediaUrls(state) {
  const urls = new Set();
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 8) return;
    for (const [key, item] of Object.entries(value).slice(0, 1000)) {
      if (["url", "mediaUrl", "soundUrl"].includes(key) && typeof item === "string") {
        const url = publicHttpsUrl(item); if (url) urls.add(url.href);
      } else if (item && typeof item === "object") visit(item, depth + 1);
    }
  };
  visit(state.customSounds); visit(state.customMedia); visit(state.settings?.matches?.automations);
  return urls;
}

function matchPublicMediaUrl(value, { baseUrl = DEFAULT_PUBLIC_OVERLAY_BASE_URL, publicMediaBaseUrl = "", trustedMediaUrls = new Set() } = {}) {
  const url = publicHttpsUrl(publicMediaUrl(value, baseUrl));
  const base = publicHttpsUrl(baseUrl);
  if (!url || !base) return "";
  if (url.origin === base.origin && url.pathname.startsWith("/media/") && !url.search) return url.href;
  const mediaBase = publicHttpsUrl(publicMediaBaseUrl);
  // Un lien signé de média choisi reste un jeton de lecture public éphémère,
  // pas une clé B2. Sa query doit être préservée, jamais journalisée.
  if (trustedMediaUrls.has(url.href) || mediaBase && url.origin === mediaBase.origin &&
      url.pathname.startsWith(`${mediaBase.pathname.replace(/\/+$/, "")}/`)) return url.href;
  return "";
}

function createMatchRelayMessage(channel, input = {}, options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_PUBLIC_OVERLAY_BASE_URL;
  if (!MATCH_MESSAGE_CHANNELS.has(channel) || !input || typeof input !== "object") return null;
  let payload;
  if (channel === "match") {
    const match = String(input.match || "").toLowerCase();
    const requestId = identifier(input.requestId);
    if (!animationNames.has(match) || !requestId) return null;
    const variant = normalizeAnimationVariant(match, input.variant);
    if (!variant) return null;
    payload = { requestId, match, variant,
      fit: input.fit === "cover" ? "cover" : "contain" };
  } else {
    const playbackId = identifier(input.playbackId);
    const url = matchPublicMediaUrl(channel === "match-media" ? input.mediaUrl : input.url, { ...options, baseUrl });
    if (!playbackId || !url) return null;
    const soundUrl = channel === "match-media" && input.soundUrl ? matchPublicMediaUrl(input.soundUrl, { ...options, baseUrl }) : "";
    if (input.soundUrl && !soundUrl) return null;
    payload = channel === "match-media"
      ? { playbackId, mediaUrl: url, durationMs: Math.min(300_000, Math.max(500, Number(input.durationMs) || 5000)),
          ...(soundUrl ? { soundUrl } : {}) }
      : { playbackId, url, volume: Number.isFinite(Number(input.volume ?? 1)) ? Math.min(1, Math.max(0, Number(input.volume ?? 1))) : 1 };
  }
  return createRelayMessage(channel, payload, { baseUrl });
}

function matchMessageFresh(message, nowMs = Date.now()) {
  const at = Date.parse(message?.timestamp);
  return Number.isFinite(at) && at <= nowMs + MATCH_MESSAGE_TTL_MS && at >= nowMs - MATCH_MESSAGE_TTL_MS;
}

module.exports = { MATCH_MESSAGE_CHANNELS, MATCH_MESSAGE_TTL_MS, createMatchRelayMessage, matchMessageFresh, configuredMatchMediaUrls, matchPublicMediaUrl };
