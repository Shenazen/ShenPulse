"use strict";

/** Compteur WINS : valeur absolue, incréments, multiplicateur et couleurs. */

function renderWinCounter({ animate = false } = {}) {
  const current = document.getElementById("win-counter-value");
  const target = document.getElementById("win-counter-target");
  if (current) {
    const text = current.firstElementChild || current;
    text.textContent = String(winCounter);
    current.style.color = winCounter < 0
      ? winCounterNegativeColor
      : winCounter > 0
        ? winCounterPositiveColor
        : winCounterNeutralColor;
    if (animate) {
      text.classList.remove("pulse");
      void text.offsetWidth;
      text.classList.add("pulse");
    }
  }
  if (target) target.textContent = formatNumber(winCounterTarget);
  applyWinCounterAppearance();
  fitWinCounterText();
}

function applyWinCounterAppearance(payload = null) {
  const style = document.documentElement.style;
  for (const part of ["Title", "Value", "Goal"]) {
    const key = `winCounter${part}Scale`;
    const previous = Number(style.getPropertyValue(`--wins-${part.toLowerCase()}-scale`)) * 100 || Number(parameters.get(key)) || 100;
    const value = payload ? previewNumber(payload, key, previous, 50, 400) : previous;
    style.setProperty(`--wins-${part.toLowerCase()}-scale`, String(Math.min(400, Math.max(50, value)) / 100));
  }
  for (const part of ["Title", "Goal"]) {
    const property = `--wins-${part.toLowerCase()}-color`;
    const value = payload
      ? payload[`winCounter${part}Color`] || payload.textColor || style.getPropertyValue(property)
      : style.getPropertyValue(property) || parameters.get(`winCounter${part}Color`) || parameters.get("textColor");
    style.setProperty(property, value || "#ffffff");
  }
}

function fitWinCounterText() {
  if (viewName !== "win-counter") return;
  for (const id of ["win-counter-title", "win-counter-value", "win-counter-goal"]) {
    const zone = document.getElementById(id);
    const text = zone?.firstElementChild;
    if (!text || !zone.clientWidth || !zone.clientHeight) continue;
    const fit = Math.min(1,
      Math.max(1, zone.clientWidth - 12) / Math.max(1, text.offsetWidth),
      Math.max(1, zone.clientHeight - 4) / Math.max(1, text.offsetHeight));
    text.style.setProperty("--wins-text-fit", String(fit));
  }
}

document.fonts?.ready?.then(fitWinCounterText);

function updateWinCounter(payload = {}) {
  revealOverlay();
  const operation = String(payload.operation || "adjust");
  const amount = Number(payload.amount || 0);
  const synchronizedCurrent = Number(payload.current);
  const previousCounter = winCounter;
  if (Number.isFinite(synchronizedCurrent)) {
    winCounter = allowNegative
      ? synchronizedCurrent
      : Math.max(0, synchronizedCurrent);
  } else if (operation === "multiplier") {
    winCounterMultiplier = Math.max(1, Math.abs(amount) || 2);
    if (winCounterMultiplierTimer) clearTimeout(winCounterMultiplierTimer);
    winCounterMultiplierTimer = setTimeout(() => {
      winCounterMultiplier = 1;
      winCounterMultiplierTimer = null;
    }, Math.max(1, Number(payload.durationSeconds || 60)) * 1000);
  } else if (operation === "reset") {
    winCounter = 0;
  } else if (operation === "set") {
    winCounter = allowNegative ? amount : Math.max(0, amount);
  } else {
    const signedAmount =
      operation === "random" && Math.random() < 0.5
        ? -Math.abs(amount)
        : amount;
    const nextValue = winCounter + signedAmount * winCounterMultiplier;
    winCounter = allowNegative ? nextValue : Math.max(0, nextValue);
  }
  renderWinCounter({ animate: winCounter !== previousCounter });
  if (typeof addMyAction === "function") {
    addMyAction({
      icon: "★",
      title:
        operation === "multiplier"
          ? `WINS X${winCounterMultiplier}`
          : `${amount >= 0 ? "+" : ""}${amount} WINS`,
      detail: payload.viewer
        ? `Déclenché par ${payload.viewer}`
        : "Compteur Mont Chiliad"
    });
  }
}
