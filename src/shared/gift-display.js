(function exposeGiftDisplay(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShenPulseGiftDisplay = api;
})(typeof globalThis === "object" ? globalThis : this, function createGiftDisplayApi() {
"use strict";

// Presentation only. Similar artwork is never evidence of interchangeable
// TikTok gift IDs: the original rows and every variant remain intact.
function displayImage(value) {
  const clean = String(value || "").trim().replace(/[?#].*$/, "").replace(/~.*$/, "");
  const filename = clean.split("/").pop()?.toLowerCase() || "";
  if (!filename || /^(?:gift|default|unknown|placeholder|missing|avatar|icon|no[-_]?image)(?:[-_]\d+)?\.(?:png|jpe?g|webp|gif|svg)$/.test(filename)) return "";
  // Identical TikTok image hashes may use different CDN hosts and transforms.
  // Ordinary filenames are not globally unique, so retain their whole URL.
  return filename.match(/^([a-f0-9]{32})(?:\.(?:png|jpe?g|webp))?$/i)?.[1] || clean;
}

function groupGiftDisplayRows(rows, { preferredId = "", query = "" } = {}) {
  const groups = new Map(), wanted = String(query || "").trim(), preferred = String(preferredId || "").trim();
  let sequence = 0;
  for (const gift of Array.isArray(rows) ? rows : []) {
    if (!gift || typeof gift !== "object" || gift.selectable === false || !String(gift.name || "").trim()) continue;
    const cost = Number(gift.cost), image = displayImage(gift.imageUrl);
    const id = String(gift.id || "");
    const key = JSON.stringify([Number.isFinite(cost) && cost >= 0 ? cost : "unknown", image || `id:${id || `row:${++sequence}`}`]);
    let group = groups.get(key);
    if (!group) { group = { gift, variants: [] }; groups.set(key, group); }
    if (!id || !group.variants.some((row) => String(row.id || "") === id)) group.variants.push(gift);
  }
  for (const group of groups.values()) {
    const matchesId = (gift, id) => id && [gift.id, ...(Array.isArray(gift.alternateIds) ? gift.alternateIds : [])]
      .some((value) => String(value || "") === id);
    group.gift = group.variants.find((gift) => matchesId(gift, wanted)) ||
      group.variants.find((gift) => matchesId(gift, preferred)) || group.gift;
  }
  return [...groups.values()];
}

return { groupGiftDisplayRows };
});
