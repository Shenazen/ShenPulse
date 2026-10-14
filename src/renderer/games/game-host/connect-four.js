"use strict";

/** Hôte historique : domaine « connect-four ». Déclarations chargées avant l’orchestrateur host.js. */
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

