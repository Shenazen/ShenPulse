"use strict";

const api = window.shenPulse;
const root = document.getElementById("game-root");
const toastRegion = document.getElementById("toast-region");
const gameId = new URLSearchParams(location.search).get("gameId") || "";

let snapshot = null;
let pack = null;
let settings = null;
let game = null;
let giftCatalog = [];

const DEFAULT_DEAL_SETTINGS = Object.freeze({
  entryGift: "Rose",
  premiumGift: "TikTok Universe",
  boxValues:
    "0.01, 1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000, 25000, 50000, 75000, 100000",
  roundPattern: "6, 5, 4, 3, 2, 1",
  bankerOfferRatio: 0.72,
  premiumMultiplier: 1.5,
  cashOfferEnabled: true,
  swapEnabled: true,
  buyBoxEnabled: true,
  musicEnabled: true,
  musicVolume: 0.35,
  musicTrack: "conquest-of-paradise.mp3"
});

const DEFAULT_COIN_SETTINGS = Object.freeze({
  theme: "arcade",
  topN: 3,
  roundDurationMinutes: 15,
  pusherSpeed: 1,
  coinScale: 1,
  volume: 0.8,
  maxCoins: 1000,
  sideLossEnabled: false
});

const DEFAULT_CONNECT_SETTINGS = Object.freeze({
  columns: 7,
  rows: 6,
  winLength: 4,
  duelEntryCost: 0,
  aiEasyEntryCost: 0,
  aiHardEntryCost: 0,
  rewardsEnabled: false,
  rewards: { horizontal: 0, vertical: 0, diagonal: 0 }
});

const DEAL_MUSIC = [
  ["conquest-of-paradise.mp3", "Conquest of Paradise"],
  ["last-of-the-mohicans-promentory.mp3", "Last of the Mohicans"],
  ["titans-alexander.mp3", "Titans · Alexander"],
  ["romeo-juliet-epilogue.mp3", "Roméo & Juliette · Épilogue"],
  ["norbu-cordes.mp3", "Norbu · Cordes"],
  ["sorrow.mp3", "Sorrow"],
  ["chopin-marche-funebre.mp3", "Chopin · Marche funèbre"]
];

const soundtrack = new Audio();
soundtrack.loop = true;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numberList(value, fallback) {
  const result = String(value || "")
    .split(/[;,\n]+/)
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
  return result.length ? result : fallback;
}

function money(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value < 10 ? 2 : 0
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function giftForName(value) {
  const normalized = String(value || "").trim().toLocaleLowerCase("fr");
  return giftCatalog.find(
    (gift) => String(gift.name || "").trim().toLocaleLowerCase("fr") === normalized
  );
}

function giftField(name, label, value) {
  const gift = giftForName(value);
  return `<label class="field"><span>${escapeHtml(label)}</span><div class="host-gift-picker">
    <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" list="host-gift-options" data-host-gift autocomplete="off">
    <span data-host-gift-image>${gift?.imageUrl ? `<img src="${escapeHtml(gift.imageUrl)}" alt="">` : "🎁"}</span>
  </div></label>`;
}

function updateGiftImage(input) {
  const image = input
    ?.closest(".host-gift-picker")
    ?.querySelector("[data-host-gift-image]");
  if (!image) return;
  const gift = giftForName(input.value);
  image.innerHTML = gift?.imageUrl
    ? `<img src="${escapeHtml(gift.imageUrl)}" alt="">`
    : "🎁";
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  toastRegion.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function shuffled(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[random]] = [copy[random], copy[index]];
  }
  return copy;
}

function resetDeal() {
  const values = numberList(
    settings.boxValues,
    numberList(DEFAULT_DEAL_SETTINGS.boxValues, [])
  );
  const roundPattern = numberList(
    settings.roundPattern,
    numberList(DEFAULT_DEAL_SETTINGS.roundPattern, [])
  ).map((entry) => Math.max(1, Math.round(entry)));
  game = {
    boxes: shuffled(values).map((value, index) => ({
      id: index + 1,
      value,
      opened: false
    })),
    roundPattern,
    playerBoxId: 0,
    roundIndex: 0,
    openedInRound: 0,
    offer: 0,
    bankerRequest: "",
    bankerTargetBoxId: 0,
    status: "Choisissez votre boîte personnelle",
    result: ""
  };
  playSoundtrack();
  renderDeal();
}

