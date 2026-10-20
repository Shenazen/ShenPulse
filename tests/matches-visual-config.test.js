"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMatchesConfig } = require("../src/shared/matches-contract");
const regions = {
  bannerROI: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 },
  ownerROI: { x: 0.01, y: 0.7, width: 0.2, height: 0.1 }
};
test("visual identity mode keeps legacy username opt-in configuration unchanged", () => {
  const input = { enabled: true, ...regions };
  assert.deepEqual(normalizeMatchesConfig({ visualBonus: input }).visualBonus, input);
  assert.deepEqual(normalizeMatchesConfig({ visualBonus: { ...input, ownerMode: "username" } }).visualBonus, input);
  assert.equal(normalizeMatchesConfig({}).visualBonus, undefined);
});
test("Studio self mode persists only explicit preference and rectangles, never captured identity or window", () => {
  const input = { enabled: true, ...regions, ownerMode: "studio-self", sourceId: "window:999:0",
    sourceName: "Private window", ownerDisplayName: "Do not save", ownerLines: ["Toi"], image: "data:image/png;base64,private" };
  const result = normalizeMatchesConfig({ visualBonus: input }).visualBonus;
  assert.deepEqual(result, { enabled: true, ...regions, ownerMode: "studio-self" });
  assert.notEqual(result.bannerROI, input.bannerROI);
  assert.notEqual(result.ownerROI, input.ownerROI);
  assert.equal(normalizeMatchesConfig({ visualBonus: { ...input, enabled: false } }).visualBonus.enabled, false);
});
test("unknown identity modes or missing rectangles never activate a visual reader", () => {
  for (const ownerMode of ["automatic", "other-user", null, {}, true]) {
    assert.equal(normalizeMatchesConfig({ visualBonus: { enabled: true, ...regions, ownerMode } }).visualBonus.enabled, false);
  }
  assert.equal(normalizeMatchesConfig({ visualBonus: { enabled: true, ownerMode: "studio-self", bannerROI: regions.bannerROI } }).visualBonus.enabled, false);
});

test("declared own screen persists only its position and banner, never the session confirmation or identity crop", () => {
  for (const ownPosition of ["left", "top-left"]) {
    const result = normalizeMatchesConfig({ visualBonus: { enabled: true, ...regions, ownerMode: "self-screen", ownPosition,
      ownScreenConfirmed: true, sourceId: "window:999:0", sourceName: "Private window", ownerLines: ["private"], image: "private" } }).visualBonus;
    assert.deepEqual(result, { enabled: true, bannerROI: regions.bannerROI, ownerROI: null, ownerMode: "self-screen", ownPosition });
    assert.notEqual(result.bannerROI, regions.bannerROI);
  }
  for (const ownPosition of [undefined, null, "right", true, {}]) {
    assert.equal(normalizeMatchesConfig({ visualBonus: { enabled: true, bannerROI: regions.bannerROI,
      ownerMode: "self-screen", ownPosition } }).visualBonus.enabled, false);
  }
  assert.equal(normalizeMatchesConfig({ visualBonus: { enabled: true, ownerMode: "self-screen", ownPosition: "left" } }).visualBonus.enabled, false);
});
