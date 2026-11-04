"use strict";

const { renderTemplate } = require("../template");
const { clamp, safeString } = require("../utils");

/** Texte résolu au déclenchement, sans transporter le contexte ou le modèle. */
function actionAlertDisplay(config = {}, context = {}, statistics = {}) {
  if (config.alert?.enabled !== true) return null;
  const options = config.alert;
  const event = context.event || context;
  const data = event.data || context.data || {};
  const user = event.user || context.user || {};
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const count = number(data.count ?? data.repeatCount ?? 1);
  const variables = {
    username: safeString(user.name || user.uniqueId || user.username || user.displayName, 160),
    nickname: safeString(user.displayName || user.nickname || user.name, 160),
    giftname: safeString(data.giftName, 200),
    repeatcount: count,
    coins: number(data.diamonds ?? data.coins ?? (number(data.value ?? data.diamondCount) * count)),
    likecount: event.type === "like" ? number(data.count ?? data.likeCount) : 0,
    totallikecount: number(data.totalLikes || data.totalLikeCount || statistics.likes),
    comment: safeString(data.message || data.comment, 500),
    submonth: number(data.months ?? data.subMonth ?? data.subscribedMonth ?? data.raw?.subMonth ?? data.raw?.subscribedMonth)
  };
  const template = renderTemplate(options.message || "", context);
  const resolve = text => text.replace(/\{([a-z]+)\}/gi, (token, key) => Object.hasOwn(variables, key.toLowerCase()) ? String(variables[key.toLowerCase()]) : token);
  const message = safeString(resolve(template.replace(/\{avatar\}/gi, "")), 500).trim();
  let parts;
  if (/\{avatar\}/i.test(template)) {
    let url = "";
    try { const image = new URL(user.avatarUrl || user.profilePictureUrl || ""); if (image.protocol === "https:" && !image.username && !image.password) url = image.href; } catch { /* Photo indisponible : initiale du viewer. */ }
    parts = template.split(/(\{avatar\})/gi).filter(Boolean).slice(0, 40).map(part => /^\{avatar\}$/i.test(part)
      ? { type: "avatar", url, label: variables.nickname || variables.username || "Viewer" }
      : { type: "text", text: safeString(resolve(part), 500) });
  }
  const username = options.showUser === false ? "" : variables.nickname || variables.username;
  if (!message && !username && !parts) return null;
  return {
    username, message, ...(parts ? { parts } : {}),
    color: /^#[0-9a-f]{6}$/i.test(options.color || "") ? options.color : "#ffffff",
    strokeColor: /^#[0-9a-f]{6}$/i.test(options.strokeColor || "") ? options.strokeColor : "#000000",
    ...(options.fontSize != null ? { fontSize: boundedNumber(options.fontSize, 42, 8, 240) } : {}),
    ...(options.strokeWidth != null ? { strokeWidth: boundedNumber(options.strokeWidth, 1.5, 0, 20) } : {}),
    font: ["Inter", "Arial", "Georgia", "Impact", "Verdana"].includes(options.font) ? options.font : "Inter",
    position: options.position === "top" ? "top" : "bottom",
    screen: clamp(Math.round(Number(options.screen ?? config.screen) || 1), 1, 8),
    durationMs: clamp(Number(options.durationMs ?? config.durationMs) || 5000, 500, 60000)
  };
}

function boundedNumber(value, fallback, minimum, maximum) {
  return value !== "" && Number.isFinite(Number(value)) ? clamp(Number(value), minimum, maximum) : fallback;
}

module.exports = { actionAlertDisplay };
