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
  packContainedBodies,
  step
} = require("../resources/overlays/coin-jar-physics");

test("les cadeaux prennent plus de place selon leur valeur en pièces", () => {
  const rose = giftDiameter(1, 500);
  const medium = giftDiameter(100, 500);
  const premium = giftDiameter(10000, 500);

  assert.ok(rose <= 16, "une Rose à une pièce doit rester petite");
  assert.ok(medium > rose);
  assert.ok(premium > medium);
  assert.ok(premium <= 75, "un cadeau premium ne doit pas boucher seul le bocal");
});

test("un cadeau contenu repose sur le vrai fond et ne traverse pas le bocal", () => {
  const geometry = createGeometry(500, 500);
  const body = createBody({
    x: geometry.centerX,
    y: geometry.floorY + 100,
    vy: 500,
    radius: 12,
    state: "contained"
  });

  constrainToJar(body, geometry);

  assert.equal(body.y, floorAt(geometry, body.x) - body.radius);
  assert.equal(body.state, "contained");
});

test("les parois retiennent les cadeaux tant qu'ils sont dans le bocal", () => {
  const geometry = createGeometry(500, 500);
  const y = 280;
  const radius = 12;
  const left = createBody({
    x: 0,
    y,
    vx: -200,
    radius,
    state: "contained"
  });
  const right = createBody({
    x: 500,
    y,
    vx: 200,
    radius,
    state: "contained"
  });

  constrainToJar(left, geometry);
  constrainToJar(right, geometry);

  assert.equal(left.x, leftWallAt(geometry, y) + radius);
  assert.equal(right.x, rightWallAt(geometry, y) - radius);
  assert.equal(left.state, "contained");
  assert.equal(right.state, "contained");
});

test("un cadeau ne devient renversé qu'après être ressorti par l'ouverture", () => {
  const geometry = createGeometry(500, 500);
  const inside = createBody({
    x: geometry.mouthLeft - 40,
    y: geometry.wallTop + 30,
    radius: 10,
    state: "contained"
  });
  constrainToJar(inside, geometry);
  assert.equal(inside.state, "contained");

  const aboveOpening = createBody({
    x: geometry.mouthLeft - 20,
    y: geometry.wallTop - 20,
    radius: 8,
    state: "contained"
  });
  constrainToJar(aboveOpening, geometry);
  assert.equal(aboveOpening.state, "spilled");
});

test("la gravité remplit le bocal depuis son fond", () => {
  const geometry = createGeometry(500, 500);
  const bodies = Array.from({ length: 8 }, (_value, index) =>
    createBody({
      x: geometry.centerX + (index % 2 ? 8 : -8),
      y: -20 - index * 18,
      radius: 11
    })
  );

  for (let frame = 0; frame < 360; frame += 1) {
    step(bodies, geometry, 1 / 60);
  }

  assert.ok(bodies.every((body) => body.state === "contained"));
  assert.ok(
    bodies.every(
      (body) => body.y + body.radius <= floorAt(geometry, body.x) + 0.001
    )
  );
  assert.ok(
    bodies.some(
      (body) =>
        body.y + body.radius >= geometry.floorY - geometry.height * 0.08
    ),
    "au moins un cadeau doit être posé au fond"
  );
});

test("une rafale de 500 Roses conserve 500 cadeaux visibles sans chevauchement", () => {
  const geometry = createGeometry(500, 500);
  const radius = giftDiameter(1, 500) / 2;
  const bodies = Array.from({ length: 500 }, (_value, index) =>
    createBody({
      x: 120 + (index * 73) % 260,
      y: 430 - (index % 24) * 8,
      radius,
      angularVelocity: 90,
      state: "contained"
    })
  );

  const result = packContainedBodies(bodies, geometry);

  assert.deepEqual(result, { packed: 500, spilled: 0 });
  assert.equal(
    bodies.filter((body) => body.state === "contained").length,
    500
  );
  assert.ok(bodies.every((body) => body.angularVelocity === 0));
  assert.ok(
    bodies
      .filter((body) => body.state === "contained")
      .every((body) => {
        if (body.y + body.radius < geometry.wallTop) {
          return (
            body.x - body.radius >= geometry.mouthLeft &&
            body.x + body.radius <= geometry.mouthRight
          );
        }
        return (
          body.x - body.radius >= leftWallAt(geometry, body.y) &&
          body.x + body.radius <= rightWallAt(geometry, body.y)
        );
      }),
    "aucun cadeau ne doit dépasser des parois visibles"
  );
  for (let left = 0; left < bodies.length; left += 1) {
    for (let right = left + 1; right < bodies.length; right += 1) {
      const distance = Math.hypot(
        bodies[left].x - bodies[right].x,
        bodies[left].y - bodies[right].y
      );
      assert.ok(
        distance + 0.001 >= bodies[left].radius + bodies[right].radius
      );
    }
  }
});

