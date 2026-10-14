"use strict";

/** Bocal de cadeaux : physique et rendu, chargés uniquement pour cette vue. */

function renderCoinJar() {
  const current = document.getElementById("coin-jar-current");
  const target = document.getElementById("coin-jar-target");
  const level = document.getElementById("coin-jar-level");
  const widget = document.querySelector(".coin-jar-widget");
  const meter = document.querySelector(".coin-jar-meter");
  if (current) current.textContent = formatNumber(coinJarCurrent);
  if (target) target.textContent = formatNumber(coinJarTarget);
  if (level) {
    const range = Math.max(1, coinJarTarget - coinJarMinimum);
    const progress = Math.min(
      100,
      Math.max(0, ((coinJarCurrent - coinJarMinimum) / range) * 100)
    );
    level.style.height = `${progress}%`;
  }
  widget?.classList.toggle("without-base", !showBase);
  if (meter) meter.hidden = !showGoal;
}

function updateCoinJar(payload = {}) {
  revealOverlay();
  const operation = String(payload.operation || "adjust");
  const amount = Number(payload.amount || 0);
  const minimum = coinJarMinimum;
  const synchronizedCurrent = Number(payload.current);
  coinJarCurrent = Number.isFinite(synchronizedCurrent)
    ? Math.max(minimum, synchronizedCurrent)
    : operation === "reset"
      ? minimum
      : operation === "set"
        ? Math.max(minimum, amount)
        : Math.max(minimum, coinJarCurrent + amount);
  if (operation === "reset") clearCoinJarDrops();
  renderCoinJar();
}

function spawnCoinJarDrop(event) {
  const stage = document.getElementById("coin-jar-drops");
  if (!stage) return;
  const eventId = String(event.id || "").trim();
  if (eventId && coinJarEventIds.has(eventId)) return;
  if (eventId) coinJarEventIds.add(eventId);
  const requestedCount = Number(event.data?.count || 1);
  const count = Number.isFinite(requestedCount)
    ? Math.max(1, Math.floor(requestedCount))
    : 1;
  const interval = count > 100 ? 14 : count > 20 ? 34 : 72;
  const generation = coinJarSpawnGeneration;
  const scheduleGift = (index) => {
    if (index >= count || generation !== coinJarSpawnGeneration) return;
    const timer = setTimeout(() => {
      coinJarSpawnTimers.delete(timer);
      if (generation !== coinJarSpawnGeneration) return;
      spawnCoinJarGift(stage, event, index);
      scheduleGift(index + 1);
    }, index === 0 ? 0 : interval);
    coinJarSpawnTimers.add(timer);
  };
  scheduleGift(0);
}

function coinJarGiftRandom(event, index = 0) {
  const seed = [
    event.id,
    event.timestamp,
    event.user?.id,
    event.user?.name,
    event.data?.giftId,
    event.data?.giftName,
    event.data?.value,
    event.data?.count,
    index
  ].join("|");
  let state = 2166136261;
  for (let offset = 0; offset < seed.length; offset += 1) {
    state ^= seed.charCodeAt(offset);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function currentCoinJarGeometry(stage) {
  const width = Math.max(120, stage.clientWidth || 500);
  const height = Math.max(120, stage.clientHeight || 500);
  const geometryChanged =
    coinJarGeometry &&
    (
      Math.abs(coinJarGeometry.width - width) >= 3 ||
      Math.abs(coinJarGeometry.height - height) >= 3
    );
  if (geometryChanged) {
    const scaleX = width / coinJarGeometry.width;
    const scaleY = height / coinJarGeometry.height;
    const radiusScale = Math.min(scaleX, scaleY);
    for (const gift of coinJarDrops) {
      gift.x *= scaleX;
      gift.y *= scaleY;
      gift.vx *= scaleX;
      gift.vy *= scaleY;
      gift.visualRadius = (gift.visualRadius || gift.radius) * radiusScale;
      gift.radius *= radiusScale;
      gift.containmentRadius = Math.max(
        gift.radius,
        (gift.containmentRadius || gift.visualRadius) * radiusScale
      );
      gift.mass = gift.radius * gift.radius;
      if (Number.isFinite(gift.restX)) gift.restX *= scaleX;
      if (Number.isFinite(gift.restY)) gift.restY *= scaleY;
      gift.node.style.width = `${gift.visualRadius * 2}px`;
      gift.node.style.height = `${gift.visualRadius * 2}px`;
    }
  }
  coinJarGeometry = globalThis.CoinJarPhysics.createGeometry(width, height);
  return coinJarGeometry;
}

function spawnCoinJarGift(stage, event, index = 0) {
  const geometry = currentCoinJarGeometry(stage);
  const random = coinJarGiftRandom(event, index);
  const size = globalThis.CoinJarPhysics.giftDiameter(
    event.data?.value,
    geometry.width
  );
  const visualRadius = size / 2;
  const radius = visualRadius;
  const node = document.createElement("span");
  node.className = "coin-jar-gift";
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.title = `${String(event.data?.giftName || "Cadeau")} · ${Math.max(
    1,
    Number(event.data?.value || 1)
  )} pièce(s)`;
  const imageUrl = String(event.data?.giftImageUrl || "").trim();
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = String(event.data?.giftName || "Cadeau TikTok");
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.remove();
      node.textContent = String(event.data?.giftName || "Cadeau").slice(0, 2);
      node.classList.add("coin-jar-gift-fallback");
    }, { once: true });
    node.append(image);
  } else {
    node.textContent = String(event.data?.giftName || "Cadeau").slice(0, 2);
    node.classList.add("coin-jar-gift-fallback");
  }
  (document.getElementById("coin-jar-overflow-drops") || stage).append(node);
  const body = globalThis.CoinJarPhysics.createBody({
    x:
      geometry.centerX +
      (random() - 0.5) *
        Math.max(0, geometry.mouthRight - geometry.mouthLeft - size),
    y: -visualRadius - random() * geometry.height * 0.035,
    vx: (random() - 0.5) * geometry.width * 0.28,
    vy: geometry.height * (0.05 + random() * 0.08),
    radius,
    containmentRadius: visualRadius,
    angle: (random() - 0.5) * 120,
    angularVelocity: (random() - 0.5) * 120
  });
  body.visualRadius = visualRadius;
  body.node = node;
  coinJarDrops.push(body);
  renderCoinJarGift(body);
  startCoinJarPhysics();
}

