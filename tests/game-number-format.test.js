"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { loadRendererModule } = require("./helpers/three-renderer-traces");
const file = path.join(__dirname, "..", "src/renderer/games/original-src/utils/numberFormat.ts");

test("les nombres gardent les mêmes textes dans chaque langue et le formateur est réutilisé", () => {
  const { api } = loadRendererModule(file);
  for (const locale of [undefined, "fr-FR", "en-US"]) {
    for (const options of [{ maximumFractionDigits: 0 }, { maximumFractionDigits: 2 }, { notation: "compact", maximumFractionDigits: 1 }]) {
      const formatter = api.getGameNumberFormatter(locale, options);
      for (const value of [0, 9.99, 99999, -12345, NaN, Infinity]) assert.equal(formatter.format(value), new Intl.NumberFormat(locale, options).format(value));
      assert.equal(api.getGameNumberFormatter(locale, { ...options }), formatter);
    }
  }
  assert.equal(api.getGameNumberFormatter("fr-FR", { notation: "compact", maximumFractionDigits: 1 }), api.getGameNumberFormatter("fr-FR", { maximumFractionDigits: 1, notation: "compact" }));
});

test("le cache élimine les anciens formateurs et ne peut grossir sans limite", () => {
  const { api } = loadRendererModule(file);
  const original = api.getGameNumberFormatter("fr-FR", {});
  for (let width = 1; width <= 20; width++) {
    api.getGameNumberFormatter("fr-FR", { minimumIntegerDigits: width });
    api.getGameNumberFormatter("en-US", { minimumIntegerDigits: width });
  }
  assert.notEqual(api.getGameNumberFormatter("fr-FR", {}), original);
});
