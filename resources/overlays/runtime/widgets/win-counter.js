"use strict";

/** Compteur WINS : valeur absolue, incréments, multiplicateur et couleurs. */

function renderWinCounter({ animate = false } = {}) {
  const current = document.getElementById("win-counter-value");
  const target = document.getElementById("win-counter-target");
  if (current) {
    current.textContent = String(winCounter);
    current.style.color = winCounter < 0
      ? winCounterNegativeColor
      : winCounter > 0
        ? winCounterPositiveColor
        : winCounterNeutralColor;
    if (animate) {
      current.classList.remove("pulse");
      void current.offsetWidth;
      current.classList.add("pulse");
    }
  }
  if (target) target.textContent = formatNumber(winCounterTarget);
  const content = document.querySelector(".win-counter-content");
  if (content) {
    content.style.translate = `${winCounterLabelX}px ${winCounterLabelY}px`;
  }
}

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
