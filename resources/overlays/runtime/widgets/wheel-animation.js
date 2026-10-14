"use strict";

/** Rotation de la roue, file des tirages, gagnant et son synchronisé. */

function spinWheel(payload) {
  if (wheelSpinActive) {
    wheelSpinQueue.push(payload);
    return;
  }
  wheelSpinActive = true;
  revealOverlay();
  wheelSoundStopper?.();
  wheelSoundStopper = null;
  const wheel = document.getElementById("wheel");
  const winner = document.getElementById("wheel-winner");
  const choices = payload.choices || [];
  const settings = { ...(payload.settings || {}), design: payload.design };
  applyWheelSettings(settings);
  if (choices.length) drawWheel(choices, payload.colors || []);
  const stage = document.getElementById("wheel-stage");
  const winnerIndex = Number.isInteger(payload.winnerIndex)
    ? payload.winnerIndex
    : Math.max(0, choices.indexOf(payload.winner));
  const segmentAngle = choices.length ? 360 / choices.length : 0;
  const stopAngle = 360 - (winnerIndex + 0.5) * segmentAngle;
  wheel.style.setProperty("--wheel-spin-rotation", `${360 * 7 + stopAngle}deg`);
  wheel.classList.remove("spinning");
  winner.classList.remove("visible");
  stage?.classList.remove("idle-hidden", "wheel-exiting");
  stage?.classList.add(
    "wheel-entering",
    `entrance-${wheelRuntimeSettings.entranceAnimation || "zoom"}`
  );
  void wheel.offsetWidth;
  wheel.classList.add("spinning");
  const spinSeconds = Math.min(
    30,
    Math.max(1, Number(wheelRuntimeSettings.spinDuration || 6))
  );
  const waitSeconds = Math.max(
    0,
    Number(wheelRuntimeSettings.waitDuration || 0)
  );
  const resultSeconds = Math.min(
    30,
    Math.max(1, Number(wheelRuntimeSettings.resultDuration || 4))
  );
  wheel.style.animationDelay = "0s";
  let tickTimer = null;
  let audioContext = null;
  const startSpinSound = () => {
    try {
      audioContext = new AudioContext();
      tickTimer = setInterval(() => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = 520;
        gain.gain.setValueAtTime(0.025, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + 0.035
        );
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.04);
      }, 125);
    } catch {
      audioContext = null;
    }
  };
  if (wheelBoolean(wheelRuntimeSettings.soundActive, true)) {
    startSpinSound();
  }
  const stopSpinSound = () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    audioContext?.close().catch(() => {});
    audioContext = null;
  };
  wheelSoundStopper = stopSpinSound;
  setTimeout(() => {
    stopSpinSound();
    if (wheelSoundStopper === stopSpinSound) wheelSoundStopper = null;
  }, spinSeconds * 1000);
  setTimeout(() => {
    winner.textContent = payload.winner || "Surprise !";
    if (wheelBoolean(wheelRuntimeSettings.showWinner, true)) {
      winner.classList.add("visible");
    }
    if (!wheelBoolean(wheelRuntimeSettings.alwaysVisible, true)) {
      setTimeout(() => {
        stage?.classList.add(
          "wheel-exiting",
          `exit-${wheelRuntimeSettings.exitAnimation || "fade"}`
        );
        setTimeout(() => stage?.classList.add("idle-hidden"), 650);
      }, resultSeconds * 1000);
    }
  }, (
    spinSeconds +
    Math.max(0, Number(wheelRuntimeSettings.waitDuration || 0))
  ) * 1000);
  setTimeout(() => {
    wheelSpinActive = false;
    const nextPayload = wheelSpinQueue.shift();
    if (nextPayload) spinWheel(nextPayload);
  }, (
    spinSeconds +
    waitSeconds +
    resultSeconds
  ) * 1000 + 700);
}
