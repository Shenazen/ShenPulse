"use strict";

/** Compte à rebours standard et multiplicateur, indépendants des autres widgets. */

function updateTimer(payload = {}) {
  revealOverlay();
  const operation = String(payload.operation || "add");
  const synchronizedSeconds = Number(payload.remainingSeconds);
  const synchronizedEndsAt = Number(payload.endsAt);
  if (Number.isFinite(synchronizedSeconds)) {
    timerPaused = payload.paused === true;
    timerSeconds = Math.max(
      0,
      !timerPaused && synchronizedEndsAt > 0
        ? Math.ceil((synchronizedEndsAt - Date.now()) / 1000)
        : synchronizedSeconds
    );
  } else if (operation === "set") {
    timerSeconds = Math.max(0, Number(payload.seconds || 0));
    timerPaused = payload.paused === true;
  } else if (operation === "reset") {
    timerSeconds = 0;
    timerPaused = false;
  } else if (operation === "pause") {
    timerPaused = true;
  } else if (operation === "resume") {
    timerPaused = false;
  } else {
    timerSeconds = Math.max(0, timerSeconds + Number(payload.seconds || 0));
  }
  const isMultiplierTimer = viewName === "multiplier-timer";
  const label = document.getElementById(
    isMultiplierTimer ? "multiplier-timer-label" : "timer-label"
  );
  if (label) {
    label.textContent =
      overlayTitle ||
      payload.label ||
      (isMultiplierTimer ? "BONUS ACTIF" : "TEMPS RESTANT");
  }
  renderTimer();
  ensureTimerTicker();
}

function ensureTimerTicker() {
  if (timerHandle) return;
  timerHandle = setInterval(() => {
    if (!timerPaused && timerSeconds > 0) timerSeconds -= 1;
    renderTimer();
  }, 1000);
}

function updateMultiplierTimer(payload = {}) {
  if (viewName !== "multiplier-timer") return;
  multiplierValue = Math.max(
    1,
    Math.round(Number(payload.multiplier || multiplierValue || 2))
  );
  updateTimer(payload);
}

function renderTimer() {
  const hours = Math.floor(timerSeconds / 3600);
  const minutes = Math.floor((timerSeconds % 3600) / 60);
  const seconds = String(timerSeconds % 60).padStart(2, "0");
  const value = showHours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${String(hours * 60 + minutes).padStart(2, "0")}:${seconds}`;
  const element = document.getElementById(
    viewName === "multiplier-timer"
      ? "multiplier-timer-value"
      : "timer-value"
  );
  if (element) {
    element.textContent = value;
    element.classList.toggle("paused", timerPaused);
  }
  const multiplier = document.getElementById("multiplier-value");
  if (multiplier) multiplier.textContent = `X${multiplierValue}`;
}