function playSoundtrack() {
  if (!settings.musicEnabled) {
    soundtrack.pause();
    return;
  }
  const selected = DEAL_MUSIC.some(([file]) => file === settings.musicTrack)
    ? settings.musicTrack
    : DEAL_MUSIC[0][0];
  const source = `../assets/games/deal-or-no-deal/music/${selected}`;
  if (!soundtrack.src.endsWith(source)) soundtrack.src = source;
  soundtrack.volume = Math.min(
    1,
    Math.max(0, Number(settings.musicVolume || 0.35))
  );
  soundtrack.play().catch(() => {});
}

function closedBoxes(includePlayer = false) {
  return game.boxes.filter(
    (box) =>
      !box.opened && (includePlayer || box.id !== game.playerBoxId)
  );
}

function openBox(boxId) {
  const box = game.boxes.find((entry) => entry.id === Number(boxId));
  if (!box || box.opened || game.offer || game.result) return;
  if (!game.playerBoxId) {
    game.playerBoxId = box.id;
    game.status = `Boîte ${box.id} réservée · ouvrez les autres boîtes`;
    renderDeal();
    return;
  }
  if (box.id === game.playerBoxId) {
    toast("Cette boîte est celle du joueur.");
    return;
  }
  box.opened = true;
  game.openedInRound += 1;
  game.status = `Boîte ${box.id} ouverte : ${money(box.value)}`;
  const remaining = closedBoxes();
  if (!remaining.length) {
    finishWithPlayerBox();
    return;
  }
  const target =
    game.roundPattern[Math.min(game.roundIndex, game.roundPattern.length - 1)] ||
    1;
  if (game.openedInRound >= target) callBanker();
  renderDeal();
}

function callBanker() {
  const requests = [
    settings.cashOfferEnabled !== false ? "cash" : "",
    settings.swapEnabled !== false ? "swap" : "",
    settings.buyBoxEnabled !== false ? "buy" : ""
  ].filter(Boolean);
  game.bankerRequest =
    requests[Math.floor(Math.random() * Math.max(1, requests.length))] ||
    "cash";
  const targetCandidates = closedBoxes();
  game.bankerTargetBoxId = targetCandidates.length
    ? targetCandidates[Math.floor(Math.random() * targetCandidates.length)].id
    : 0;
  const remaining = closedBoxes(true);
  const average =
    remaining.reduce((sum, box) => sum + box.value, 0) /
    Math.max(1, remaining.length);
  const pressure =
    0.88 + Math.min(0.22, game.roundIndex * 0.035);
  game.offer = Math.max(
    0.01,
    Math.round(
      average *
        Number(settings.bankerOfferRatio || 0.72) *
        pressure *
        100
    ) / 100
  );
  game.status =
    game.bankerRequest === "swap"
      ? `Le banquier propose la boîte ${game.bankerTargetBoxId}`
      : game.bankerRequest === "buy"
        ? `Le banquier vend la boîte ${game.bankerTargetBoxId}`
        : "Le banquier attend votre décision";
}

function acceptOffer() {
  if (!game.bankerRequest) return;
  if (game.bankerRequest === "cash") {
    game.result = `DEAL accepté : ${money(game.offer)}`;
    game.status = "Partie terminée";
    renderDeal();
    return;
  }
  const player = game.boxes.find((box) => box.id === game.playerBoxId);
  const target = game.boxes.find(
    (box) => box.id === game.bankerTargetBoxId
  );
  if (player && target) {
    [player.value, target.value] = [target.value, player.value];
  }
  game.status =
    game.bankerRequest === "swap"
      ? `Échange effectué avec la boîte ${game.bankerTargetBoxId}`
      : `Boîte ${game.bankerTargetBoxId} achetée pour ${money(
          Math.max(1, game.offer * 0.18)
        )}`;
  game.offer = 0;
  game.bankerRequest = "";
  game.bankerTargetBoxId = 0;
  game.roundIndex += 1;
  game.openedInRound = 0;
  renderDeal();
}

function refuseOffer() {
  if (!game.bankerRequest) return;
  game.offer = 0;
  game.bankerRequest = "";
  game.bankerTargetBoxId = 0;
  game.roundIndex += 1;
  game.openedInRound = 0;
  game.status = "NO DEAL · la manche continue";
  renderDeal();
}

