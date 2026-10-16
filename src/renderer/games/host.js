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
let giftCatalogResult = null;
let hostGiftCatalogView = "room";

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

root.addEventListener("click", (event) => {
  const button = event.target.closest("[data-host-gift-catalog-view]");
  if (!button) return;
  hostGiftCatalogView = hostGiftCatalogView === "global" ? "room" : "global";
  const list = document.getElementById("host-gift-options");
  if (list) list.innerHTML = hostGiftOptionsMarkup();
  const label = document.getElementById("host-gift-catalog-label");
  if (label) label.textContent = hostGiftCatalogLabel();
  button.textContent = hostGiftCatalogView === "global" ? "Voir les cadeaux du créateur" : "Voir le catalogue global";
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

api.getSnapshot()
  .then(async (value) => {
    const scope = hostGiftScope(value);
    const giftResult = await api.searchGifts("", 10000);
    const current = await api.getSnapshot();
    if (hostGiftScope(current) !== scope) throw new Error("Le compte, le profil ou le créateur a changé. Rouvrez le jeu.");
    snapshot = current;
    giftCatalogResult = giftResult;
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
