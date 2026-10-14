"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { ViewerService } = require("../src/main/viewer-service");
const { ranks, rankForDiamonds, progressForDiamonds, describeRank } = require("../src/shared/viewer-ranks");

/** Les tests dérivent les frontières du contrat partagé, sans inventer de paliers. */
test("les onze rangs ont des identités uniques et des minima entiers strictement croissants", () => {
  assert.equal(ranks.length, 11);
  assert.equal(ranks[0].minimum, 0);
  assert.equal(new Set(ranks.map((rank) => rank.id)).size, ranks.length);
  assert.ok(Object.isFrozen(ranks));
  for (let index = 0; index < ranks.length; index += 1) {
    const rank = ranks[index];
    assert.ok(Object.isFrozen(rank));
    assert.ok(Number.isSafeInteger(rank.minimum) && rank.minimum >= 0);
    assert.ok(rank.label && rank.id && rank.color && rank.icon);
    if (index) assert.ok(rank.minimum > ranks[index - 1].minimum);
  }
});

test("les conditions affichées décrivent exactement les intervalles du barème partagé", () => {
  const format = new Intl.NumberFormat("fr-FR");
  ranks.forEach((rank, index) => {
    const next = ranks[index + 1];
    const expected = next?.minimum === rank.minimum + 1
      ? `${format.format(rank.minimum)} diamant cumulé`
      : next
        ? `De ${format.format(rank.minimum)} à ${format.format(next.minimum - 1)} diamants cumulés`
        : `À partir de ${format.format(rank.minimum)} diamants cumulés`;
    assert.equal(describeRank(rank), expected);
    assert.equal(describeRank(rank.id), expected);
    assert.equal(describeRank({ ...rank, minimum: 99999999 }), expected, "un snapshot n'impose pas un deuxième barème");
  });
  for (const invalid of [null, undefined, {}, "unknown"]) assert.equal(describeRank(invalid), "");
});

for (let index = 0; index < ranks.length; index += 1) {
  const rank = ranks[index];
  test(`le rang ${rank.label} commence à son minimum et couvre uniquement son intervalle`, () => {
    assert.equal(rankForDiamonds(rank.minimum), rank);
    assert.equal(rankForDiamonds(String(rank.minimum)), rank);
    assert.equal(rankForDiamonds(`  ${rank.minimum}  `), rank);
    assert.equal(rankForDiamonds(rank.minimum + 0.99), rank, "les fractions ne créent pas un rang anticipé");
    if (index) {
      assert.equal(rankForDiamonds(rank.minimum - 1), ranks[index - 1]);
      assert.equal(rankForDiamonds(rank.minimum - 0.01), ranks[index - 1]);
    }
    const next = ranks[index + 1];
    if (next) {
      assert.equal(rankForDiamonds(next.minimum - 1), rank);
      assert.equal(rankForDiamonds(next.minimum - 0.01), rank);
      assert.equal(rankForDiamonds(next.minimum), next);
    } else {
      assert.equal(rankForDiamonds(Number.MAX_SAFE_INTEGER), rank);
    }
  });
}

test("les valeurs invalides et non finies ne donnent jamais un rang supérieur", () => {
  const invalid = [
    Infinity, -Infinity, NaN, true, false, null, undefined, {}, [], [1],
    Symbol("diamants"), 1n, "Infinity", "-Infinity", "NaN", "non numérique", "", "   "
  ];
  for (const value of invalid) {
    assert.equal(rankForDiamonds(value), ranks[0]);
  }
  assert.equal(rankForDiamonds(-1), ranks[0]);
  assert.equal(rankForDiamonds("-100"), ranks[0]);
});

test("un objet fourni au calcul du rang ne peut pas exécuter de conversion implicite", () => {
  let conversions = 0;
  const invalid = {
    valueOf() { conversions += 1; throw new Error("Conversion interdite"); },
    toString() { conversions += 1; throw new Error("Conversion interdite"); }
  };
  assert.equal(rankForDiamonds(invalid), ranks[0]);
  assert.equal(conversions, 0);
});

test("les nombres finis dépassant la limite des compteurs restent au dernier rang", () => {
  for (const value of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, Number.MAX_VALUE]) {
    assert.equal(rankForDiamonds(value), ranks.at(-1));
    assert.equal(rankForDiamonds(String(value)), ranks.at(-1));
  }
  assert.equal(rankForDiamonds("1e3"), rankForDiamonds(1000));
  assert.equal(rankForDiamonds("10.99"), rankForDiamonds(10));
});

test("la progression utilise les bornes de chaque palier sans modifier les onze seuils", () => {
  const before = JSON.stringify(ranks);
  ranks.forEach((rank, index) => {
    const nextRank = ranks[index + 1] || null;
    const progress = progressForDiamonds(rank.minimum);
    assert.equal(progress.rank, rank);
    assert.equal(progress.nextRank, nextRank);
    assert.equal(progress.diamonds, rank.minimum);
    assert.equal(progress.earned, 0);
    assert.equal(progress.required, nextRank ? nextRank.minimum - rank.minimum : 0);
    assert.equal(progress.remaining, progress.required);
    assert.equal(progress.percent, nextRank ? 0 : 100);
    if (nextRank) {
      const last = progressForDiamonds(nextRank.minimum - 1);
      assert.equal(last.rank, rank);
      assert.equal(last.remaining, 1);
      assert.equal(last.earned, last.required - 1);
      assert.ok(last.percent >= 0 && last.percent < 100);
      assert.equal(progressForDiamonds(nextRank.minimum).rank, nextRank);
    }
  });
  assert.equal(JSON.stringify(ranks), before);
  const progress = progressForDiamonds(300);
  assert.equal(progress.rank.id, "loyal");
  assert.equal(progress.nextRank.id, "vip");
  assert.equal(progress.earned, 200, "le minimum du palier est soustrait, pas un objectif depuis zéro");
  assert.equal(progress.required, 400);
  assert.equal(progress.remaining, 200);
  assert.equal(progress.percent, 50);
});