function finishWithPlayerBox() {
  const player = game.boxes.find((box) => box.id === game.playerBoxId);
  if (player) player.opened = true;
  game.result = `Boîte du joueur : ${money(player?.value || 0)}`;
  game.offer = 0;
  game.bankerRequest = "";
  game.status = "Partie terminée";
  renderDeal();
}

function premiumBox() {
  const candidates = closedBoxes();
  if (!candidates.length) return;
  const target = [...candidates].sort((left, right) => right.value - left.value)[0];
  openBox(target.id);
}

function renderDeal() {
  root.innerHTML = `<div class="game-shell">
    <section class="game-stage">
      <div class="stage-content">
        <header class="stage-header">
          <div><small>JEU LIVE SHENPULSE</small><h1>DealOrNoDeal</h1></div>
          <button class="primary" data-command="reset">Nouvelle partie</button>
        </header>
        <div class="board-status">
          <span><small>État</small><strong>${escapeHtml(game.status)}</strong></span>
          <span><small>Manche</small><strong>${Math.min(game.roundIndex + 1, game.roundPattern.length)} / ${game.roundPattern.length}</strong></span>
          <span><small>Boîte joueur</small><strong>${game.playerBoxId ? `N° ${game.playerBoxId}` : "À choisir"}</strong></span>
        </div>
        <div class="boxes-grid">
          ${game.boxes
            .map(
              (box) => `<button class="deal-box ${
                box.opened ? "opened" : ""
              } ${box.id === game.playerBoxId ? "player" : ""}" data-box="${
                box.id
              }" ${box.opened || game.result ? "disabled" : ""}>
                <b>${box.id}</b>
                <span>${
                  box.opened
                    ? money(box.value)
                    : box.id === game.playerBoxId
                      ? "VOTRE BOÎTE"
                      : "FERMÉE"
                }</span>
              </button>`
            )
            .join("")}
        </div>
        ${
          game.bankerRequest || game.result
            ? `<section class="banker-panel">
                <span class="phone">☎</span>
                <div><small>${game.result ? "RÉSULTAT" : "OFFRE DU BANQUIER"}</small><strong>${escapeHtml(
                  game.result ||
                    (game.bankerRequest === "swap"
                      ? `Échange avec la boîte ${game.bankerTargetBoxId}`
                      : game.bankerRequest === "buy"
                        ? `Boîte ${game.bankerTargetBoxId} pour ${money(Math.max(1, game.offer * 0.18))}`
                        : money(game.offer))
                )}</strong><p>${
                  game.result
                    ? "Vous pouvez démarrer immédiatement une nouvelle partie."
                    : game.bankerRequest === "cash"
                      ? "Acceptez l’offre ou poursuivez avec les boîtes restantes."
                      : "Acceptez la demande du banquier ou poursuivez la partie."
                }</p></div>
                ${
                  game.result
                    ? '<button class="primary" data-command="reset">Rejouer</button>'
                    : '<div class="banker-actions"><button class="primary" data-command="deal">DEAL</button><button class="danger" data-command="no-deal">NO DEAL</button></div>'
                }
              </section>`
            : ""
        }
      </div>
    </section>
    ${renderDealSettings()}
  </div>`;
}

