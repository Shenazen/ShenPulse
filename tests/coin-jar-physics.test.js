"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function spawnGift(bodies, geometry, value, random) {
  const diameter = giftDiameter(value, geometry.width);
  const radius = diameter / 2;
  const body = createBody({
    x:
      geometry.centerX +
      (random() - 0.5) *
        Math.max(
          diameter,
          geometry.mouthRight - geometry.mouthLeft - diameter * 2.4
        ),
    y: -radius - random() * geometry.height * 0.035,
    vx: (random() - 0.5) * geometry.width * 0.13,
    vy: geometry.height * (0.05 + random() * 0.08),
    radius,
    angle: (random() - 0.5) * 120,
    angularVelocity: (random() - 0.5) * 120
  });
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
      const invisibleImageMargin = radiusSum * 0.08 + 0.05;
      assert.ok(
        distance + invisibleImageMargin >= radiusSum,
        "deux images cadeaux visibles ne doivent pas se chevaucher"
      );
    }
  }
}

test("les cadeaux prennent plus de place selon leur valeur en pièces", () => {
  const rose = giftDiameter(1, 500);
  const medium = giftDiameter(100, 500);
  const premium = giftDiameter(10000, 500);

  assert.ok(rose <= 16);
  assert.ok(medium > rose);
  assert.ok(premium > medium);
  assert.ok(premium <= 75);
});

test("la géométrie reste volontairement à l'intérieur du masque fantasy", () => {
  const geometry = createGeometry(500, 500);

  assert.equal(geometry.mouthLeft, 167.5);
  assert.equal(geometry.mouthRight, 332.5);
  assert.ok(leftWallAt(geometry, 250) >= 132.5);
  assert.ok(rightWallAt(geometry, 250) <= 367.5);
  assert.equal(geometry.floorY, 430);
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
      runBurst(
        bodies,
        geometry,
        { count: 1, value, random, cadence: 0.072 },
        result
      );
      settle(bodies, geometry, result);
      assertSnapshotUnchanged(firstPile);

      const secondPile = snapshot(bodies);
      runBurst(
        bodies,
        geometry,
        { count: 5, value, random, cadence: 0.072 },
        result
      );
      settle(bodies, geometry, result);
      assertSnapshotUnchanged(secondPile);
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

  for (let frame = 0; frame < 120; frame += 1) {
    step([blocker, entering], geometry, 1 / 60);
    if (entering.state === "spilled") break;
  }

  assert.equal(entering.state, "spilled");
  assert.equal(blocker.sleeping, true);
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
