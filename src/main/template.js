"use strict";

const { getPath, safeString } = require("./utils");

function renderTemplate(template, context) {
  return String(template ?? "").replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, path) => {
    const value = getPath(context, path);
    return safeString(value == null ? "" : value, 1000);
  });
}

function renderValue(value, context) {
  if (typeof value === "string") return renderTemplate(value, context);
  if (Array.isArray(value)) return value.map((entry) => renderValue(entry, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, renderValue(entry, context)])
    );
  }
  return value;
}

module.exports = { renderTemplate, renderValue };