function renderDealSettings() {
  return `<aside class="settings-panel">
    <small>CONFIGURATION GLOBALE</small>
    <h2>Réglages de partie</h2>
    <p>Les réglages sont enregistrés dans ShenPulse et réutilisés au prochain lancement.</p>
    <form id="deal-settings">
      ${giftField("entryGift", "Cadeau d’entrée", settings.entryGift)}
      ${giftField("premiumGift", "Cadeau premium", settings.premiumGift)}
      <label class="field"><span>Valeurs des boîtes</span><textarea name="boxValues">${escapeHtml(settings.boxValues)}</textarea></label>
      <label class="field"><span>Rythme des manches</span><input name="roundPattern" value="${escapeHtml(settings.roundPattern)}"><small>Exemple : 6, 5, 4, 3, 2, 1</small></label>
      <label class="field"><span>Ratio de l’offre du banquier</span><input name="bankerOfferRatio" type="number" min="0.1" max="1.5" step="0.01" value="${escapeHtml(settings.bankerOfferRatio)}"></label>
      <label class="field"><span>Multiplicateur partie premium</span><input name="premiumMultiplier" type="number" min="1" max="10" step="0.1" value="${escapeHtml(settings.premiumMultiplier)}"></label>
      <div class="settings-checks">
        <label><input name="cashOfferEnabled" type="checkbox" ${settings.cashOfferEnabled !== false ? "checked" : ""}><span>Offres en argent</span></label>
        <label><input name="swapEnabled" type="checkbox" ${settings.swapEnabled !== false ? "checked" : ""}><span>Échanges de boîte</span></label>
        <label><input name="buyBoxEnabled" type="checkbox" ${settings.buyBoxEnabled !== false ? "checked" : ""}><span>Achats de boîte</span></label>
      </div>
      <label class="field"><span>Musique de partie</span><select name="musicTrack">${DEAL_MUSIC.map(([file, label]) => `<option value="${escapeHtml(file)}" ${settings.musicTrack === file ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label>
      <label class="field"><span>Volume musique</span><input name="musicVolume" type="range" min="0" max="1" step="0.05" value="${escapeHtml(settings.musicVolume)}"></label>
      <label class="settings-toggle"><input name="musicEnabled" type="checkbox" ${settings.musicEnabled !== false ? "checked" : ""}><span>Activer la bande-son</span></label>
      <div class="settings-actions">
        <button class="primary" type="submit">Enregistrer les réglages</button>
        <button class="secondary" type="button" data-command="banker">Forcer l’appel du banquier</button>
        <button class="secondary" type="button" data-command="premium">Ouvrir une boîte premium</button>
      </div>
      <datalist id="host-gift-options">${giftCatalog.map((gift) => `<option value="${escapeHtml(gift.name)}">${escapeHtml(gift.cost)} pièces</option>`).join("")}</datalist>
    </form>
  </aside>`;
}

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

function resetConnectFour() {
  const columns = Math.max(4, Math.min(12, Math.round(Number(settings.columns || 7))));
  const rows = Math.max(4, Math.min(10, Math.round(Number(settings.rows || 6))));
  game = {
    board: Array(columns * rows).fill(0),
    columns,
    rows,
    turn: 1,
    winner: 0,
    blockedColumn: -1,
    history: [],
    status: "Équipe rouge commence"
  };
  renderConnectFour();
}

function connectCell(row, column) {
  return row * game.columns + column;
}

function connectWinner(row, column, player) {
  const directions = [
    [0, 1, "horizontal"],
    [1, 0, "vertical"],
    [1, 1, "diagonal"],
    [1, -1, "diagonal"]
  ];
  const target = Math.max(4, Math.min(6, Number(settings.winLength || 4)));
  for (const [rowStep, columnStep, direction] of directions) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let nextRow = row + rowStep * sign;
      let nextColumn = column + columnStep * sign;
      while (
        nextRow >= 0 &&
        nextRow < game.rows &&
        nextColumn >= 0 &&
        nextColumn < game.columns &&
        game.board[connectCell(nextRow, nextColumn)] === player
      ) {
        count += 1;
        nextRow += rowStep * sign;
        nextColumn += columnStep * sign;
      }
    }
    if (count >= target) return direction;
  }
  return "";
}

function dropConnectToken(column, forcedPlayer = 0) {
  const targetColumn = Math.max(0, Math.min(game.columns - 1, Number(column)));
  if (game.winner || targetColumn === game.blockedColumn) return;
  let targetRow = -1;
  for (let row = game.rows - 1; row >= 0; row -= 1) {
    if (!game.board[connectCell(row, targetColumn)]) {
      targetRow = row;
      break;
    }
  }
  if (targetRow < 0) return toast("Cette colonne est pleine.");
  const player = forcedPlayer || game.turn;
  const index = connectCell(targetRow, targetColumn);
  game.board[index] = player;
  game.history.push(index);
  const direction = connectWinner(targetRow, targetColumn, player);
  if (direction) {
    game.winner = player;
    const reward = settings.rewardsEnabled
      ? Number(settings.rewards?.[direction] || 0)
      : 0;
    game.status = `Équipe ${player === 1 ? "rouge" : "jaune"} gagne${reward ? ` · +${formatNumber(reward)} points` : ""}`;
  } else if (game.board.every(Boolean)) {
    game.status = "Match nul";
  } else {
    game.turn = player === 1 ? 2 : 1;
    game.status = `À l’équipe ${game.turn === 1 ? "rouge" : "jaune"}`;
  }
  renderConnectFour();
}

function renderConnectFour() {
  root.innerHTML = `<div class="game-shell connect-four-shell">
    <section class="game-stage connect-four-stage">
      <div class="stage-content">
        <header class="stage-header">
          <div><small>PUISSANCE 4 ARENA</small><h1>Rouge contre Jaune</h1></div>
          <button class="primary" data-connect-command="reset">Nouvelle manche</button>
        </header>
        <div class="connect-scoreboard">
          <span class="red"><i></i><small>ÉQUIPE ROUGE</small><strong>${game.turn === 1 && !game.winner ? "À VOUS" : "PRÊTE"}</strong></span>
          <span><small>ÉTAT DE LA PARTIE</small><strong>${escapeHtml(game.status)}</strong></span>
          <span class="yellow"><i></i><small>ÉQUIPE JAUNE</small><strong>${game.turn === 2 && !game.winner ? "À VOUS" : "PRÊTE"}</strong></span>
        </div>
        <div class="connect-board-shell">
          <div class="connect-column-buttons" style="--connect-columns:${game.columns}">
            ${Array.from({ length: game.columns }, (_, column) => `<button data-connect-column="${column}" ${game.winner || column === game.blockedColumn ? "disabled" : ""}>▼</button>`).join("")}
          </div>
          <div class="connect-board" style="--connect-columns:${game.columns};--connect-rows:${game.rows}">
            ${game.board.map((cell, index) => `<span class="${cell === 1 ? "red" : cell === 2 ? "yellow" : ""} ${Math.floor(index / game.columns) === 0 ? "top" : ""}"><i></i></span>`).join("")}
          </div>
          <div class="connect-board-base"><span></span></div>
        </div>
        <section class="coin-quick-controls connect-quick-controls">
          <button data-connect-command="red"><strong>●</strong><small>Jeton rouge</small></button>
          <button data-connect-command="yellow"><strong>●</strong><small>Jeton jaune</small></button>
          <button data-connect-command="random"><strong>?</strong><small>Colonne aléatoire</small></button>
          <button data-connect-command="block"><strong>×</strong><small>Bloquer une colonne</small></button>
          <button data-connect-command="remove"><strong>↶</strong><small>Effacer un jeton</small></button>
        </section>
      </div>
    </section>
    ${renderConnectFourSettings()}
  </div>`;
}

function renderConnectFourSettings() {
  return `<aside class="settings-panel">
    <small>CONFIGURATION GLOBALE</small>
    <h2>Réglages Puissance 4</h2>
    <p>La grille, les entrées et les récompenses reprennent les réglages de ShenazenOverlay.</p>
    <form id="connect-settings">
      <label class="field"><span>Colonnes</span><input name="columns" type="number" min="4" max="12" value="${escapeHtml(settings.columns)}"></label>
      <label class="field"><span>Lignes</span><input name="rows" type="number" min="4" max="10" value="${escapeHtml(settings.rows)}"></label>
      <label class="field"><span>Jetons à aligner</span><select name="winLength">${[4, 5, 6].map((value) => `<option value="${value}" ${Number(settings.winLength) === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      <label class="field"><span>Entrée duel</span><input name="duelEntryCost" type="number" min="0" max="999999" value="${escapeHtml(settings.duelEntryCost)}"></label>
      <label class="field"><span>Entrée IA facile</span><input name="aiEasyEntryCost" type="number" min="0" max="999999" value="${escapeHtml(settings.aiEasyEntryCost)}"></label>
      <label class="field"><span>Entrée IA difficile</span><input name="aiHardEntryCost" type="number" min="0" max="999999" value="${escapeHtml(settings.aiHardEntryCost)}"></label>
      <label class="settings-toggle"><input name="rewardsEnabled" type="checkbox" ${settings.rewardsEnabled ? "checked" : ""}><span>Activer les récompenses</span></label>
      <label class="field"><span>Récompense horizontale</span><input name="rewardHorizontal" type="number" min="0" max="999999" value="${escapeHtml(settings.rewards?.horizontal || 0)}"></label>
      <label class="field"><span>Récompense verticale</span><input name="rewardVertical" type="number" min="0" max="999999" value="${escapeHtml(settings.rewards?.vertical || 0)}"></label>
      <label class="field"><span>Récompense diagonale</span><input name="rewardDiagonal" type="number" min="0" max="999999" value="${escapeHtml(settings.rewards?.diagonal || 0)}"></label>
      <div class="settings-actions">
        <button class="primary" type="submit">Enregistrer et recréer la grille</button>
        <button class="secondary" type="button" data-connect-command="reset">Nouvelle manche</button>
      </div>
    </form>
  </aside>`;
}

function renderGenericGame() {
  root.innerHTML = `<div class="game-shell">
    <section class="game-stage">
      <div class="stage-content">
        <header class="stage-header"><div><small>JEU INTÉGRÉ SHENPULSE</small><h1>${escapeHtml(
          pack.name
        )}</h1></div></header>
        <section class="banker-panel"><span class="phone">◆</span><div><small>MOTEUR LOCAL</small><strong>Prêt pour le LIVE</strong><p>Testez chaque interaction depuis cette fenêtre hôte.</p></div></section>
        <div class="generic-effects">${pack.effects
          .map(
            (effect) =>
              `<button data-effect="${escapeHtml(effect.id)}"><strong>${escapeHtml(
                effect.name
              )}</strong><p>${escapeHtml(effect.description)}</p></button>`
          )
          .join("")}</div>
      </div>
    </section>
    <aside class="settings-panel"><small>SHENPULSE</small><h2>${escapeHtml(
      pack.name
    )}</h2><p>Les réglages de connecteur et les associations de cadeaux restent accessibles dans la page principale.</p></aside>
  </div>`;
}

root.addEventListener("click", async (event) => {
  const coinCommand = event.target.closest("[data-coin-command]")?.dataset.coinCommand;
  if (coinCommand) {
    if (coinCommand === "start" || coinCommand === "reset") return resetCoinPusher();
    if (coinCommand === "pause") {
      game.paused = !game.paused;
      game.status = game.paused ? "Manche en pause" : "Manche reprise";
      return renderCoinPusher();
    }
    if (coinCommand === "drop-one") return dropCoinPusherCoins(1);
    if (coinCommand === "drop-ten") return dropCoinPusherCoins(10, "Pluie de pièces");
    if (coinCommand === "push") return pushCoinPusher();
    if (coinCommand === "mystery") {
      game.multiplier = game.multiplier === 1 ? 2 : game.multiplier;
      return dropCoinPusherCoins(5, "Pièce mystère · multiplicateur x2");
    }
  }
  const connectColumn = event.target.closest("[data-connect-column]")?.dataset.connectColumn;
  if (connectColumn !== undefined) return dropConnectToken(connectColumn);
  const connectCommand = event.target.closest("[data-connect-command]")?.dataset.connectCommand;
  if (connectCommand) {
    if (connectCommand === "reset") return resetConnectFour();
    if (connectCommand === "red" || connectCommand === "yellow") {
      const available = Array.from({ length: game.columns }, (_, index) => index)
        .filter((column) => column !== game.blockedColumn);
      return dropConnectToken(
        available[Math.floor(Math.random() * Math.max(1, available.length))] || 0,
        connectCommand === "red" ? 1 : 2
      );
    }
    if (connectCommand === "random") {
      return dropConnectToken(Math.floor(Math.random() * game.columns));
    }
    if (connectCommand === "block") {
      game.blockedColumn =
        game.blockedColumn >= 0
          ? -1
          : Math.floor(Math.random() * game.columns);
      game.status =
        game.blockedColumn >= 0
          ? `Colonne ${game.blockedColumn + 1} bloquée`
          : "Toutes les colonnes sont disponibles";
      return renderConnectFour();
    }
    if (connectCommand === "remove") {
      const last = game.history.pop();
      if (last !== undefined) game.board[last] = 0;
      game.winner = 0;
      game.status = "Dernier jeton retiré";
      return renderConnectFour();
    }
  }
  const box = event.target.closest("[data-box]");
  if (box) return openBox(box.dataset.box);
  const command = event.target.closest("[data-command]")?.dataset.command;
  if (command === "reset") return resetDeal();
  if (command === "deal") return acceptOffer();
  if (command === "no-deal") return refuseOffer();
  if (command === "banker") {
    if (!game.playerBoxId) return toast("Choisissez d’abord la boîte du joueur.");
    callBanker();
    return renderDeal();
  }
  if (command === "premium") return premiumBox();
  const effect = event.target.closest("[data-effect]")?.dataset.effect;
  if (effect) {
    try {
      await api.triggerEffect(effect, { packId: gameId });
      toast("Interaction envoyée");
    } catch (error) {
      toast(error.message || String(error));
    }
  }
});

root.addEventListener("submit", async (event) => {
  if (event.target.id === "coin-settings") {
    event.preventDefault();
    const data = new FormData(event.target);
    const next = {
      ...settings,
      theme: data.get("theme") === "galactic-palace" ? "galactic-palace" : "arcade",
      roundDurationMinutes: Math.max(1, Math.min(180, Math.round(Number(data.get("roundDurationMinutes") || 15)))),
      topN: Math.max(1, Math.min(10, Math.round(Number(data.get("topN") || 3)))),
      maxCoins: Math.max(80, Math.min(10000, Math.round(Number(data.get("maxCoins") || 1000)))),
      pusherSpeed: Math.max(0.5, Math.min(2, Number(data.get("pusherSpeed") || 1))),
      coinScale: Math.max(0.6, Math.min(2.2, Number(data.get("coinScale") || 1))),
      volume: Math.max(0, Math.min(1, Number(data.get("volume") || 0.8))),
      sideLossEnabled: data.has("sideLossEnabled")
    };
    await api.configureGame(gameId, next);
    settings = next;
    toast("Réglages Coin Pusher enregistrés");
    return resetCoinPusher();
  }
  if (event.target.id === "connect-settings") {
    event.preventDefault();
    const data = new FormData(event.target);
    const next = {
      ...settings,
      columns: Math.max(4, Math.min(12, Math.round(Number(data.get("columns") || 7)))),
      rows: Math.max(4, Math.min(10, Math.round(Number(data.get("rows") || 6)))),
      winLength: Math.max(4, Math.min(6, Math.round(Number(data.get("winLength") || 4)))),
      duelEntryCost: Math.max(0, Math.round(Number(data.get("duelEntryCost") || 0))),
      aiEasyEntryCost: Math.max(0, Math.round(Number(data.get("aiEasyEntryCost") || 0))),
      aiHardEntryCost: Math.max(0, Math.round(Number(data.get("aiHardEntryCost") || 0))),
      rewardsEnabled: data.has("rewardsEnabled"),
      rewards: {
        horizontal: Math.max(0, Math.round(Number(data.get("rewardHorizontal") || 0))),
        vertical: Math.max(0, Math.round(Number(data.get("rewardVertical") || 0))),
        diagonal: Math.max(0, Math.round(Number(data.get("rewardDiagonal") || 0)))
      }
    };
    await api.configureGame(gameId, next);
    settings = next;
    toast("Réglages Puissance 4 enregistrés");
    return resetConnectFour();
  }
  if (event.target.id !== "deal-settings") return;
  event.preventDefault();
  const data = new FormData(event.target);
  const next = {
    ...settings,
    entryGift: String(data.get("entryGift") || "").trim(),
    premiumGift: String(data.get("premiumGift") || "").trim(),
    boxValues: String(data.get("boxValues") || "").trim(),
    roundPattern: String(data.get("roundPattern") || "").trim(),
    bankerOfferRatio: Number(data.get("bankerOfferRatio") || 0.72),
    premiumMultiplier: Number(data.get("premiumMultiplier") || 1.5),
    cashOfferEnabled: data.has("cashOfferEnabled"),
    swapEnabled: data.has("swapEnabled"),
    buyBoxEnabled: data.has("buyBoxEnabled"),
    musicEnabled: data.has("musicEnabled"),
    musicVolume: Number(data.get("musicVolume") || 0.35),
    musicTrack: String(data.get("musicTrack") || DEAL_MUSIC[0][0])
  };
  if (numberList(next.boxValues, []).length < 6) {
    return toast("Ajoutez au moins six valeurs de boîtes.");
  }
  if (!numberList(next.roundPattern, []).length) {
    return toast("Ajoutez au moins une manche.");
  }
  if (
    !next.cashOfferEnabled &&
    !next.swapEnabled &&
    !next.buyBoxEnabled
  ) {
    next.cashOfferEnabled = true;
    toast("L’offre en argent reste active : au moins une demande est requise.");
  }
  await api.configureGame(gameId, next);
  settings = next;
  toast("Réglages DealOrNoDeal enregistrés");
  resetDeal();
});

root.addEventListener("input", (event) => {
  if (event.target.matches("[data-host-gift]")) {
    updateGiftImage(event.target);
  }
});

api.on("game-effect", (payload) => {
  if (payload?.packId !== gameId) return;
  const effectId = payload.effectId;
  if (gameId === "coin-pusher") {
    if (effectId === "pluie-de-pieces") return dropCoinPusherCoins(20, "Pluie de pièces");
    if (effectId === "pousser-le-plateau") return pushCoinPusher();
    if (effectId === "piece-mystere") {
      game.multiplier = 2;
      return dropCoinPusherCoins(5, "Pièce mystère · x2");
    }
    if (effectId === "bonus-multiplicateur") {
      game.multiplier = Math.min(5, Number(game.multiplier || 1) + 1);
      game.status = `Multiplicateur x${game.multiplier}`;
      return renderCoinPusher();
    }
    if (effectId === "ralentir-le-poussoir") {
      game.status = "Poussoir ralenti";
      return renderCoinPusher();
    }
    if (effectId === "reinitialiser-la-manche") return resetCoinPusher();
    return;
  }
  if (gameId === "connect-four") {
    if (effectId === "jeton-rouge") {
      return dropConnectToken(Math.floor(Math.random() * game.columns), 1);
    }
    if (effectId === "jeton-jaune") {
      return dropConnectToken(Math.floor(Math.random() * game.columns), 2);
    }
    if (effectId === "colonne-aleatoire") {
      return dropConnectToken(Math.floor(Math.random() * game.columns));
    }
    if (effectId === "bloquer-une-colonne") {
      game.blockedColumn = Math.floor(Math.random() * game.columns);
      game.status = `Colonne ${game.blockedColumn + 1} bloquée`;
      return renderConnectFour();
    }
    if (effectId === "effacer-un-jeton") {
      const last = game.history.pop();
      if (last !== undefined) game.board[last] = 0;
      game.winner = 0;
      game.status = "Dernier jeton retiré";
      return renderConnectFour();
    }
    if (effectId === "nouvelle-manche") return resetConnectFour();
    return;
  }
  if (gameId !== "deal-or-no-deal") return;
  if (effectId === "ouvrir-une-boite") {
    const candidate = closedBoxes()[0];
    if (candidate) openBox(candidate.id);
  }
  if (effectId === "offre-du-banquier" && game.playerBoxId) {
    callBanker();
    renderDeal();
  }
  if (effectId === "refuser-l-offre") refuseOffer();
  if (effectId === "accepter-l-offre") acceptOffer();
  if (effectId === "boite-premium") premiumBox();
});

Promise.all([api.getSnapshot(), api.searchGifts("", 1000)])
  .then(([value, giftResult]) => {
    snapshot = value;
    giftCatalog = giftResult.gifts || [];
    pack = snapshot.packs.find((entry) => entry.id === gameId);
    if (!pack) throw new Error("Jeu intégré introuvable.");
    const stored = snapshot.state.game.connectorOverrides?.[gameId] || {};
    if (gameId === "coin-pusher") {
      settings = { ...DEFAULT_COIN_SETTINGS, ...stored };
      resetCoinPusher();
    } else if (gameId === "connect-four") {
      settings = {
        ...DEFAULT_CONNECT_SETTINGS,
        ...stored,
        rewards: {
          ...DEFAULT_CONNECT_SETTINGS.rewards,
          ...(stored.rewards || {})
        }
      };
      resetConnectFour();
    } else if (gameId === "deal-or-no-deal") {
      settings = { ...DEFAULT_DEAL_SETTINGS, ...stored };
      resetDeal();
    } else {
      settings = stored;
      renderGenericGame();
    }
  })
  .catch((error) => {
    root.innerHTML = `<section class="loading-card"><h1>Impossible d’ouvrir le jeu</h1><p>${escapeHtml(
      error.message || String(error)
    )}</p></section>`;
  });
