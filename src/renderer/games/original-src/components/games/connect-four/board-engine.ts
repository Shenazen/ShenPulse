/** Règles et IA avec dépendances injectées ; les fenêtres géométriques sont réutilisées. */
import { normalizeConnectFourWinLength, type ConnectFourRewardDirection } from '../connectFourSettings'
import type { CellValue, Player, GridCell, GameMode } from './models'

type ReadonlyValue<T> = { readonly value: T }
type BoardEngineContext = {
  board: ReadonlyValue<CellValue[][]>
  rowCount: ReadonlyValue<number>
  columnCount: ReadonlyValue<number>
  winLength: ReadonlyValue<number>
  mode: ReadonlyValue<GameMode>
  availableColumns: ReadonlyValue<number[]>
}

const AI_PLAYER: Player = 2
const LINE_DIRECTIONS = [
  { row: 0, column: 1 }, { row: 1, column: 0 },
  { row: 1, column: 1 }, { row: 1, column: -1 },
] as const

export function createConnectFourBoardEngine(context: BoardEngineContext) {
  const { board, rowCount, columnCount, winLength, mode, availableColumns } = context
  let cachedWindowKey = ''
  let cachedWindowCells: GridCell[][] = []

  function findOpenRow(candidate: CellValue[][], column: number) {
    for (let row = rowCount.value - 1; row >= 0; row -= 1) {
      if (candidate[row][column] === 0) return row
    }
  
    return -1
  }

  function findWinningCells(
    candidate: CellValue[][],
    row: number,
    column: number,
    player: Player,
    target = winLength.value,
  ) {
    const requiredLength = normalizeConnectFourWinLength(target)
    const directions = LINE_DIRECTIONS
  
    for (const direction of directions) {
      const line = [
        ...collectDirection(candidate, row, column, player, -direction.row, -direction.column).reverse(),
        { row, column },
        ...collectDirection(candidate, row, column, player, direction.row, direction.column),
      ]
  
      if (line.length >= requiredLength) {
        const playedIndex = line.findIndex((cell) => cell.row === row && cell.column === column)
        const startIndex = Math.min(Math.max(playedIndex - (requiredLength - 1), 0), line.length - requiredLength)
        return line.slice(startIndex, startIndex + requiredLength)
      }
    }
  
    return []
  }

  function winDirectionForCells(cells: GridCell[]): ConnectFourRewardDirection | null {
    if (cells.length < 2) return null
    const first = cells[0]
    const last = cells[cells.length - 1]
    if (first.row === last.row) return 'horizontal'
    if (first.column === last.column) return 'vertical'
    return 'diagonal'
  }

  function collectDirection(
    candidate: CellValue[][],
    row: number,
    column: number,
    player: Player,
    rowStep: number,
    columnStep: number,
  ) {
    const cells: GridCell[] = []
    let nextRow = row + rowStep
    let nextColumn = column + columnStep
  
    while (
      nextRow >= 0
      && nextRow < rowCount.value
      && nextColumn >= 0
      && nextColumn < columnCount.value
      && candidate[nextRow][nextColumn] === player
    ) {
      cells.push({ row: nextRow, column: nextColumn })
      nextRow += rowStep
      nextColumn += columnStep
    }
  
    return cells
  }

  function selectAiColumn() {
    if (mode.value === 'aiHard') return selectHardAiColumn()
    return selectEasyAiColumn()
  }

  function selectEasyAiColumn() {
    const columns = availableColumns.value
    const boardSnapshot = board.value
    const opponent: Player = 1
    const target = winLength.value
  
    for (const column of columns) {
      const row = findOpenRow(boardSnapshot, column)
      const candidate = simulateMove(boardSnapshot, row, column, AI_PLAYER)
      if (findWinningCells(candidate, row, column, AI_PLAYER, target).length >= target) return column
    }
  
    for (const column of columns) {
      const row = findOpenRow(boardSnapshot, column)
      const candidate = simulateMove(boardSnapshot, row, column, opponent)
      if (findWinningCells(candidate, row, column, opponent, target).length >= target) return column
    }
  
    return [...columns]
      .map((column) => {
        const row = findOpenRow(boardSnapshot, column)
        const candidate = simulateMove(boardSnapshot, row, column, AI_PLAYER)
        return {
          column,
          score: evaluateMove(candidate, row, column, AI_PLAYER) + Math.random() * 0.8,
        }
      })
      .sort((left, right) => right.score - left.score)[0]?.column ?? columns[0] ?? Math.floor(columnCount.value / 2)
  }

  function selectHardAiColumn() {
    const columns = orderedAvailableColumns(board.value)
    const target = winLength.value
    let bestColumn = columns[0] ?? Math.floor(columnCount.value / 2)
    let bestScore = Number.NEGATIVE_INFINITY
  
    for (const column of columns) {
      const row = findOpenRow(board.value, column)
      const candidate = simulateMove(board.value, row, column, AI_PLAYER)
      const immediateWin = findWinningCells(candidate, row, column, AI_PLAYER, target).length >= target
      if (immediateWin) return column
  
      const scoreValue = minimax(candidate, 4, false, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, {
        column,
        player: AI_PLAYER,
        row,
      }) + Math.random() * 0.2
  
      if (scoreValue > bestScore) {
        bestScore = scoreValue
        bestColumn = column
      }
    }
  
    return bestColumn
  }

  function orderedAvailableColumns(candidate: CellValue[][]) {
    const centerColumn = (columnCount.value - 1) / 2
    return Array.from({ length: columnCount.value }, (_, column) => column)
      .filter((column) => findOpenRow(candidate, column) >= 0)
      .sort((left, right) => Math.abs(left - centerColumn) - Math.abs(right - centerColumn))
  }

  function minimax(
    candidate: CellValue[][],
    depth: number,
    maximizing: boolean,
    alpha: number,
    beta: number,
    lastMoveSnapshot: { column: number, player: Player, row: number } | null,
  ): number {
    const target = winLength.value
    if (lastMoveSnapshot) {
      const won = findWinningCells(
        candidate,
        lastMoveSnapshot.row,
        lastMoveSnapshot.column,
        lastMoveSnapshot.player,
        target,
      ).length >= target
      if (won) return lastMoveSnapshot.player === AI_PLAYER ? 100000 + depth : -100000 - depth
    }
  
    const columns = orderedAvailableColumns(candidate)
    if (depth <= 0 || !columns.length) return evaluateBoardPosition(candidate, target)
  
    if (maximizing) {
      let value = Number.NEGATIVE_INFINITY
      for (const column of columns) {
        const row = findOpenRow(candidate, column)
        const nextBoard = simulateMove(candidate, row, column, AI_PLAYER)
        value = Math.max(value, minimax(nextBoard, depth - 1, false, alpha, beta, { column, player: AI_PLAYER, row }))
        alpha = Math.max(alpha, value)
        if (beta <= alpha) break
      }
      return value
    }
  
    let value = Number.POSITIVE_INFINITY
    for (const column of columns) {
      const row = findOpenRow(candidate, column)
      const nextBoard = simulateMove(candidate, row, column, 1)
      value = Math.min(value, minimax(nextBoard, depth - 1, true, alpha, beta, { column, player: 1, row }))
      beta = Math.min(beta, value)
      if (beta <= alpha) break
    }
    return value
  }

  function simulateMove(source: CellValue[][], row: number, column: number, player: Player) {
    const candidate = source.map((line) => [...line]) as CellValue[][]
    if (row >= 0) candidate[row][column] = player
    return candidate
  }

  function evaluateMove(candidate: CellValue[][], row: number, column: number, player: Player) {
    const centerColumn = (columnCount.value - 1) / 2
    let scoreValue = 8 - Math.abs(column - centerColumn) * 1.6
    const opponent = player === 1 ? 2 : 1
    const target = winLength.value
    const blockThreshold = Math.max(2, target - 2)
    const directions = LINE_DIRECTIONS
  
    for (const direction of directions) {
      const cells = Array.from({ length: (target * 2) - 1 }, (_, index) => ({
        row: row + (index - (target - 1)) * direction.row,
        column: column + (index - (target - 1)) * direction.column,
      })).filter((cell) => (
        cell.row >= 0 && cell.row < rowCount.value && cell.column >= 0 && cell.column < columnCount.value
      ))
  
      for (let index = 0; index <= cells.length - target; index += 1) {
        const windowCells = cells.slice(index, index + target)
        const values = windowCells.map((cell) => candidate[cell.row][cell.column])
        const own = values.filter((value) => value === player).length
        const rival = values.filter((value) => value === opponent).length
        const empty = values.filter((value) => value === 0).length
  
        if (rival === 0) scoreValue += own * own + empty * 0.25
        if (own === target - 1 && empty === 1) scoreValue += target * 2
        if (own === 0 && rival >= blockThreshold) scoreValue += rival * 1.35
      }
    }
  
    return scoreValue
  }

  function evaluateBoardPosition(candidate: CellValue[][], target: number) {
    let scoreValue = 0
    const centerColumn = Math.floor(columnCount.value / 2)
    for (let row = 0; row < rowCount.value; row += 1) {
      if (candidate[row][centerColumn] === AI_PLAYER) scoreValue += 6
      if (candidate[row][centerColumn] === 1) scoreValue -= 5
    }
  
    for (const values of collectWindows(candidate, target)) {
      scoreValue += scoreWindow(values, AI_PLAYER, target)
      scoreValue -= scoreWindow(values, 1, target) * 1.08
    }
  
    return scoreValue
  }

  function collectWindows(candidate: CellValue[][], target: number) {
    const key = `${rowCount.value}:${columnCount.value}:${target}`
    if (cachedWindowKey !== key) {
      const windows: GridCell[][] = []
      for (let row = 0; row < rowCount.value; row += 1) {
        for (let column = 0; column < columnCount.value; column += 1) {
          for (const direction of LINE_DIRECTIONS) {
            const cells: GridCell[] = []
            for (let offset = 0; offset < target; offset += 1) {
              const nextRow = row + offset * direction.row
              const nextColumn = column + offset * direction.column
              if (nextRow < 0 || nextRow >= rowCount.value || nextColumn < 0 || nextColumn >= columnCount.value) break
              cells.push({ row: nextRow, column: nextColumn })
            }
            if (cells.length === target) windows.push(cells)
          }
        }
      }
      cachedWindowCells = windows
      cachedWindowKey = key
    }
    return cachedWindowCells.map((cells) => cells.map((cell) => candidate[cell.row][cell.column]))
  }

  function scoreWindow(values: CellValue[], player: Player, target: number) {
    const opponent = player === 1 ? 2 : 1
    const own = values.filter((value) => value === player).length
    const rival = values.filter((value) => value === opponent).length
    const empty = values.filter((value) => value === 0).length
    if (own > 0 && rival > 0) return 0
    if (own === target) return 100000
    if (own === target - 1 && empty === 1) return 1200
    if (own === target - 2 && empty >= 2) return 140
    if (own > 0) return own * own * 5 + empty
    return 0
  }

  return { findOpenRow, findWinningCells, winDirectionForCells, collectDirection, selectAiColumn, selectEasyAiColumn, selectHardAiColumn, orderedAvailableColumns, minimax, simulateMove, evaluateMove, evaluateBoardPosition, collectWindows, scoreWindow }
}

