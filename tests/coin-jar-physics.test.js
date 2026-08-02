"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  giftDiameter,
  createGeometry,
  createBody,
  leftWallAt,
  rightWallAt,
  floorAt,
  constrainToJar,
  step
} = require("../resources/overlays/coin-jar-physics");

const COIN_JAR_MODELS = [
  "fantasy",
  "football",
  "gaming-retro",
  "gaming-modern",
  "magic-alchemy",
  "cyberpunk",
  "kawaii",
  "pirate-treasure",
  "halloween",
  "winter-christmas",
  "luxury-casino",
  "manga-anime",
  "enchanted-forest",
  "space"
];

function coinJarAsset(model, layer) {
  const name = model === "fantasy"
    ? layer === "back"
      ? "jar-test-back-clean-localized.png"
      : "jar-test-front-smooth8.png"
    : `jar-${model}-${layer}.png`;
  return path.join(
    __dirname,
    "..",
    "resources",
    "overlays",
    "media",
    "widgets",
    "coin-jar",
    name
  );
}

function pngDimensions(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.equal(header.toString("ascii", 1, 4), "PNG");
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function spawnGift(bodies, geometry, value, random) {
  const diameter = giftDiameter(value, geometry.width);
  const radius = diameter * 0.43;
  const body = createBody({
    x:
      geometry.centerX +
      (random() - 0.5) *
        Math.max(0, geometry.mouthRight - geometry.mouthLeft - diameter),
    y: -radius - random() * geometry.height * 0.035,
    vx: (random() - 0.5) * geometry.width * 0.28,
    vy: geometry.height * (0.05 + random() * 0.08),
    radius,
    angle: (random() - 0.5) * 120,
    angularVelocity: (random() - 0.5) * 120
  });
  body.testValue = value;
  body.visualDiameter = diameter;
  bodies.push(body);
  return body;
}

function discardSpilled(bodies, result) {
  for (let index = bodies.length - 1; index >= 0; index -= 1) {
    if (bodies[index].state !== "spilled") continue;
    result.spilled += 1;
    bodies.splice(index, 1);
  }
}

function runBurst(
  bodies,
  geometry,
  { count, value, random, cadence = 0.014, frameTime = 1 / 60 },
  result
) {
  let spawned = 0;
  let elapsed = 0;
  let nextSpawn = 0;
  while (spawned < count) {
    while (spawned < count && nextSpawn <= elapsed + 1e-9) {
      spawnGift(bodies, geometry, value, random);
      spawned += 1;
      nextSpawn += cadence;
    }
    step(bodies, geometry, frameTime);
    discardSpilled(bodies, result);
    elapsed += frameTime;
  }
}

function settle(
  bodies,
  geometry,
  result,
  { frameTime = 1 / 60, maximumFrames = 1800 } = {}
) {
  for (let frame = 1; frame <= maximumFrames; frame += 1) {
    step(bodies, geometry, frameTime);
    discardSpilled(bodies, result);
    if (
      bodies.every(
        (body) => body.state === "contained" && body.sleeping
      )
    ) {
      result.settleFrames.push(frame);
      return;
    }
  }
  const remaining = bodies.filter((body) => !body.sleeping);
  assert.fail(
    `${remaining.length} cadeau(x) encore actif(s) après ${maximumFrames} frames`
  );
}

function snapshot(bodies) {
  return bodies.map((body) => ({
    body,
    x: body.x,
    y: body.y,
    angle: body.angle
  }));
}

function assertSnapshotUnchanged(stable) {
  for (const position of stable) {
    assert.equal(position.body.x, position.x);
    assert.equal(position.body.y, position.y);
    assert.equal(position.body.angle, position.angle);
  }
}

function changedSnapshotPositions(stable, threshold = 0.05) {
  return stable.filter(
    (position) =>
      Math.hypot(
        position.body.x - position.x,
        position.body.y - position.y
      ) > threshold
  ).length;
}

function assertStablePile(bodies, geometry) {
  assert.ok(bodies.length > 0);
  assert.ok(
    bodies.every(
      (body) => body.state === "contained" && body.sleeping
    )
  );

  for (const body of bodies) {
    const sampleY = Math.max(geometry.wallTop, body.y);
    assert.ok(
      body.x - body.radius >= leftWallAt(geometry, sampleY) - 0.001,
      "le cercle physique doit rester à droite de la paroi gauche"
    );
    assert.ok(
      body.x + body.radius <= rightWallAt(geometry, sampleY) + 0.001,
      "le cercle physique doit rester à gauche de la paroi droite"
    );
    assert.ok(
      body.y + body.radius <= floorAt(geometry, body.x) + 0.001,
      "le cercle physique ne doit pas traverser le fond"
    );
  }

  for (let left = 0; left < bodies.length; left += 1) {
    for (let right = left + 1; right < bodies.length; right += 1) {
      const first = bodies[left];
      const second = bodies[right];
      const radiusSum = first.radius + second.radius;
      const distance = Math.hypot(
        first.x - second.x,
        first.y - second.y
      );
      const transparentImageMargin = radiusSum * 0.55 + 0.05;
      assert.ok(
        distance + transparentImageMargin >= radiusSum,
        "deux images cadeaux visibles ne doivent pas se chevaucher"
      );
    }
  }
}

test("les cadeaux prennent plus de place selon leur valeur en pièces", () => {
  const rose = giftDiameter(1, 500);
  const small = giftDiameter(5, 500);
  const medium = giftDiameter(100, 500);
  const premium = giftDiameter(10000, 500);

  assert.ok(rose >= 16 && rose <= 20);
  assert.ok(small >= rose * 1.45);
  assert.ok(medium >= small * 1.5);
  assert.ok(premium >= medium * 1.5);
  assert.ok(premium <= 90);
});

test("la géométrie reste volontairement à l'intérieur du masque commun", () => {
  const geometry = createGeometry(500, 500);

  assert.equal(geometry.mouthLeft, 155);
  assert.equal(geometry.mouthRight, 345);
  assert.ok(leftWallAt(geometry, 250) <= 112.5);
  assert.ok(rightWallAt(geometry, 250) >= 387.5);
  assert.equal(geometry.floorY, 457.5);
});

test("un cadeau n'est contenu qu'une fois entièrement passé sous le col", () => {
  const geometry = createGeometry(500, 500);
  const radius = 10;
  const body = createBody({
    x: geometry.centerX,
    y: geometry.mouthTop + radius - 0.01,
    radius
  });

  constrainToJar(body, geometry);
  assert.equal(body.state, "entering");

  body.y = geometry.mouthTop + radius + 0.01;
  constrainToJar(body, geometry);
  assert.equal(body.state, "contained");
});

test("les parois et le fond retiennent les cadeaux contenus", () => {
  const geometry = createGeometry(500, 500);
  const radius = 12;
  const left = createBody({
    x: 0,
    y: 280,
    vx: -200,
    radius,
    state: "contained"
  });
  const right = createBody({
    x: 500,
    y: 280,
    vx: 200,
    radius,
    state: "contained"
  });
  const floor = createBody({
    x: geometry.centerX,
    y: geometry.floorY + 100,
    vy: 500,
    radius,
    state: "contained"
  });

  constrainToJar(left, geometry);
  constrainToJar(right, geometry);
  constrainToJar(floor, geometry);

  assert.equal(left.x, leftWallAt(geometry, 280) + radius);
  assert.equal(right.x, rightWallAt(geometry, 280) - radius);
  assert.equal(floor.y, floorAt(geometry, floor.x) - radius);
});

for (const value of [1, 5]) {
  test(
    `200 cadeaux value=${value}, puis +1 et +5, restent naturels et stables`,
    { timeout: 120000 },
    () => {
      const geometry = createGeometry(500, 500);
      const bodies = [];
      const random = seededRandom(7300 + value);
      const result = { spilled: 0, settleFrames: [] };

      runBurst(
        bodies,
        geometry,
        { count: 200, value, random },
        result
      );
      settle(bodies, geometry, result);
      assertStablePile(bodies, geometry);

      const firstPile = snapshot(bodies);
      const spillsBeforeSingle = result.spilled;
      runBurst(
        bodies,
        geometry,
        { count: 1, value, random, cadence: 0.072 },
        result
      );
      settle(bodies, geometry, result);
      if (bodies.length > firstPile.length) {
        assert.ok(
          changedSnapshotPositions(firstPile) > 0,
          "le nouvel impact doit pouvoir rearranger localement la pile"
        );
      } else {
        assert.ok(
          result.spilled > spillsBeforeSingle,
          "un bocal plein doit laisser deborder le cadeau surnumeraire"
        );
      }

      const secondPile = snapshot(bodies);
      const spillsBeforeBurst = result.spilled;
      runBurst(
        bodies,
        geometry,
        { count: 5, value, random, cadence: 0.072 },
        result
      );
      settle(bodies, geometry, result);
      if (bodies.length > secondPile.length) {
        assert.ok(
          changedSnapshotPositions(secondPile) > 0,
          "une rafale doit repartir naturellement sur les cadeaux au repos"
        );
      } else {
        assert.ok(
          result.spilled > spillsBeforeBurst,
          "une rafale surnumeraire doit deborder sans comprimer la pile"
        );
      }
      assertStablePile(bodies, geometry);

      const finalPile = snapshot(bodies);
      for (let frame = 0; frame < 120; frame += 1) {
        step(bodies, geometry, 1 / 60);
      }
      assertSnapshotUnchanged(finalPile);
      assert.equal(
        bodies.some((body) => body.state === "entering"),
        false
      );
    }
  );
}

test(
  "une rafale premium est plus grande et se repartit sans tour centrale",
  { timeout: 120000 },
  () => {
    const geometry = createGeometry(500, 500);
    const bodies = [];
    const result = { spilled: 0, settleFrames: [] };
    const random = seededRandom(44999);

    runBurst(
      bodies,
      geometry,
      { count: 120, value: 1, random },
      result
    );
    settle(bodies, geometry, result);
    const basePile = snapshot(bodies);

    runBurst(
      bodies,
      geometry,
      { count: 24, value: 1000, random, cadence: 0.034 },
      result
    );
    settle(bodies, geometry, result);
    assertStablePile(bodies, geometry);

    const premium = bodies.filter((body) => body.testValue === 1000);
    assert.ok(premium.length >= 18, "la majorite des cadeaux premium doit entrer");
    assert.ok(
      premium.every(
        (body) => body.visualDiameter >= giftDiameter(1, 500) * 3
      ),
      "la valeur en pieces doit produire une difference de taille evidente"
    );
    const premiumLeft = Math.min(...premium.map((body) => body.x));
    const premiumRight = Math.max(...premium.map((body) => body.x));
    assert.ok(
      premiumRight - premiumLeft >= geometry.width * 0.24,
      "les gros cadeaux doivent rouler sur une largeur visible"
    );
    const centralBand = premium.filter(
      (body) => Math.abs(body.x - geometry.centerX) <= geometry.width * 0.055
    );
    assert.ok(
      centralBand.length < premium.length * 0.65,
      "les gros cadeaux ne doivent pas former une colonne centrale"
    );
    assert.ok(
      changedSnapshotPositions(basePile) >= 4,
      "les impacts premium doivent rearranger localement la base"
    );
  }
);

test(
  "240 petits cadeaux remplissent une surface large jusqu'aux deux parois",
  { timeout: 120000 },
  () => {
    const geometry = createGeometry(500, 500);
    const bodies = [];
    const result = { spilled: 0, settleFrames: [] };
    const random = seededRandom(720520);

    runBurst(
      bodies,
      geometry,
      { count: 240, value: 1, random },
      result
    );
    settle(bodies, geometry, result);
    assertStablePile(bodies, geometry);

    const visualRadius = giftDiameter(1, geometry.width) / 2;
    const visibleLeft = Math.min(...bodies.map((body) => body.x - visualRadius));
    const visibleRight = Math.max(...bodies.map((body) => body.x + visualRadius));
    const visibleBottom = Math.max(...bodies.map((body) => body.y + visualRadius));
    assert.ok(
      visibleLeft <= geometry.width * 0.255,
      `la surface doit atteindre le bord gauche (x=${visibleLeft})`
    );
    assert.ok(
      visibleRight >= geometry.width * 0.745,
      `la surface doit atteindre le bord droit (x=${visibleRight})`
    );
    assert.ok(
      visibleBottom >= geometry.floorY,
      `les images doivent couvrir le fond visible (y=${visibleBottom})`
    );

    const surfaceTops = Array.from({ length: 5 }, (_, index) => {
      const left = geometry.width * (0.235 + index * 0.106);
      const right = left + geometry.width * 0.106;
      const inColumn = bodies.filter(
        (body) => body.x + visualRadius >= left && body.x - visualRadius <= right
      );
      assert.ok(inColumn.length > 0, `colonne de remplissage ${index + 1} vide`);
      return Math.min(...inColumn.map((body) => body.y - visualRadius));
    });
    assert.ok(
      Math.max(...surfaceTops) - Math.min(...surfaceTops) <= geometry.height * 0.16,
      `la surface doit rester large et non pyramidale (${surfaceTops.join(", ")})`
    );
  }
);

test(
  "le solveur converge aussi avec des frames de 8, 33 et 50 ms",
  { timeout: 120000 },
  () => {
    for (const frameTime of [0.008, 0.033, 0.05]) {
      const geometry = createGeometry(500, 500);
      const bodies = [];
      const result = { spilled: 0, settleFrames: [] };
      const random = seededRandom(Math.round(frameTime * 100000));
      runBurst(
        bodies,
        geometry,
        {
          count: 40,
          value: 5,
          random,
          cadence: 0.014,
          frameTime
        },
        result
      );
      settle(bodies, geometry, result, { frameTime });
      assertStablePile(bodies, geometry);
    }
  }
);

test("un cadeau bloqué dans le col est renversé au lieu de trembler", () => {
  const geometry = createGeometry(500, 500);
  const radius = giftDiameter(5, 500) / 2;
  const blocker = createBody({
    x: geometry.centerX,
    y: geometry.mouthTop + radius * 2.5,
    radius,
    state: "contained",
    sleeping: true,
    restX: geometry.centerX,
    restY: geometry.mouthTop + radius * 2.5
  });
  const entering = createBody({
    x: geometry.centerX,
    y: geometry.mouthTop - radius,
    radius,
    vy: 50
  });

  const blockerStartY = blocker.y;
  for (let frame = 0; frame < 600; frame += 1) {
    step([blocker, entering], geometry, 1 / 60);
    if ([blocker, entering].every((body) => body.sleeping)) break;
  }

  assert.equal(entering.state, "contained");
  assert.equal(blocker.sleeping, true);
  assert.ok(blocker.y > blockerStartY + radius * 4);
});

test("les bords du cadeau, pas seulement son centre, doivent tenir dans le col", () => {
  const geometry = createGeometry(500, 500);
  const radius = giftDiameter(5, 500) / 2;
  const wedged = createBody({
    x: geometry.mouthLeft + radius - 0.5,
    y: geometry.wallTop - radius - 0.01,
    radius,
    state: "contained"
  });

  constrainToJar(wedged, geometry);

  assert.equal(wedged.state, "spilled");
});

test("les 14 designs partagent exactement le même canevas", () => {
  for (const model of COIN_JAR_MODELS) {
    const back = coinJarAsset(model, "back");
    const front = coinJarAsset(model, "front");
    assert.ok(fs.existsSync(back), `${model}: calque arrière manquant`);
    assert.ok(fs.existsSync(front), `${model}: calque avant manquant`);
    assert.deepEqual(pngDimensions(back), [1254, 1254], `${model}: arrière`);
    assert.deepEqual(pngDimensions(front), [1254, 1254], `${model}: avant`);
  }
});

test(
  "500 cadeaux remplissent le bocal du fond jusqu'au col sans instabilité",
  { timeout: 120000 },
  () => {
    const geometry = createGeometry(500, 500);
    const bodies = [];
    const result = { spilled: 0, settleFrames: [] };
    const random = seededRandom(12500);

    runBurst(
      bodies,
      geometry,
      { count: 500, value: 1, random },
      result
    );
    settle(bodies, geometry, result, { maximumFrames: 2400 });
    assertStablePile(bodies, geometry);

    const top = Math.min(...bodies.map((body) => body.y - body.radius));
    const bottom = Math.max(...bodies.map((body) => body.y + body.radius));
    const left = Math.min(...bodies.map((body) => body.x - body.radius));
    const right = Math.max(...bodies.map((body) => body.x + body.radius));
    assert.ok(bodies.length >= 250, "le bocal doit rester densément rempli");
    assert.ok(result.spilled > 0, "le surplus doit déborder par le col");
    assert.ok(
      top <= geometry.wallTop,
      `la pile doit atteindre le col du bocal (sommet=${top})`
    );
    assert.ok(
      bottom >= geometry.floorY - 0.01,
      "la pile doit reposer sur le fond"
    );
    assert.ok(
      left <= geometry.width * 0.225 + 0.01,
      "la pile doit atteindre la paroi gauche"
    );
    assert.ok(
      right >= geometry.width * 0.775 - 0.01,
      "la pile doit atteindre la paroi droite"
    );
  }
);
