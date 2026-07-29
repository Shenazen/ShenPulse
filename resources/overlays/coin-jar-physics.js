"use strict";

(function exposeCoinJarPhysics(root, factory) {
  const physics = factory();
  if (typeof module === "object" && module.exports) module.exports = physics;
  if (root) root.CoinJarPhysics = physics;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const REFERENCE_SIZE = 500;

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function giftDiameter(coins, stageWidth = REFERENCE_SIZE) {
    const width = Math.max(120, finiteNumber(stageWidth, REFERENCE_SIZE));
    const value = Math.max(1, finiteNumber(coins, 1));
    const base = width * 0.026;
    const scaled = base * (1 + Math.log10(value) * 0.72);
    return clamp(scaled, width * 0.025, width * 0.15);
  }

  function createGeometry(width = REFERENCE_SIZE, height = REFERENCE_SIZE) {
    const safeWidth = Math.max(120, finiteNumber(width, REFERENCE_SIZE));
    const safeHeight = Math.max(120, finiteNumber(height, REFERENCE_SIZE));
    return {
      width: safeWidth,
      height: safeHeight,
      centerX: safeWidth * 0.5,
      mouthTop: safeHeight * 0.08,
      mouthLeft: safeWidth * 0.285,
      mouthRight: safeWidth * 0.715,
      wallTop: safeHeight * 0.185,
      floorY: safeHeight * 0.865,
      gravity: safeHeight * 4.35
    };
  }

  function leftWallAt(geometry, y) {
    const verticalRange = Math.max(1, geometry.floorY - geometry.wallTop);
    const progress = clamp((y - geometry.wallTop) / verticalRange, 0, 1);
    let ratio;
    if (progress < 0.2) {
      ratio = 0.285 - 0.052 * (progress / 0.2);
    } else {
      const bottomCurve = clamp((progress - 0.74) / 0.26, 0, 1);
      ratio = 0.233 + 0.025 * bottomCurve * bottomCurve;
    }
    return geometry.width * ratio;
  }

  function rightWallAt(geometry, y) {
    return geometry.width - leftWallAt(geometry, y);
  }

  function floorAt(geometry, x) {
    const halfInterior = geometry.width * 0.267;
    const horizontal = Math.abs(x - geometry.centerX) / halfInterior;
    const corner = clamp((horizontal - 0.7) / 0.3, 0, 1);
    return geometry.floorY - geometry.height * 0.052 * Math.pow(corner, 1.8);
  }

  function createBody(options = {}) {
    const radius = Math.max(2, finiteNumber(options.radius, 12));
    const state = ["entering", "contained", "spilled"].includes(options.state)
      ? options.state
      : "entering";
    return {
      x: finiteNumber(options.x),
      y: finiteNumber(options.y, -radius),
      vx: finiteNumber(options.vx),
      vy: finiteNumber(options.vy),
      radius,
      mass: Math.max(1, radius * radius),
      angle: finiteNumber(options.angle),
      angularVelocity: finiteNumber(options.angularVelocity),
      state,
      sleeping: state === "contained" && Boolean(options.sleeping),
      restX: Number.isFinite(Number(options.restX))
        ? Number(options.restX)
        : null,
      restY: Number.isFinite(Number(options.restY))
        ? Number(options.restY)
        : null
    };
  }

  function restoreSleepingBody(body) {
    if (!body.sleeping) return;
    if (Number.isFinite(body.restX)) body.x = body.restX;
    if (Number.isFinite(body.restY)) body.y = body.restY;
    body.vx = 0;
    body.vy = 0;
    body.angularVelocity = 0;
  }

  function markJarState(body, geometry) {
    if (body.state === "spilled") return;
    const safelyInsideMouth =
      body.x - body.radius >= geometry.mouthLeft &&
      body.x + body.radius <= geometry.mouthRight;

    if (
      body.state === "entering" &&
      body.y + body.radius >= geometry.mouthTop &&
      safelyInsideMouth
    ) {
      body.state = "contained";
      return;
    }

    const completelyAboveWalls =
      body.state === "contained" &&
      body.y + body.radius < geometry.wallTop;
    const outsideOpening =
      body.x < geometry.mouthLeft || body.x > geometry.mouthRight;
    if (completelyAboveWalls && outsideOpening) body.state = "spilled";
  }

  function constrainToJar(body, geometry) {
    if (body.state === "spilled") return false;
    let touched = false;
    if (
      body.state === "entering" &&
      body.y + body.radius >= geometry.mouthTop
    ) {
      const openingLeft = geometry.mouthLeft + body.radius;
      const openingRight = geometry.mouthRight - body.radius;
      if (body.x < openingLeft) {
        body.x = openingLeft;
        if (body.vx < 0) body.vx = -body.vx * 0.18;
        touched = true;
      } else if (body.x > openingRight) {
        body.x = openingRight;
        if (body.vx > 0) body.vx = -body.vx * 0.18;
        touched = true;
      }
    }
    const reachesWalls = body.y + body.radius >= geometry.wallTop;

    if (reachesWalls) {
      const sampleY = Math.max(geometry.wallTop, body.y);
      const left = leftWallAt(geometry, sampleY) + body.radius;
      const right = rightWallAt(geometry, sampleY) - body.radius;
      if (body.x < left) {
        body.x = left;
        if (body.vx < 0) body.vx = -body.vx * 0.24;
        body.angularVelocity += Math.abs(body.vy) * 0.012;
        touched = true;
      } else if (body.x > right) {
        body.x = right;
        if (body.vx > 0) body.vx = -body.vx * 0.24;
        body.angularVelocity -= Math.abs(body.vy) * 0.012;
        touched = true;
      }
    }

    const floor = floorAt(geometry, body.x) - body.radius;
    if (body.y > floor) {
      body.y = floor;
      if (body.vy > 0) body.vy = -body.vy * 0.12;
      if (Math.abs(body.vy) < geometry.height * 0.012) body.vy = 0;
      body.vx *= 0.82;
      body.angularVelocity *= 0.82;
      touched = true;
    }

    markJarState(body, geometry);
    return touched;
  }

  function resolvePair(left, right) {
    if (left.state === "spilled" || right.state === "spilled") return false;
    if (left.sleeping && right.sleeping) return false;
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const minimumDistance = left.radius + right.radius;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimumDistance * minimumDistance) return false;

    const distance = Math.sqrt(distanceSquared) || 0.0001;
    const normalX = distanceSquared ? dx / distance : 1;
    const normalY = distanceSquared ? dy / distance : 0;
    const overlap = minimumDistance - distance;
    const inverseLeftMass = left.sleeping ? 0 : 1 / left.mass;
    const inverseRightMass = right.sleeping ? 0 : 1 / right.mass;
    const inverseMassTotal = inverseLeftMass + inverseRightMass;
    const correction = Math.max(0, overlap - 0.02) / inverseMassTotal * 0.96;

    left.x -= normalX * correction * inverseLeftMass;
    left.y -= normalY * correction * inverseLeftMass;
    right.x += normalX * correction * inverseRightMass;
    right.y += normalY * correction * inverseRightMass;

    const relativeX = right.vx - left.vx;
    const relativeY = right.vy - left.vy;
    const normalSpeed = relativeX * normalX + relativeY * normalY;
    if (normalSpeed < 0) {
      const impulse =
        -(1.18 * normalSpeed) / inverseMassTotal;
      left.vx -= impulse * normalX * inverseLeftMass;
      left.vy -= impulse * normalY * inverseLeftMass;
      right.vx += impulse * normalX * inverseRightMass;
      right.vy += impulse * normalY * inverseRightMass;

      const tangentSpeed = relativeX * -normalY + relativeY * normalX;
      if (!left.sleeping) left.angularVelocity -= tangentSpeed * 0.002;
      if (!right.sleeping) right.angularVelocity += tangentSpeed * 0.002;
    }
    return true;
  }

  function resolveBodyCollisions(bodies, geometry) {
    if (bodies.length < 2) return;
    const largestRadius = bodies.reduce(
      (largest, body) =>
        body.state === "spilled" ? largest : Math.max(largest, body.radius),
      geometry.width * 0.022
    );
    const cellSize = Math.max(12, largestRadius * 2.05);
    const cells = new Map();

    for (let index = 0; index < bodies.length; index += 1) {
      const body = bodies[index];
      if (body.state === "spilled") continue;
      const cellX = Math.floor(body.x / cellSize);
      const cellY = Math.floor(body.y / cellSize);
      const key = `${cellX}:${cellY}`;
      const cell = cells.get(key);
      if (cell) cell.push(index);
      else cells.set(key, [index]);
    }

    for (const [key, indexes] of cells) {
      const [cellX, cellY] = key.split(":").map(Number);
      for (const leftIndex of indexes) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const neighbors = cells.get(`${cellX + offsetX}:${cellY + offsetY}`);
            if (!neighbors) continue;
            for (const rightIndex of neighbors) {
              if (rightIndex <= leftIndex) continue;
              resolvePair(bodies[leftIndex], bodies[rightIndex]);
            }
          }
        }
      }
    }
  }

  function packedYAtX(body, x, placed, geometry) {
    let y = floorAt(geometry, x) - body.radius;
    for (const support of placed) {
      const horizontal = x - support.x;
      const minimumDistance = body.radius + support.radius;
      if (Math.abs(horizontal) >= minimumDistance) continue;
      const vertical = Math.sqrt(
        Math.max(0, minimumDistance * minimumDistance - horizontal * horizontal)
      );
      y = Math.min(y, support.y - vertical);
    }

    if (y + body.radius >= geometry.wallTop) {
      const wallY = Math.max(geometry.wallTop, y);
      if (
        x - body.radius < leftWallAt(geometry, wallY) ||
        x + body.radius > rightWallAt(geometry, wallY)
      ) {
        return null;
      }
    } else if (
      x - body.radius < geometry.mouthLeft ||
      x + body.radius > geometry.mouthRight
    ) {
      return null;
    }
    return y;
  }

  function packContainedBodies(bodies, geometry) {
    const anchored = bodies.filter(
      (body) => body.state === "contained" && body.sleeping
    );
    for (const body of anchored) restoreSleepingBody(body);
    const contained = bodies
      .filter((body) => body.state === "contained" && !body.sleeping)
      .sort((left, right) => right.y - left.y);
    const placed = [...anchored];
    let spilled = 0;

    for (let index = 0; index < contained.length; index += 1) {
      const body = contained[index];
      const minimumX = geometry.width * 0.215 + body.radius;
      const maximumX = geometry.width * 0.785 - body.radius;
      const stepX = Math.max(3.5, body.radius * 0.72);
      const candidates = [clamp(body.x, minimumX, maximumX)];
      const offset = (index % 7) / 7 * stepX;
      for (let x = minimumX + offset; x <= maximumX; x += stepX) {
        candidates.push(x);
      }

      let best = null;
      for (const x of candidates) {
        const y = packedYAtX(body, x, placed, geometry);
        if (y === null) continue;
        if (
          !best ||
          y > best.y + 0.01 ||
          (Math.abs(y - best.y) <= 0.01 &&
            Math.abs(x - body.x) < Math.abs(best.x - body.x))
        ) {
          best = { x, y };
        }
      }

      if (!best || best.y - body.radius < geometry.mouthTop) {
        const spillRight = body.x >= geometry.centerX;
        body.state = "spilled";
        body.x = spillRight
          ? geometry.mouthRight + body.radius * 0.35
          : geometry.mouthLeft - body.radius * 0.35;
        body.y = geometry.wallTop - body.radius - 1;
        body.vx = geometry.width * (spillRight ? 0.24 : -0.24);
        body.vy = -geometry.height * 0.08;
        body.angularVelocity = spillRight ? 45 : -45;
        body.sleeping = false;
        body.restX = null;
        body.restY = null;
        spilled += 1;
        continue;
      }

      body.x = best.x;
      body.y = best.y;
      body.vx = 0;
      body.vy = 0;
      body.angularVelocity = 0;
      body.sleeping = true;
      body.restX = body.x;
      body.restY = body.y;
      placed.push(body);
    }
    return { packed: placed.length, spilled };
  }

  function step(bodies, geometry, elapsedSeconds) {
    const elapsed = clamp(finiteNumber(elapsedSeconds, 1 / 60), 1 / 240, 1 / 30);
    const substeps = Math.max(2, Math.ceil(elapsed / (1 / 120)));
    const delta = elapsed / substeps;
    const collisionIterations = bodies.length >= 100 ? 4 : 3;

    for (let substep = 0; substep < substeps; substep += 1) {
      for (const body of bodies) {
        if (body.sleeping) {
          restoreSleepingBody(body);
          continue;
        }
        body.vy += geometry.gravity * delta;
        body.vx *= Math.pow(0.992, delta * 60);
        if (body.state === "contained") body.angularVelocity = 0;
        else body.angularVelocity *= Math.pow(0.985, delta * 60);
        body.x += body.vx * delta;
        body.y += body.vy * delta;
        body.angle += body.angularVelocity * delta;
        markJarState(body, geometry);
      }

      for (
        let iteration = 0;
        iteration < collisionIterations;
        iteration += 1
      ) {
        for (const body of bodies) constrainToJar(body, geometry);
        resolveBodyCollisions(bodies, geometry);
        for (const body of bodies) restoreSleepingBody(body);
      }
      for (const body of bodies) constrainToJar(body, geometry);
      for (const body of bodies) restoreSleepingBody(body);
    }

    let activity = 0;
    let falling = false;
    for (const body of bodies) {
      markJarState(body, geometry);
      if (body.state === "contained") body.angularVelocity = 0;
      if (body.sleeping) continue;
      activity = Math.max(
        activity,
        Math.abs(body.vx),
        Math.abs(body.vy),
        Math.abs(body.angularVelocity) * body.radius
      );
      if (body.state === "entering" || body.state === "spilled") falling = true;
    }
    return { activity, falling };
  }

  return {
    giftDiameter,
    createGeometry,
    createBody,
    leftWallAt,
    rightWallAt,
    floorAt,
    constrainToJar,
    packContainedBodies,
    step
  };
});