test("ajouter 5 Roses après une rafale de 200 ne déplace aucun cadeau déjà posé", () => {
  const geometry = createGeometry(500, 500);
  const radius = giftDiameter(1, 500) / 2;
  const original = Array.from({ length: 200 }, (_value, index) =>
    createBody({
      x: 120 + (index * 73) % 260,
      y: 420 - (index % 18) * 10,
      radius,
      state: "contained"
    })
  );

  assert.deepEqual(
    packContainedBodies(original, geometry),
    { packed: 200, spilled: 0 }
  );
  const stablePositions = original.map(({ x, y }) => ({ x, y }));
  const additions = Array.from({ length: 5 }, (_value, index) =>
    createBody({
      x: geometry.centerX + (index - 2) * radius,
      y: geometry.wallTop + index * radius,
      radius,
      state: "contained"
    })
  );
  const bodies = [...original, ...additions];

  const result = packContainedBodies(bodies, geometry);

  assert.deepEqual(result, { packed: 205, spilled: 0 });
  assert.deepEqual(
    original.map(({ x, y }) => ({ x, y })),
    stablePositions
  );
  assert.ok(bodies.every((body) => body.sleeping));
  for (let left = 0; left < bodies.length; left += 1) {
    for (let right = left + 1; right < bodies.length; right += 1) {
      assert.ok(
        Math.hypot(
          bodies[left].x - bodies[right].x,
          bodies[left].y - bodies[right].y
        ) + 0.001 >= bodies[left].radius + bodies[right].radius
      );
    }
  }
});

test("un nouveau cadeau ne réveille pas les Roses déjà rangées", () => {
  const geometry = createGeometry(500, 500);
  const radius = giftDiameter(1, 500) / 2;
  const stable = Array.from({ length: 200 }, (_value, index) =>
    createBody({
      x: 120 + (index * 73) % 260,
      y: 420 - (index % 18) * 10,
      radius,
      state: "contained"
    })
  );
  packContainedBodies(stable, geometry);
  const stablePositions = stable.map(({ x, y }) => ({ x, y }));
  const newcomer = createBody({
    x: geometry.centerX,
    y: geometry.wallTop - radius,
    vy: 80,
    radius
  });

  for (let frame = 0; frame < 120; frame += 1) {
    step([...stable, newcomer], geometry, 1 / 60);
  }

  assert.deepEqual(
    stable.map(({ x, y }) => ({ x, y })),
    stablePositions
  );
});

test("la position de repos reste inviolable pendant toute nouvelle chute", () => {
  const geometry = createGeometry(500, 500);
  const radius = giftDiameter(1, 500) / 2;
  const stable = Array.from({ length: 200 }, (_value, index) =>
    createBody({
      x: 120 + (index * 73) % 260,
      y: 420 - (index % 18) * 10,
      radius,
      state: "contained"
    })
  );
  packContainedBodies(stable, geometry);
  const stablePositions = stable.map(({ restX, restY }) => ({
    x: restX,
    y: restY
  }));
  const newcomer = createBody({
    x: geometry.centerX,
    y: geometry.mouthTop - radius,
    vy: 120,
    radius
  });

  for (let frame = 0; frame < 180; frame += 1) {
    step([...stable, newcomer], geometry, 1 / 60);
    assert.deepEqual(
      stable.map(({ x, y }) => ({ x, y })),
      stablePositions
    );
  }
});

test("un cadeau posé dans le col est rangé même si la pile est déjà haute", () => {
  const geometry = createGeometry(500, 500);
  const radius = giftDiameter(1, 500) / 2;
  const body = createBody({
    x: geometry.centerX,
    y: geometry.mouthTop,
    radius,
    state: "entering"
  });

  constrainToJar(body, geometry);

  assert.equal(body.state, "contained");
});

test("le surplus ressort par le col une fois la capacité physique dépassée", () => {
  const geometry = createGeometry(500, 500);
  const radius = giftDiameter(1, 500) / 2;
  const bodies = Array.from({ length: 650 }, (_value, index) =>
    createBody({
      x: 120 + (index * 61) % 260,
      y: 430 - (index % 30) * 9,
      radius,
      state: "contained"
    })
  );

  const result = packContainedBodies(bodies, geometry);
  const spilled = bodies.filter((body) => body.state === "spilled");

  assert.ok(result.spilled > 0);
  assert.equal(spilled.length, result.spilled);
  assert.ok(
    spilled.every(
      (body) =>
        body.y + body.radius < geometry.wallTop &&
        (body.x < geometry.mouthLeft || body.x > geometry.mouthRight)
    )
  );
});