test("progression et rang normalisent les valeurs invalides de la même façon, sans conversion d'objet", () => {
  const values = [null, undefined, false, true, NaN, Infinity, -Infinity, -1, "", "oops", [], {}, Symbol("test"), 1n];
  let conversions = 0;
  values.push({ valueOf() { conversions += 1; throw new Error("interdit"); } });
  for (const value of values) {
    const progress = progressForDiamonds(value);
    assert.equal(progress.rank, ranks[0]);
    assert.equal(progress.diamonds, 0);
    assert.equal(progress.remaining, 1);
    assert.equal(progress.percent, 0);
  }
  assert.equal(conversions, 0);
  assert.deepEqual(progressForDiamonds("300.9"), progressForDiamonds(300));
  const maximum = progressForDiamonds(Number.MAX_VALUE);
  assert.equal(maximum.rank, ranks.at(-1));
  assert.equal(maximum.nextRank, null);
  assert.equal(maximum.diamonds, Number.MAX_SAFE_INTEGER);
  assert.equal(maximum.percent, 100);
  assert.equal(maximum.remaining, 0);
  assert.equal(maximum.required, 0);
});

function viewerFixture() {
  const state = createDefaultState();
  state.settings.account.uid = "rank-test-owner";
  state.settings.tiktok.username = "rank_creator";
  const store = { state, mutateRuntime(callback) { callback(state); } };
  return { state, service: new ViewerService({ store, clock: () => "2026-10-13T10:00:00.000Z" }) };
}

function viewerEvent(type, data = {}) {
  return {
    id: `rank-test-${type}`, type, source: "source_tiktok",
    timestamp: "2026-10-13T10:00:00.000Z",
    user: { id: "rank-viewer", name: "rank_viewer", displayName: "Viewer de test" },
    data
  };
}

test("le rang de la base utilise la valeur unitaire du cadeau multipliée par sa quantité", () => {
  const { service } = viewerFixture();
  assert.equal(service.recordEvent(viewerEvent("gift", { value: 5, count: 3 })), true);
  let row = service.snapshot().rows[0];
  assert.equal(row.gifts, 3);
  assert.equal(row.diamonds, 15);
  assert.equal(row.rank, rankForDiamonds(15));
  service.recordEvent(viewerEvent("gift", { value: 2, count: 20 }));
  row = service.snapshot().rows[0];
  assert.equal(row.gifts, 23);
  assert.equal(row.diamonds, 55);
  assert.equal(row.rank, rankForDiamonds(55));
});

test("likes, commentaires, partages, follows et abonnements ne font pas progresser le rang", () => {
  const { service } = viewerFixture();
  service.recordEvent(viewerEvent("gift", { value: 1, count: 1 }));
  const before = service.snapshot().rows[0];
  for (const type of ["like", "chat", "share", "follow", "subscribe", "join"]) {
    assert.equal(service.recordEvent(viewerEvent(type, {
      value: ranks.at(-1).minimum, count: 1000, message: "Interaction de test"
    })), true);
    const row = service.snapshot().rows[0];
    assert.equal(row.diamonds, before.diamonds, `aucun diamant attribué pour ${type}`);
    assert.equal(row.rank, before.rank, `aucun rang attribué pour ${type}`);
  }
  const row = service.snapshot().rows[0];
  assert.equal(row.likes, 1000);
  assert.equal(row.comments, 1);
  assert.equal(row.shares, 1000);
  assert.equal(row.events, 7);
});

test("une contribution invalide reste à zéro et les grands compteurs sont bornés sans perdre le rang", () => {
  const { service } = viewerFixture();
  service.recordEvent(viewerEvent("gift", { value: Infinity, count: 1 }));
  assert.equal(service.snapshot().rows[0].diamonds, 0);
  assert.equal(service.snapshot().rows[0].rank, ranks[0]);
  service.recordEvent(viewerEvent("gift", { value: Number.MAX_SAFE_INTEGER, count: 2 }));
  const row = service.snapshot().rows[0];
  assert.equal(row.diamonds, Number.MAX_SAFE_INTEGER);
  assert.equal(row.rank, ranks.at(-1));
});

test("l'import conserve les contributions et recalcule le rang sans addition lors d'un second import", () => {
  const original = viewerFixture().service;
  const minimum = ranks[Math.floor(ranks.length / 2)].minimum;
  original.recordEvent(viewerEvent("gift", { value: minimum, count: 3 }));
  const payload = original.export();
  const expected = original.snapshot().rows[0];
  assert.equal(payload.rows[0].rank, undefined, "un export stocke les contributions, pas un rang arbitraire");
  payload.rows[0].rank = { id: ranks.at(-1).id, minimum: 0 };
  const imported = viewerFixture().service;
  imported.import(payload);
  imported.import(JSON.stringify(payload));
  const row = imported.snapshot().rows[0];
  assert.equal(imported.snapshot().total, 1);
  assert.equal(row.diamonds, expected.diamonds);
  assert.equal(row.gifts, expected.gifts);
  assert.equal(row.rank, rankForDiamonds(expected.diamonds));
  assert.equal(imported.export().rows[0].rank, undefined);
});
