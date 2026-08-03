"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compareGiftValue,
  normalizeGiftValueFilter
} = require("../src/shared/gift-value-filter");
const { wheelGiftTriggerMatches } = require("../src/main/core");

test("compare la valeur unitaire d'un cadeau avec tous les opérateurs", () => {
  assert.equal(compareGiftValue(499, "less", 500), true);
  assert.equal(compareGiftValue(500, "lessOrEqual", 500), true);
  assert.equal(compareGiftValue(500, "equals", 500), true);
  assert.equal(compareGiftValue(501, "notEquals", 500), true);
  assert.equal(compareGiftValue(500, "greaterOrEqual", 500), true);
  assert.equal(compareGiftValue(501, "greater", 500), true);
  assert.equal(compareGiftValue(500, "greater", 500), false);
  assert.equal(compareGiftValue(0, "less", 500), false);
});

test("normalise seulement les filtres de pièces valides", () => {
  assert.deepEqual(
    normalizeGiftValueFilter({ operator: "greater", value: "500" }),
    { operator: "greater", value: 500 }
  );
  assert.equal(normalizeGiftValueFilter({ operator: "greater", value: "" }), null);
  assert.equal(normalizeGiftValueFilter({ operator: "greater", value: 0 }), null);
});

test("une roue accepte soit un cadeau précis, soit une valeur", () => {
  const rose500 = {
    type: "gift",
    data: { giftId: "5655", giftName: "Rose", value: 500 }
  };
  assert.equal(
    wheelGiftTriggerMatches({ enabled: true, trigger: "Rose" }, rose500),
    true
  );
  assert.equal(
    wheelGiftTriggerMatches(
      {
        enabled: true,
        trigger: "",
        giftValueFilter: { operator: "greaterOrEqual", value: 500 }
      },
      rose500
    ),
    true
  );
  assert.equal(
    wheelGiftTriggerMatches(
      {
        enabled: true,
        trigger: "Galaxy",
        giftValueFilter: { operator: "greaterOrEqual", value: 500 }
      },
      rose500
    ),
    true
  );
  assert.equal(
    wheelGiftTriggerMatches(
      {
        enabled: true,
        trigger: "Rose",
        giftValueFilter: { operator: "greater", value: 500 }
      },
      rose500
    ),
    false
  );
});
