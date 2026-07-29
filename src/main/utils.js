"use strict";

const crypto = require("node:crypto");

function id(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function clone(value) {
  return structuredClone(value);
}

function getPath(source, path) {
  if (!path) return source;
  return String(path)
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function safeString(value, maximum = 500) {
  return String(value ?? "").replace(/\0/g, "").slice(0, maximum);
}

function preferredImageUrl(...values) {
  const urls = [];
  const visited = new Set();
  const collect = (value) => {
    if (!value || visited.has(value)) return;
    if (typeof value === "string") {
      const candidate = value.trim().replace(/^\/\//, "https://");
      if (/^https?:\/\//i.test(candidate)) urls.push(safeString(candidate, 1000));
      return;
    }
    if (Array.isArray(value)) {
      visited.add(value);
      value.forEach(collect);
      return;
    }
    if (typeof value !== "object") return;
    visited.add(value);
    [
      value.profilePictureUrl,
      value.avatarUrl,
      value.url,
      value.urlList,
      value.urls,
      value.href
    ].forEach(collect);
  };
  values.forEach(collect);
  return (
    urls.find((url) => /100x100/i.test(url) && /\.webp(?:\?|$)/i.test(url)) ||
    urls.find((url) => /100x100/i.test(url) && /\.jpe?g(?:\?|$)/i.test(url)) ||
    urls.find((url) => !/shrink/i.test(url)) ||
    urls[0] ||
    ""
  );
}

function timingSafeToken(actual, expected) {
  const first = Buffer.from(String(actual ?? ""));
  const second = Buffer.from(String(expected ?? ""));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /token|password|secret|authorization|oauth/i.test(key) ? "••••••••" : redact(entry)
    ])
  );
}

function serializeError(error) {
  return {
    name: error?.name || "Error",
    message: safeString(error?.message || error, 1000),
    code: safeString(error?.code || "", 100),
    stack: safeString(error?.stack || "", 4000)
  };
}

module.exports = {
  clamp,
  clone,
  getPath,
  id,
  preferredImageUrl,
  redact,
  safeString,
  serializeError,
  timingSafeToken
};
