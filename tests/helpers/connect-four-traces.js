"use strict";

/** Grilles et choix IA déterministes, indépendants de la présentation Vue. */
function traceConnectFourEngine(api) {
  const scenarios = [
    { rows: 6, columns: 7, target: 4, moves: [] },
    { rows: 6, columns: 7, target: 4, moves: [[0, 1], [1, 2], [0, 1], [1, 2], [0, 1]] },
    { rows: 6, columns: 7, target: 4, moves: [[1, 1], [0, 2], [2, 1], [0, 2], [3, 1], [6, 2]] },
    { rows: 7, columns: 9, target: 5, moves: [[2, 1], [3, 2], [2, 1], [4, 2], [2, 1], [4, 2]] }
  ];
  return scenarios.map((scenario) => {
    const board = { value: Array.from({ length: scenario.rows }, () => Array(scenario.columns).fill(0)) };
    const refs = { board, rowCount: { value: scenario.rows }, columnCount: { value: scenario.columns }, winLength: { value: scenario.target }, mode: { value: "aiEasy" } };
    const availableColumns = { get value() { return Array.from({ length: scenario.columns }, (_, column) => column).filter((column) => board.value[0][column] === 0); } };
    const engine = api.createConnectFourBoardEngine({ ...refs, availableColumns });
    const outcomes = scenario.moves.map(([column, player]) => {
      const row = engine.findOpenRow(board.value, column);
      board.value[row][column] = player;
      return engine.findWinningCells(board.value, row, column, player);
    });
    const easy = engine.selectAiColumn();
    refs.mode.value = "aiHard";
    const hard = engine.selectAiColumn();
    return { scenario, board: board.value, outcomes, easy, hard, ordered: engine.orderedAvailableColumns(board.value), windows: engine.collectWindows(board.value, scenario.target), score: engine.evaluateBoardPosition(board.value, scenario.target) };
  });
}

module.exports = { traceConnectFourEngine };