function renderCoinJarGift(gift) {
  const visualRadius = gift.visualRadius || gift.radius;
  const diameter = visualRadius * 2;
  const containedLayer = document.getElementById("coin-jar-contained-drops");
  const overflowLayer = document.getElementById("coin-jar-overflow-drops");
  const exteriorLayer = document.getElementById("coin-jar-exterior-drops");
  const fullyInsideGlass =
    gift.state === "contained" &&
    coinJarGeometry &&
    gift.y - visualRadius >= coinJarGeometry.mouthTop;
  const targetLayer = gift.state === "spilled"
    ? exteriorLayer
    : fullyInsideGlass
      ? containedLayer
      : overflowLayer;
  if (targetLayer && gift.node.parentElement !== targetLayer) {
    targetLayer.append(gift.node);
  }
  gift.node.style.transform =
    `translate3d(${gift.x - visualRadius}px, ${gift.y - visualRadius}px, 0) ` +
    `rotate(${gift.angle}deg)`;
  gift.node.classList.toggle(
    "settled",
    gift.sleeping ||
      (gift.state === "contained" &&
        Math.abs(gift.vx) + Math.abs(gift.vy) < diameter * 0.3)
  );
  gift.node.classList.toggle("spilled", gift.state === "spilled");
  gift.renderedX = gift.x;
  gift.renderedY = gift.y;
  gift.renderedAngle = gift.angle;
  gift.renderedState = gift.state;
  gift.renderedSleeping = gift.sleeping;
}

function coinJarGiftNeedsRender(gift) {
  return (
    !gift.sleeping ||
    gift.renderedX !== gift.x ||
    gift.renderedY !== gift.y ||
    gift.renderedAngle !== gift.angle ||
    gift.renderedState !== gift.state ||
    gift.renderedSleeping !== gift.sleeping
  );
}

function coinJarGiftOutsideOverlay(gift, stage) {
  if (gift.state !== "spilled") return false;
  const visualRadius = gift.visualRadius || gift.radius;
  const bounds = stage.getBoundingClientRect();
  const scaleX = bounds.width / Math.max(1, stage.clientWidth);
  const scaleY = bounds.height / Math.max(1, stage.clientHeight);
  const left = bounds.left + (gift.x - visualRadius) * scaleX;
  const right = bounds.left + (gift.x + visualRadius) * scaleX;
  const top = bounds.top + (gift.y - visualRadius) * scaleY;
  return right < 0 || left > window.innerWidth || top > window.innerHeight;
}

function animateCoinJar(timestamp) {
  coinJarAnimationFrame = 0;
  const stage = document.getElementById("coin-jar-drops");
  if (!stage || !coinJarDrops.length) {
    coinJarAnimationTimestamp = 0;
    return;
  }
  const geometry = currentCoinJarGeometry(stage);
  const elapsed = coinJarAnimationTimestamp
    ? (timestamp - coinJarAnimationTimestamp) / 1000
    : 1 / 60;
  coinJarAnimationTimestamp = timestamp;
  const motion = globalThis.CoinJarPhysics.step(
    coinJarDrops,
    geometry,
    elapsed
  );

  for (let index = coinJarDrops.length - 1; index >= 0; index -= 1) {
    const gift = coinJarDrops[index];
    if (coinJarGiftNeedsRender(gift)) renderCoinJarGift(gift);
    if (coinJarGiftOutsideOverlay(gift, stage)) {
      gift.node.remove();
      coinJarDrops.splice(index, 1);
    }
  }

  const stillMoving =
    coinJarSpawnTimers.size > 0 ||
    motion.falling ||
    motion.active > 0;
  coinJarSettledFrames = stillMoving ? 0 : coinJarSettledFrames + 1;
  if (coinJarDrops.length && coinJarSettledFrames < 36) {
    coinJarAnimationFrame = requestAnimationFrame(animateCoinJar);
  } else {
    coinJarAnimationTimestamp = 0;
  }
}

function startCoinJarPhysics() {
  coinJarSettledFrames = 0;
  if (!coinJarAnimationFrame) {
    coinJarAnimationTimestamp = 0;
    coinJarAnimationFrame = requestAnimationFrame(animateCoinJar);
  }
}

function clearCoinJarDrops() {
  coinJarSpawnGeneration += 1;
  for (const timer of coinJarSpawnTimers) clearTimeout(timer);
  coinJarSpawnTimers.clear();
  if (coinJarAnimationFrame) cancelAnimationFrame(coinJarAnimationFrame);
  coinJarAnimationFrame = 0;
  coinJarAnimationTimestamp = 0;
  coinJarSettledFrames = 0;
  for (const gift of coinJarDrops.splice(0)) gift.node.remove();
  coinJarEventIds.clear();
  coinJarGeometry = null;
}
