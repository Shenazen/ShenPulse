"use strict";

/** Hôte historique : domaine « deal ». Déclarations chargées avant l’orchestrateur host.js. */
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
      <p id="host-gift-catalog-label">${escapeHtml(hostGiftCatalogLabel())}</p>
      ${hostHasRoomGiftCatalog() ? `<button type="button" class="secondary" data-host-gift-catalog-view>${hostGiftCatalogView === "global" ? "Voir les cadeaux du créateur" : "Voir le catalogue global"}</button>` : ""}
      <datalist id="host-gift-options">${hostGiftOptionsMarkup()}</datalist>
    </form>
  </aside>`;
}

