"use strict";

/** Hôte historique : domaine « coin-pusher ». Déclarations chargées avant l’orchestrateur host.js. */
function resetCoinPusher() {
  game = {
    coins: [],
    score: 0,
    roundSeconds: Math.max(
      60,
      Math.round(Number(settings.roundDurationMinutes || 15) * 60)
    ),
    paused: false,
    multiplier: 1,
    status: "Manche prête"
  };
  dropCoinPusherCoins(18, "Départ", false);
  renderCoinPusher();
}

function dropCoinPusherCoins(count = 1, label = "Pièces ajoutées", rerender = true) {
  const safeCount = Math.max(1, Math.min(80, Math.round(Number(count) || 1)));
  const maximum = Math.max(80, Math.min(10000, Number(settings.maxCoins || 1000)));
  for (let index = 0; index < safeCount; index += 1) {
    game.coins.push({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      x: 9 + Math.random() * 82,
      y: 14 + Math.random() * 62,
      delay: Math.random() * 0.45,
      tone: Math.floor(Math.random() * 3)
    });
  }
  game.coins = game.coins.slice(-maximum);
  game.score += Math.round(safeCount * Number(game.multiplier || 1));
  game.status = `${label} · +${safeCount}`;
  if (rerender) renderCoinPusher();
}

function pushCoinPusher() {
  const released = Math.max(1, Math.round(game.coins.length * 0.08));
  game.score += released * Number(game.multiplier || 1);
  game.status = `Poussoir activé · ${released} pièce${released > 1 ? "s" : ""} marquée${released > 1 ? "s" : ""}`;
  renderCoinPusher();
}

function renderCoinPusher() {
  const duration = `${Math.max(1.2, 4 / Number(settings.pusherSpeed || 1))}s`;
  root.innerHTML = `<div class="game-shell coin-pusher-shell theme-${escapeHtml(settings.theme)}">
    <section class="game-stage coin-pusher-stage">
      <div class="stage-content">
        <header class="stage-header">
          <div><small>COIN PUSHER LIVE</small><h1>Coin Pusher</h1></div>
          <div class="host-header-actions">
            <button class="secondary" data-coin-command="pause">${game.paused ? "Reprendre" : "Pause"}</button>
            <button class="primary" data-coin-command="start">Nouvelle manche</button>
          </div>
        </header>
        <div class="coin-scoreboard">
          <span><small>SCORE DE MANCHE</small><strong>${formatNumber(game.score)}</strong></span>
          <span><small>PIÈCES SUR LE PLATEAU</small><strong>${formatNumber(game.coins.length)} / ${formatNumber(settings.maxCoins)}</strong></span>
          <span><small>ÉTAT</small><strong>${escapeHtml(game.paused ? "En pause" : game.status)}</strong></span>
        </div>
        <div class="coin-machine" style="--pusher-duration:${duration};--coin-scale:${escapeHtml(settings.coinScale)}">
          <div class="coin-machine-sign"><span>SHEN</span><b>PUSHER</b><i>LIVE</i></div>
          <div class="coin-machine-window">
            <div class="coin-pusher-arm ${game.paused ? "paused" : ""}"><span></span></div>
            <div class="coin-platform">
              ${game.coins.map((coin) => `<i class="coin-token tone-${coin.tone}" style="--coin-x:${coin.x}%;--coin-y:${coin.y}%;--coin-delay:${coin.delay}s">SP</i>`).join("")}
            </div>
            <div class="coin-drop-zone"><span>ZONE DE GAIN</span></div>
          </div>
          <div class="coin-machine-base"><span></span><b>${settings.theme === "galactic-palace" ? "GALACTIC PALACE" : "ARCADE CLASSIC"}</b><span></span></div>
        </div>
        <section class="coin-quick-controls">
          <button data-coin-command="drop-one"><strong>＋1</strong><small>Ajouter une pièce</small></button>
          <button data-coin-command="drop-ten"><strong>＋10</strong><small>Pluie de pièces</small></button>
          <button data-coin-command="push"><strong>⇆</strong><small>Pousser le plateau</small></button>
          <button data-coin-command="mystery"><strong>?</strong><small>Pièce mystère</small></button>
          <button data-coin-command="reset"><strong>↻</strong><small>Réinitialiser</small></button>
        </section>
      </div>
    </section>
    ${renderCoinPusherSettings()}
  </div>`;
}

function renderCoinPusherSettings() {
  return `<aside class="settings-panel">
    <small>CONFIGURATION GLOBALE</small>
    <h2>Réglages Coin Pusher</h2>
    <p>Le plateau utilise les réglages du profil actif. Les associations cadeaux restent disponibles dans ShenPulse.</p>
    <form id="coin-settings">
      <label class="field"><span>Thème</span><select name="theme"><option value="arcade" ${settings.theme === "arcade" ? "selected" : ""}>Arcade classique</option><option value="galactic-palace" ${settings.theme === "galactic-palace" ? "selected" : ""}>Palais galactique</option></select></label>
      <label class="field"><span>Durée d’une manche (minutes)</span><input name="roundDurationMinutes" type="number" min="1" max="180" value="${escapeHtml(settings.roundDurationMinutes)}"></label>
      <label class="field"><span>Joueurs récompensés</span><input name="topN" type="number" min="1" max="10" value="${escapeHtml(settings.topN)}"></label>
      <label class="field"><span>Capacité du plateau</span><input name="maxCoins" type="number" min="80" max="10000" step="20" value="${escapeHtml(settings.maxCoins)}"></label>
      <label class="field"><span>Vitesse du poussoir</span><input name="pusherSpeed" type="range" min="0.5" max="2" step="0.1" value="${escapeHtml(settings.pusherSpeed)}"></label>
      <label class="field"><span>Taille des pièces</span><input name="coinScale" type="range" min="0.6" max="2.2" step="0.1" value="${escapeHtml(settings.coinScale)}"></label>
      <label class="field"><span>Volume</span><input name="volume" type="range" min="0" max="1" step="0.05" value="${escapeHtml(settings.volume)}"></label>
      <label class="settings-toggle"><input name="sideLossEnabled" type="checkbox" ${settings.sideLossEnabled ? "checked" : ""}><span>Activer les pertes latérales</span></label>
      <div class="settings-actions">
        <button class="primary" type="submit">Enregistrer les réglages</button>
        <button class="secondary" type="button" data-coin-command="drop-ten">Test : pluie de pièces</button>
        <button class="secondary" type="button" data-coin-command="reset">Nouvelle manche</button>
      </div>
    </form>
  </aside>`;
}

