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
    const base = width * 0.034;
    const scaled = base * (1 + Math.log10(value) * 0.82);
    return clamp(scaled, width * 0.032, width * 0.18);
  }

  function createGeometry(width = REFERENCE_SIZE, height = REFERENCE_SIZE) {
    const safeWidth = Math.max(120, finiteNumber(width, REFERENCE_SIZE));
    const safeHeight = Math.max(120, finiteNumber(height, REFERENCE_SIZE));
    return {
      width: safeWidth,
      height: safeHeight,
      centerX: safeWidth * 0.5,
      mouthTop: safeHeight * 0.075,
      mouthLeft: safeWidth * 0.31,
      mouthRight: safeWidth * 0.69,
      wallTop: safeHeight * 0.17,
      floorY: safeHeight * 0.915,
      gravity: safeHeight * 4.35
    };
  }

  function leftWallAt(geometry, y) {
    const verticalRange = Math.max(1, geometry.floorY - geometry.wallTop);
    const progress = clamp((y - geometry.wallTop) / verticalRange, 0, 1);
    let ratio;
    if (progress < 0.2) {
      ratio = 0.31 - 0.085 * (progress / 0.2);
    } else {
      const bottomCurve = clamp((progress - 0.72) / 0.28, 0, 1);
      ratio = 0.225 + 0.025 * bottomCurve * bottomCurve;
    }
    return geometry.width * ratio;
  }

  function rightWallAt(geometry, y) {
    return geometry.width - leftWallAt(geometry, y);
  }

  function floorAt(geometry, x) {
    const halfInterior = geometry.width * 0.27;
    const horizontal = Math.abs(x - geometry.centerX) / halfInterior;
    const corner = clamp((horizontal - 0.7) / 0.3, 0, 1);
    return geometry.floorY - geometry.height * 0.055 * Math.pow(corner, 1.8);
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
      supported: false,
      supportFrames: Math.max(0, finiteNumber(options.supportFrames)),
      entrySupportFrames: Math.max(
        0,
        finiteNumber(options.entrySupportFrames)
      ),
      stationaryFrames: Math.max(
        0,
        finiteNumber(options.stationaryFrames)
      ),
      contactPenetration: 0,
      frameStartX: finiteNumber(options.x),
      frameStartY: finiteNumber(options.y, -radius),
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

  function wakeBody(body) {
    if (!body.sleeping) return false;
    body.sleeping = false;
    body.supported = false;
    body.supportFrames = 0;
    body.stationaryFrames = 0;
    body.contactPenetration = 0;
    body.restX = null;
    body.restY = null;
    return true;
  }

  function spillBody(body, geometry) {
    const spillRight = body.x >= geometry.centerX;
    body.state = "spilled";
    body.sleeping = false;
    body.x = spillRight
      ? geometry.mouthRight + body.radius * 0.45
      : geometry.mouthLeft - body.radius * 0.45;
    body.y = Math.min(body.y, geometry.wallTop - body.radius - 1);
    body.vx = geometry.width * (spillRight ? 0.2 : -0.2);
    body.vy = -geometry.height * 0.12;
    body.angularVelocity = spillRight ? 55 : -55;
    body.restX = null;
    body.restY = null;
  }

  function enforceJarCapacity(bodies, geometry) {
    const maximumFootprint = geometry.width * geometry.height * 0.318;
    const contained = bodies.filter((body) => body.state === "contained");
    let footprint = contained.reduce(
      (total, body) => total + Math.PI * body.radius * body.radius,
      0
    );
    if (footprint <= maximumFootprint) return 0;

    contained.sort((left, right) => left.y - right.y);
    let spilled = 0;
    for (const body of contained) {
      if (footprint <= maximumFootprint) break;
      footprint -= Math.PI * body.radius * body.radius;
      spillBody(body, geometry);
      spilled += 1;
    }
    return spilled;
  }

  function markJarState(body, geometry) {
    if (body.state === "spilled") return;
    const safelyInsideMouth =
      body.x - body.radius >= geometry.mouthLeft &&
      body.x + body.radius <= geometry.mouthRight;

    if (
      body.state === "entering" &&
      body.y - body.radius >= geometry.mouthTop &&
      safelyInsideMouth
    ) {
      body.state = "contained";
      return;
    }

    const completelyAboveWalls =
      body.state === "contained" &&
      body.y + body.radius < geometry.wallTop;
    const outsideOpening =
      body.x - body.radius < geometry.mouthLeft ||
      body.x + body.radius > geometry.mouthRight;
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
        if (body.vx < 0) body.vx = -body.vx * 0.08;
        touched = true;
      } else if (body.x > openingRight) {
        body.x = openingRight;
        if (body.vx > 0) body.vx = -body.vx * 0.08;
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
        if (body.vx < 0) body.vx = -body.vx * 0.08;
        body.angularVelocity += Math.abs(body.vy) * 0.012;
        touched = true;
      } else if (body.x > right) {
        body.x = right;
        if (body.vx > 0) body.vx = -body.vx * 0.08;
        body.angularVelocity -= Math.abs(body.vy) * 0.012;
        touched = true;
      }
    }

    const floor = floorAt(geometry, body.x) - body.radius;
    if (body.y > floor) {
      body.y = floor;
      if (body.vy > 0) body.vy = -body.vy * 0.04;
      if (Math.abs(body.vy) < geometry.height * 0.012) body.vy = 0;
      body.vx *= 0.9985;
      body.angularVelocity *= 0.996;
      body.supported = true;
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
    const relativeX = right.vx - left.vx;
    const relativeY = right.vy - left.vy;
    const normalSpeed = relativeX * normalX + relativeY * normalY;
    const wakeThreshold = Math.max(12, minimumDistance * 0.45);
    if (normalSpeed < -wakeThreshold) {
      if (left.sleeping && !right.sleeping) wakeBody(left);
      if (right.sleeping && !left.sleeping) wakeBody(right);
    }
    if (!left.sleeping) {
      left.contactPenetration = Math.max(left.contactPenetration, overlap);
    }
    if (!right.sleeping) {
      right.contactPenetration = Math.max(right.contactPenetration, overlap);
    }
    const inverseLeftMass = left.sleeping ? 0 : 1 / left.mass;
    const inverseRightMass = right.sleeping ? 0 : 1 / right.mass;
    const inverseMassTotal = inverseLeftMass + inverseRightMass;
    const correction = Math.max(0, overlap - 0.01) / inverseMassTotal * 0.985;

    left.x -= normalX * correction * inverseLeftMass;
    left.y -= normalY * correction * inverseLeftMass;
    right.x += normalX * correction * inverseRightMass;
    right.y += normalY * correction * inverseRightMass;

    if (normalY > 0.28 && !left.sleeping) left.supported = true;
    if (normalY < -0.28 && !right.sleeping) right.supported = true;

    let normalImpulse = 0;
    if (normalSpeed < 0) {
      normalImpulse = -(1.035 * normalSpeed) / inverseMassTotal;
      left.vx -= normalImpulse * normalX * inverseLeftMass;
      left.vy -= normalImpulse * normalY * inverseLeftMass;
      right.vx += normalImpulse * normalX * inverseRightMass;
      right.vy += normalImpulse * normalY * inverseRightMass;
    }

    const tangentX = -normalY;
    const tangentY = normalX;
    const tangentSpeed = relativeX * tangentX + relativeY * tangentY;
    const desiredFriction = -tangentSpeed / inverseMassTotal;
    const frictionLimit = Math.abs(normalImpulse) * 0.14 + overlap * 0.045;
    const frictionImpulse = clamp(
      desiredFriction,
      -frictionLimit,
      frictionLimit
    );
    left.vx -= frictionImpulse * tangentX * inverseLeftMass;
    left.vy -= frictionImpulse * tangentY * inverseLeftMass;
    right.vx += frictionImpulse * tangentX * inverseRightMass;
    right.vy += frictionImpulse * tangentY * inverseRightMass;

    if (normalSpeed < 0) {
      if (!left.sleeping) left.angularVelocity -= tangentSpeed * 0.0012;
      if (!right.sleeping) right.angularVelocity += tangentSpeed * 0.0012;
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

  function step(bodies, geometry, elapsedSeconds) {
    const elapsed = clamp(finiteNumber(elapsedSeconds, 1 / 60), 1 / 240, 1 / 30);
    const substeps = Math.max(2, Math.ceil(elapsed / (1 / 120)));
    const delta = elapsed / substeps;
    const movingBodies = bodies.reduce(
      (total, body) =>
        total + (!body.sleeping && body.state !== "spilled" ? 1 : 0),
      0
    );
    const airborneBodies = bodies.reduce(
      (total, body) =>
        total +
        (!body.sleeping && body.state !== "spilled" && !body.supported ? 1 : 0),
      0
    );
    const collisionIterations =
      movingBodies >= 100 ? 24 : movingBodies >= 30 ? 16 : 10;

    for (const body of bodies) {
      body.supported = false;
      body.contactPenetration = 0;
      body.frameStartX = body.x;
      body.frameStartY = body.y;
    }

    for (let substep = 0; substep < substeps; substep += 1) {
      for (const body of bodies) {
        if (body.sleeping) {
          restoreSleepingBody(body);
          continue;
        }
        body.vy += geometry.gravity * delta;
        body.vx *= Math.pow(0.982, delta * 60);
        body.angularVelocity *= Math.pow(
          body.state === "contained" ? 0.94 : 0.985,
          delta * 60
        );
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
        for (const body of bodies) {
          if (!body.sleeping) body.contactPenetration = 0;
        }
        for (const body of bodies) constrainToJar(body, geometry);
        resolveBodyCollisions(bodies, geometry);
        for (const body of bodies) restoreSleepingBody(body);
      }
      for (const body of bodies) constrainToJar(body, geometry);
      for (const body of bodies) restoreSleepingBody(body);
    }

    let activity = 0;
    let falling = false;
    let active = 0;
    for (const body of bodies) {
      markJarState(body, geometry);
      if (body.sleeping) continue;
      if (body.state === "entering") {
        body.entrySupportFrames = body.supported
          ? body.entrySupportFrames + 1
          : 0;
        if (body.entrySupportFrames >= 18) {
          spillBody(body, geometry);
          active += 1;
          falling = true;
          continue;
        }
      } else {
        body.entrySupportFrames = 0;
      }
      const restingContact =
        body.supported || body.contactPenetration > 0.01;
      if (body.state === "contained" && restingContact) {
        body.vx *= 0.92;
        body.vy *= 0.72;
        body.angularVelocity *= 0.84;
        body.supportFrames += 1;
        const visibleDrift = Math.hypot(
          body.x - body.frameStartX,
          body.y - body.frameStartY
        );
        if (visibleDrift <= geometry.width * 0.0001) {
          body.stationaryFrames += 1;
        } else {
          body.stationaryFrames = Math.max(0, body.stationaryFrames - 2);
        }
        const kineticActivity = Math.max(
          Math.abs(body.vx),
          Math.abs(body.vy),
          Math.abs(body.angularVelocity) * body.radius
        );
        const readyForSleep =
          (body.supportFrames >= 10 && body.stationaryFrames >= 8) ||
          (body.supportFrames >= 30 &&
            kineticActivity <= geometry.width * 0.004);
        if (
          readyForSleep &&
          airborneBodies <= 6
        ) {
          body.sleeping = true;
          body.restX = body.x;
          body.restY = body.y;
          body.vx = 0;
          body.vy = 0;
          body.angularVelocity = 0;
          continue;
        }
      } else {
        body.supportFrames = 0;
        body.stationaryFrames = 0;
      }
      active += 1;
      activity = Math.max(
        activity,
        Math.abs(body.vx),
        Math.abs(body.vy),
        Math.abs(body.angularVelocity) * body.radius
      );
      if (body.state === "entering" || body.state === "spilled") falling = true;
    }

    const capacitySpills = enforceJarCapacity(bodies, geometry);
    if (capacitySpills > 0) {
      active += capacitySpills;
      falling = true;
      activity = Math.max(activity, geometry.width * 0.2);
    }

    return { activity, falling, active };
  }

  return {
    giftDiameter,
    createGeometry,
    createBody,
    leftWallAt,
    rightWallAt,
    floorAt,
    constrainToJar,
    step
  };
});
