<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Bot,
  Gem,
  Swords,
  Trophy,
} from 'lucide-vue-next'
import diamondIconUrl from '../../assets/games/connect-four/diamond-icon.png?url'
import statusPanelUrl from '../../assets/games/connect-four/status-panel.png?url'
import { isEditableKeyboardTarget } from '../../utils/keyboardShortcuts'
import {
  CONNECT_FOUR_SETTINGS_EVENT,
  CONNECT_FOUR_SETTINGS_STORAGE_KEY,
  loadConnectFourSettings,
  normalizeConnectFourEntryCost,
  normalizeConnectFourGridColumns,
  normalizeConnectFourGridRows,
  normalizeConnectFourRewardAmount,
  normalizeConnectFourRewards,
  normalizeConnectFourWinLength,
  type ConnectFourRewardDirection,
  type ConnectFourSettings,
} from './connectFourSettings'

type CellValue = 0 | 1 | 2
type Player = 1 | 2
type GamePhase = 'lobby' | 'playing' | 'victory' | 'draw'
type GameMode = 'duel' | 'aiEasy' | 'aiHard'
type GridCell = { row: number, column: number }
type RewardResult = {
  amount: number
  direction: ConnectFourRewardDirection
  enabled: boolean
  player: Player
}
type Particle = {
  color: string
  delay: number
  id: number
  rotate: number
  size: number
  tx: number
  ty: number
  x: number
  y: number
}

const AI_PLAYER: Player = 2
const REWARD_DIRECTIONS: ConnectFourRewardDirection[] = ['horizontal', 'vertical', 'diagonal']

const { t } = useI18n()
let idSeed = 1
let aiTimer: number | undefined
let launchDialogTimer: number | undefined
let unlockTimer: number | undefined
let audioContext: AudioContext | null = null

const settings = ref(loadConnectFourSettings())
const board = ref<CellValue[][]>(createBoard())
const phase = ref<GamePhase>('lobby')
const mode = ref<GameMode>('duel')
const currentPlayer = ref<Player>(1)
const winner = ref<Player | null>(null)
const winningCells = ref<GridCell[]>([])
const moveCount = ref(0)
const isBusy = ref(false)
const launchDialogOpen = ref(true)
const soundEnabled = ref(true)
const lastMove = ref<{ column: number, id: number, player: Player, row: number } | null>(null)
const lastReward = ref<RewardResult | null>(null)
const particles = ref<Particle[]>([])
const score = ref({ red: 0, gold: 0, draws: 0 })
const feed = ref([
  { id: idSeed++, tone: 'cyan', text: t('playableGames.connectFour.feed.ready') },
  { id: idSeed++, tone: 'gold', text: t('playableGames.connectFour.feed.stage') },
])

const rowCount = computed(() => settings.value.rows)
const columnCount = computed(() => settings.value.columns)
const columnIndexes = computed(() => Array.from({ length: columnCount.value }, (_, column) => column))
const availableColumns = computed(() => columnIndexes.value.filter(canUseColumn))

const currentPlayerName = computed(() => playerName(currentPlayer.value))
const currentModeLabel = computed(() => t(`playableGames.connectFour.modes.${mode.value}`))
const winLength = computed(() => settings.value.winLength)
const boardGridStyle = computed(() => ({
  '--connect-board-width': `${Math.max(42, Math.min(100, (columnCount.value / rowCount.value) * 100))}%`,
  '--connect-columns': String(columnCount.value),
  '--connect-rows': String(rowCount.value),
  '--connect-board-ratio': `${columnCount.value} / ${rowCount.value}`,
}) as Record<string, string>)
const rewardSummaries = computed(() => REWARD_DIRECTIONS.map((direction) => ({
  amount: settings.value.rewards[direction],
  direction,
  label: t(`playableGames.connectFour.rewards.gain.${direction}`),
})))
const launchOptions = computed(() => [
  {
    cost: settings.value.duelEntryCost,
    detail: t('playableGames.connectFour.launch.duelDetail'),
    mode: 'duel' as const,
    tone: 'red',
    title: t('playableGames.connectFour.modes.duel'),
  },
  {
    cost: settings.value.aiEasyEntryCost,
    detail: t('playableGames.connectFour.launch.aiEasyDetail'),
    mode: 'aiEasy' as const,
    tone: 'gold',
    title: t('playableGames.connectFour.modes.aiEasy'),
  },
  {
    cost: settings.value.aiHardEntryCost,
    detail: t('playableGames.connectFour.launch.aiHardDetail'),
    mode: 'aiHard' as const,
    tone: 'cyan',
    title: t('playableGames.connectFour.modes.aiHard'),
  },
])
const phaseLabel = computed(() => {
  if (phase.value === 'lobby') return t('playableGames.connectFour.waiting')
  if (phase.value === 'victory' && winner.value) {
    return t('playableGames.connectFour.winner', { player: playerName(winner.value) })
  }
  if (phase.value === 'draw') return t('playableGames.connectFour.draw')
  return t('playableGames.connectFour.moves', { count: moveCount.value })
})
const statusTitle = computed(() => {
  if (phase.value === 'lobby') return t('playableGames.connectFour.readyTitle')
  if (phase.value === 'victory' && winner.value) {
    return t('playableGames.connectFour.winnerTitle', { player: playerName(winner.value) })
  }
  if (phase.value === 'draw') return t('playableGames.connectFour.drawTitle')
  return t('playableGames.connectFour.turn', { player: currentPlayerName.value })
})
const statusDetail = computed(() => {
  if (phase.value === 'lobby') return t('playableGames.connectFour.readyDetail', { count: winLength.value })
  if (phase.value === 'victory') {
    return t('playableGames.connectFour.winDetail', {
      count: moveCount.value,
      target: winningCells.value.length || winLength.value,
    })
  }
  if (phase.value === 'draw') return t('playableGames.connectFour.drawDetail')
  if (isAiMode() && currentPlayer.value === AI_PLAYER) {
    return t('playableGames.connectFour.aiThinking', { count: winLength.value })
  }
  return t('playableGames.connectFour.liveTurnDetail', { count: winLength.value, mode: currentModeLabel.value })
})
const winningLineStyle = computed(() => {
  if (winningCells.value.length < winLength.value) return null

  const first = winningCells.value[0]
  const last = winningCells.value[winningCells.value.length - 1]
  const dx = last.column - first.column
  const dy = last.row - first.row
  const length = (Math.sqrt((dx * dx) + (dy * dy)) / columnCount.value) * 100
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)

  return {
    left: `${((first.column + 0.5) / columnCount.value) * 100}%`,
    top: `${((first.row + 0.5) / rowCount.value) * 100}%`,
    width: `${length}%`,
    transform: `translateY(-50%) rotate(${angle}deg)`,
  }
})

watch([phase, currentPlayer, mode], () => {
  window.clearTimeout(aiTimer)

  if (phase.value === 'playing' && isAiMode() && currentPlayer.value === AI_PLAYER) {
    aiTimer = window.setTimeout(() => {
      makeMove(selectAiColumn(), { byAi: true })
    }, mode.value === 'aiHard' ? 520 : 720)
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('storage', handleSettingsStorage)
  window.addEventListener(CONNECT_FOUR_SETTINGS_EVENT, handleSettingsEvent)
})

onBeforeUnmount(() => {
  window.clearTimeout(aiTimer)
  window.clearTimeout(launchDialogTimer)
  window.clearTimeout(unlockTimer)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('storage', handleSettingsStorage)
  window.removeEventListener(CONNECT_FOUR_SETTINGS_EVENT, handleSettingsEvent)
})

function createBoard(): CellValue[][] {
  return Array.from({ length: settings.value.rows }, () => Array.from({ length: settings.value.columns }, () => 0 as CellValue))
}

function playerName(player: Player) {
  return player === 1 ? t('playableGames.connectFour.red') : t('playableGames.connectFour.gold')
}

function playerClass(player: Player) {
  return player === 1 ? 'red' : 'gold'
}

function isAiMode(candidate = mode.value) {
  return candidate === 'aiEasy' || candidate === 'aiHard'
}

function applySettings(nextSettings: Partial<ConnectFourSettings>, options: { announce?: boolean } = {}) {
  const previousSettings = settings.value
  const nextNormalizedSettings: ConnectFourSettings = {
    aiEasyEntryCost: normalizeConnectFourEntryCost(nextSettings.aiEasyEntryCost ?? previousSettings.aiEasyEntryCost),
    aiHardEntryCost: normalizeConnectFourEntryCost(nextSettings.aiHardEntryCost ?? previousSettings.aiHardEntryCost),
    columns: normalizeConnectFourGridColumns(nextSettings.columns ?? previousSettings.columns),
    duelEntryCost: normalizeConnectFourEntryCost(nextSettings.duelEntryCost ?? previousSettings.duelEntryCost),
    rewards: normalizeConnectFourRewards(nextSettings.rewards ?? previousSettings.rewards),
    rewardsEnabled: Boolean(nextSettings.rewardsEnabled ?? previousSettings.rewardsEnabled),
    rows: normalizeConnectFourGridRows(nextSettings.rows ?? previousSettings.rows),
    winLength: normalizeConnectFourWinLength(nextSettings.winLength ?? previousSettings.winLength),
  }
  const winLengthChanged = previousSettings.winLength !== nextNormalizedSettings.winLength
  const gridChanged = previousSettings.columns !== nextNormalizedSettings.columns
    || previousSettings.rows !== nextNormalizedSettings.rows
  const entryCostChanged = previousSettings.duelEntryCost !== nextNormalizedSettings.duelEntryCost
    || previousSettings.aiEasyEntryCost !== nextNormalizedSettings.aiEasyEntryCost
    || previousSettings.aiHardEntryCost !== nextNormalizedSettings.aiHardEntryCost
  const rewardsChanged = previousSettings.rewardsEnabled !== nextNormalizedSettings.rewardsEnabled
    || previousSettings.rewards.horizontal !== nextNormalizedSettings.rewards.horizontal
    || previousSettings.rewards.vertical !== nextNormalizedSettings.rewards.vertical
    || previousSettings.rewards.diagonal !== nextNormalizedSettings.rewards.diagonal

  if (!winLengthChanged && !gridChanged && !entryCostChanged && !rewardsChanged) return

  settings.value = nextNormalizedSettings

  if (!gridChanged && lastReward.value) {
    lastReward.value = {
      ...lastReward.value,
      amount: nextNormalizedSettings.rewards[lastReward.value.direction],
      enabled: nextNormalizedSettings.rewardsEnabled,
    }
  }

  if (gridChanged) {
    resetBoard()
  }

  if (options.announce && winLengthChanged) {
    addFeed(t('playableGames.connectFour.feed.winLength', { count: nextNormalizedSettings.winLength }), 'cyan')
    burst('cyan', 18)
  }

  if (options.announce && gridChanged) {
    addFeed(t('playableGames.connectFour.feed.gridSize', {
      columns: nextNormalizedSettings.columns,
      rows: nextNormalizedSettings.rows,
    }), 'cyan')
    burst('cyan', 18)
  }

  if (winLengthChanged && !gridChanged) evaluateCurrentBoardForWin()
}

function handleSettingsEvent(event: Event) {
  const detail = (event as CustomEvent<Partial<ConnectFourSettings> & { settings?: Partial<ConnectFourSettings> }>).detail
  applySettings(detail?.settings || detail || loadConnectFourSettings(), { announce: true })
}

function handleSettingsStorage(event: StorageEvent) {
  if (event.key && event.key !== CONNECT_FOUR_SETTINGS_STORAGE_KEY) return
  applySettings(loadConnectFourSettings(), { announce: true })
}

function evaluateCurrentBoardForWin() {
  if (phase.value !== 'playing') return

  const recentMove = lastMove.value
  if (recentMove) {
    const result = findWinningCells(board.value, recentMove.row, recentMove.column, recentMove.player)
    if (result.length >= winLength.value) {
      finishVictory(recentMove.player, result)
      return
    }
  }

  for (let row = 0; row < rowCount.value; row += 1) {
    for (let column = 0; column < columnCount.value; column += 1) {
      const player = board.value[row][column]
      if (!player) continue

      const result = findWinningCells(board.value, row, column, player)
      if (result.length >= winLength.value) {
        finishVictory(player, result)
        return
      }
    }
  }
}

function scheduleLaunchDialog() {
  window.clearTimeout(launchDialogTimer)
  launchDialogTimer = window.setTimeout(() => {
    launchDialogOpen.value = true
  }, 950)
}

function showEndGameDialog() {
  launchDialogOpen.value = true
}

function formatEntryCost(value: unknown) {
  return entryCostAmount(value) || t('playableGames.connectFour.free')
}

function entryCostAmount(value: unknown) {
  const cost = normalizeConnectFourEntryCost(value)
  if (cost <= 0) return ''
  return t('playableGames.connectFour.price', {
    amount: new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(cost),
  })
}

function formatRewardAmount(value: unknown) {
  const amount = normalizeConnectFourRewardAmount(value)
  if (amount <= 0) return t('playableGames.connectFour.rewards.noReward')
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount)
}

function formatHudRewardAmount(value: unknown) {
  const amount = normalizeConnectFourRewardAmount(value)
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount)
}

function columnLabel(column: number) {
  let value = Math.max(0, Math.floor(column))
  let label = ''
  do {
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26) - 1
  } while (value >= 0)
  return label
}

function rowLabel(row: number) {
  return String(rowCount.value - row)
}

function cellCoordinate(row: number, column: number) {
  return `${columnLabel(column)}${rowLabel(row)}`
}

function startGame(nextMode: GameMode) {
  mode.value = nextMode
  resetBoard()
  phase.value = 'playing'
  launchDialogOpen.value = false
  addFeed(t('playableGames.connectFour.feed.starts', { mode: t(`playableGames.connectFour.modes.${nextMode}`) }), 'cyan')
  playStartSound()
  burst('cyan', 32)
}

function resetBoard() {
  window.clearTimeout(aiTimer)
  window.clearTimeout(launchDialogTimer)
  window.clearTimeout(unlockTimer)
  board.value = createBoard()
  currentPlayer.value = 1
  winner.value = null
  winningCells.value = []
  lastReward.value = null
  moveCount.value = 0
  lastMove.value = null
  isBusy.value = false
  launchDialogOpen.value = true
  phase.value = 'lobby'
}

function canUseColumn(column: number) {
  return column >= 0 && column < columnCount.value && board.value[0]?.[column] === 0
}

function makeMove(column: number, options: { byAi?: boolean } = {}) {
  if (phase.value !== 'playing' || isBusy.value || !canUseColumn(column)) return

  const row = findOpenRow(board.value, column)
  if (row < 0) return

  const player = currentPlayer.value
  const nextBoard = board.value.map((line) => [...line]) as CellValue[][]
  nextBoard[row][column] = player
  board.value = nextBoard
  moveCount.value += 1
  lastMove.value = { column, id: idSeed++, player, row }
  isBusy.value = true

  const origin = particleOrigin(row, column)
  burst(playerClass(player), 16, origin)
  playMoveSound(player)

  const result = findWinningCells(nextBoard, row, column, player)
  if (result.length >= winLength.value) {
    finishVictory(player, result)
    return
  }

  if (moveCount.value >= rowCount.value * columnCount.value) {
    finishDraw()
    return
  }

  addFeed(t('playableGames.connectFour.feed.move', {
    coordinate: cellCoordinate(row, column),
    player: playerName(player),
  }), playerClass(player))

  currentPlayer.value = player === 1 ? 2 : 1
  unlockTimer = window.setTimeout(() => {
    isBusy.value = false
  }, options.byAi ? 360 : 260)
}

function finishVictory(player: Player, cells: GridCell[]) {
  const direction = winDirectionForCells(cells)
  winner.value = player
  winningCells.value = cells
  lastReward.value = direction
    ? {
      amount: settings.value.rewards[direction],
      direction,
      enabled: settings.value.rewardsEnabled,
      player,
    }
    : null
  phase.value = 'victory'
  isBusy.value = false
  score.value = {
    ...score.value,
    [player === 1 ? 'red' : 'gold']: score.value[player === 1 ? 'red' : 'gold'] + 1,
  }
  addFeed(t('playableGames.connectFour.feed.win', {
    count: cells.length,
    player: playerName(player),
  }), 'win')
  if (lastReward.value?.enabled && lastReward.value.amount > 0) {
    addFeed(t('playableGames.connectFour.feed.reward', {
      amount: formatRewardAmount(lastReward.value.amount),
      direction: t(`playableGames.connectFour.rewards.${lastReward.value.direction}`),
      player: playerName(player),
    }), 'gold')
  }
  playWinSound()
  burst('win', 78)
}

function finishDraw() {
  phase.value = 'draw'
  isBusy.value = false
  lastReward.value = null
  score.value = { ...score.value, draws: score.value.draws + 1 }
  addFeed(t('playableGames.connectFour.feed.draw'), 'gold')
  playDrawSound()
  burst('gold', 40)
  scheduleLaunchDialog()
}

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
  const directions = [
    { row: 0, column: 1 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: -1 },
  ]

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
  const directions = [
    { row: 0, column: 1 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: -1 },
  ]

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
  const windows: CellValue[][] = []
  const directions = [
    { row: 0, column: 1 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: -1 },
  ]

  for (let row = 0; row < rowCount.value; row += 1) {
    for (let column = 0; column < columnCount.value; column += 1) {
      for (const direction of directions) {
        const cells: CellValue[] = []
        for (let offset = 0; offset < target; offset += 1) {
          const nextRow = row + offset * direction.row
          const nextColumn = column + offset * direction.column
          if (nextRow < 0 || nextRow >= rowCount.value || nextColumn < 0 || nextColumn >= columnCount.value) break
          cells.push(candidate[nextRow][nextColumn])
        }
        if (cells.length === target) windows.push(cells)
      }
    }
  }

  return windows
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

function cellClasses(row: number, column: number, cell: CellValue) {
  return {
    filled: cell !== 0,
    gold: cell === 2,
    last: isLastMove(row, column),
    red: cell === 1,
    winning: isWinningCell(row, column),
  }
}

function isWinningCell(row: number, column: number) {
  return winningCells.value.some((cell) => cell.row === row && cell.column === column)
}

function isLastMove(row: number, column: number) {
  return lastMove.value?.row === row && lastMove.value.column === column
}

function discStyle(row: number) {
  return {
    '--drop-offset': `${-(row + 1) * 116}%`,
  }
}

function particleOrigin(row: number, column: number) {
  return {
    x: 14 + ((column + 0.5) / columnCount.value) * 72,
    y: 31 + ((row + 0.5) / rowCount.value) * 40,
  }
}

function burst(type: string, count = 24, origin = { x: 50, y: 52 }) {
  const palettes: Record<string, string[]> = {
    cyan: ['#31e7ff', '#ffffff', '#69f5c9', '#ffd166'],
    gold: ['#ffd166', '#ffe9a6', '#ff9f1c', '#ffffff'],
    red: ['#ff324f', '#ff826d', '#ffd166', '#ffffff'],
    win: ['#fff1a8', '#ffd166', '#31e7ff', '#ff324f', '#ffffff'],
  }
  const palette = palettes[type] || palettes.cyan
  const batch = Array.from({ length: count }, () => ({
    color: palette[Math.floor(Math.random() * palette.length)],
    delay: Math.random() * 0.16,
    id: idSeed++,
    rotate: Math.random() * 420 - 210,
    size: 5 + Math.random() * 8,
    tx: Math.random() * 260 - 130,
    ty: -50 - Math.random() * 210,
    x: origin.x + Math.random() * 10 - 5,
    y: origin.y + Math.random() * 7 - 3,
  }))

  particles.value.push(...batch)
  window.setTimeout(() => {
    const ids = new Set(batch.map((particle) => particle.id))
    particles.value = particles.value.filter((particle) => !ids.has(particle.id))
  }, 1500)
}

function addFeed(text: string, tone = 'cyan') {
  feed.value = [{ id: idSeed++, text, tone }, ...feed.value].slice(0, 8)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (isEditableKeyboardTarget(event.target)) return

  const column = Number(event.key) - 1
  if (Number.isInteger(column) && column >= 0 && column < columnCount.value) {
    event.preventDefault()
    makeMove(column)
  }
}

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextConstructor) return null
    audioContext = new AudioContextConstructor()
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  return audioContext
}

function playTone(frequency: number, duration = 0.12, type: OscillatorType = 'sine', gainValue = 0.035, delay = 0) {
  if (!soundEnabled.value) return
  const context = getAudioContext()
  if (!context) return

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const startTime = context.currentTime + delay
  const endTime = startTime + duration

  oscillator.frequency.value = frequency
  oscillator.type = type
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.018)
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startTime)
  oscillator.stop(endTime + 0.04)
}

function playMoveSound(player: Player) {
  const base = player === 1 ? 164.81 : 220
  playTone(base, 0.09, 'triangle', 0.026)
  playTone(base * 1.5, 0.1, 'sine', 0.022, 0.045)
}

function playStartSound() {
  playTone(196, 0.08, 'triangle', 0.026)
  playTone(261.63, 0.1, 'triangle', 0.026, 0.075)
  playTone(392, 0.13, 'sine', 0.03, 0.15)
}

function playDrawSound() {
  playTone(220, 0.12, 'triangle', 0.028)
  playTone(196, 0.14, 'triangle', 0.024, 0.1)
}

function playWinSound() {
  ;[261.63, 329.63, 392, 523.25, 659.25].forEach((frequency, index) => {
    playTone(frequency, 0.14, index % 2 ? 'triangle' : 'sine', 0.034, index * 0.075)
  })
}
</script>

<template>
  <main class="connect-shell">
    <section
      class="connect-stage"
      :class="[
        `is-${phase}`,
        `turn-${playerClass(currentPlayer)}`,
      ]"
      tabindex="0"
    >
      <div class="stage-image" aria-hidden="true"></div>
      <div class="stage-wall" aria-hidden="true"></div>
      <div class="stage-beams" aria-hidden="true">
        <i></i>
        <i></i>
        <i></i>
      </div>
      <div class="stage-floor" aria-hidden="true"></div>
      <div class="stage-vignette" aria-hidden="true"></div>

      <div class="particle-layer" aria-hidden="true">
        <span
          v-for="particle in particles"
          :key="particle.id"
          class="particle"
          :style="{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size * 1.55}px`,
            background: particle.color,
            '--tx': `${particle.tx}px`,
            '--ty': `${particle.ty}px`,
            '--spin': `${particle.rotate}deg`,
            animationDelay: `${particle.delay}s`,
          }"
        ></span>
      </div>

      <section class="score-strip" :aria-label="t('playableGames.connectFour.score')">
        <article class="score-card red-score">
          <span>{{ t('playableGames.connectFour.red') }}</span>
          <strong>{{ score.red }}</strong>
        </article>
        <article class="score-card draw-score">
          <span>{{ t('playableGames.connectFour.drawShort') }}</span>
          <strong>{{ score.draws }}</strong>
        </article>
        <article class="score-card gold-score">
          <span>{{ t('playableGames.connectFour.gold') }}</span>
          <strong>{{ score.gold }}</strong>
        </article>
      </section>

      <section class="match-panel" :class="{ 'is-disabled': !settings.rewardsEnabled }" :aria-label="t('playableGames.connectFour.rewards.title')">
        <img class="match-panel-art" :src="statusPanelUrl" alt="" aria-hidden="true" />
        <div class="match-objective">
          <span>{{ t('playableGames.connectFour.objective') }}</span>
          <strong>{{ winLength }}</strong>
        </div>
        <div class="match-rewards">
          <article
            v-for="reward in rewardSummaries"
            :key="reward.direction"
            class="match-reward"
            :class="{ 'is-active': lastReward?.direction === reward.direction }"
          >
            <span>{{ reward.label }}</span>
            <strong>
              <img :src="diamondIconUrl" alt="" aria-hidden="true" />
              {{ formatHudRewardAmount(reward.amount) }}
            </strong>
          </article>
        </div>
      </section>

      <section class="arena-board" :style="boardGridStyle" :aria-label="t('playableGames.connectFour.board')">
        <div class="column-gates-shell">
          <div class="column-gates">
            <button
              v-for="column in columnIndexes"
              :key="`gate-${column}`"
              type="button"
              :disabled="phase !== 'playing' || isBusy || !canUseColumn(column)"
              :title="t('playableGames.connectFour.column', { column: columnLabel(column) })"
              @click="makeMove(column)"
            >
              <span>{{ columnLabel(column) }}</span>
            </button>
          </div>
        </div>

        <div class="board-axis-shell">
          <div class="board-frame" :class="{ locked: phase !== 'playing' || isBusy }">
            <span v-if="winningLineStyle" class="winning-beam" :style="winningLineStyle"></span>
            <template v-for="(row, rowIndex) in board" :key="`row-${rowIndex}`">
              <button
                v-for="(cell, columnIndex) in row"
                :key="`${rowIndex}-${columnIndex}`"
                type="button"
                class="cell-button"
                :class="cellClasses(rowIndex, columnIndex, cell)"
                :disabled="phase !== 'playing' || isBusy || !canUseColumn(columnIndex)"
                :aria-label="t('playableGames.connectFour.cell', { coordinate: cellCoordinate(rowIndex, columnIndex) })"
                :title="cellCoordinate(rowIndex, columnIndex)"
                @click="makeMove(columnIndex)"
              >
                <span class="cell-rim">
                  <span
                    v-if="cell"
                    class="disc"
                    :class="[
                      playerClass(cell as Player),
                      { dropped: isLastMove(rowIndex, columnIndex) },
                    ]"
                    :style="discStyle(rowIndex)"
                  ></span>
                </span>
              </button>
            </template>
          </div>
        </div>
        <button
          v-if="phase === 'victory' && winner"
          type="button"
          class="end-game-button"
          :title="t('playableGames.connectFour.openLaunch')"
          @click="showEndGameDialog"
        >
          <Trophy :size="15" />
          {{ t('playableGames.connectFour.endGame') }}
        </button>
      </section>

      <div v-if="launchDialogOpen" class="launch-dialog-layer" :class="{ 'is-result': phase !== 'lobby' }">
        <section class="launch-dialog" role="dialog" :aria-label="t('playableGames.connectFour.launch.title')">
          <div class="launch-dialog-head">
            <span>{{ phaseLabel }}</span>
            <h2>{{ statusTitle }}</h2>
            <p>{{ statusDetail }}</p>
          </div>
          <div class="launch-mode-grid">
            <button
              v-for="option in launchOptions"
              :key="option.mode"
              type="button"
              class="launch-mode-button"
              :class="`tone-${option.tone}`"
              @click="startGame(option.mode)"
            >
              <Swords v-if="option.mode === 'duel'" class="launch-mode-symbol" :size="22" />
              <Bot v-else class="launch-mode-symbol" :size="22" />
              <span class="launch-mode-copy">
                <b>{{ option.title }}</b>
                <small>{{ option.detail }}</small>
              </span>
              <strong class="launch-price" :class="{ 'is-free': !entryCostAmount(option.cost) }">
                <Gem v-if="entryCostAmount(option.cost)" :size="15" />
                <span>{{ formatEntryCost(option.cost) }}</span>
              </strong>
            </button>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

button {
  border: 0;
  font: inherit;
}

.connect-shell {
  min-height: min(100vh, 960px);
  display: grid;
  place-items: center;
  overflow: hidden;
  background: transparent;
}

.connect-stage {
  position: relative;
  width: min(100vw, 56.25vh);
  height: min(100vh, 177.78vw);
  aspect-ratio: 9 / 16;
  overflow: hidden;
  isolation: isolate;
  color: #ffffff;
  background:
    linear-gradient(155deg, rgba(13, 148, 136, 0.16), transparent 34%),
    linear-gradient(28deg, rgba(220, 38, 38, 0.2), transparent 42%),
    linear-gradient(180deg, #04070b 0%, #07111a 45%, #020407 100%);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  outline: none;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 28px 90px rgba(0, 0, 0, 0.72);
}

.stage-image,
.stage-wall,
.stage-beams,
.stage-floor,
.stage-vignette,
.particle-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.stage-image {
  z-index: -7;
  background:
    linear-gradient(180deg, rgba(3, 7, 18, 0.2), rgba(3, 7, 18, 0.58) 62%, rgba(3, 7, 18, 0.84)),
    url("../../assets/games/connect-four/arena-stage.png") center / cover no-repeat;
  filter: saturate(1.08) contrast(1.05);
  transform: scale(1.04);
  animation: stageImageDrift 12s ease-in-out infinite alternate;
}

.stage-wall {
  z-index: -5;
  opacity: 0.62;
  mix-blend-mode: screen;
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.07) 0 1px, transparent 1px 46px),
    linear-gradient(180deg, rgba(49, 231, 255, 0.16), transparent 26%),
    linear-gradient(90deg, rgba(255, 50, 79, 0.18), transparent 26% 74%, rgba(255, 209, 102, 0.16));
  mask-image: linear-gradient(180deg, #000 0 62%, transparent 100%);
}

.stage-wall::after {
  content: "";
  position: absolute;
  left: -16%;
  right: -16%;
  top: 42%;
  height: 20%;
  border-top: 2px solid rgba(49, 231, 255, 0.72);
  border-bottom: 2px solid rgba(255, 50, 79, 0.54);
  background:
    repeating-linear-gradient(90deg, transparent 0 28px, rgba(255, 255, 255, 0.08) 28px 30px),
    linear-gradient(180deg, rgba(3, 11, 20, 0.58), rgba(3, 7, 12, 0.18));
  transform: perspective(560px) rotateX(58deg);
  transform-origin: top;
}

.stage-beams {
  z-index: -4;
  opacity: 0.84;
  mix-blend-mode: screen;
}

.stage-beams i {
  position: absolute;
  top: -5%;
  width: 34%;
  height: 72%;
  clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.46), rgba(49, 231, 255, 0.11) 54%, transparent);
  transform-origin: top center;
  animation: beamSweep 5.4s ease-in-out infinite alternate;
}

.stage-beams i:nth-child(1) {
  left: -6%;
  transform: rotate(-18deg);
}

.stage-beams i:nth-child(2) {
  left: 33%;
  background: linear-gradient(180deg, rgba(255, 239, 178, 0.4), rgba(255, 209, 102, 0.11) 54%, transparent);
  animation-delay: -1.8s;
}

.stage-beams i:nth-child(3) {
  right: -7%;
  transform: rotate(18deg);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 50, 79, 0.12) 54%, transparent);
  animation-delay: -3.1s;
}

.stage-floor {
  z-index: -3;
  top: 61%;
  background:
    repeating-linear-gradient(0deg, transparent 0 30px, rgba(49, 231, 255, 0.18) 31px),
    repeating-linear-gradient(90deg, transparent 0 37px, rgba(255, 255, 255, 0.11) 38px),
    linear-gradient(180deg, rgba(9, 22, 32, 0.22), rgba(2, 4, 7, 0.82));
  mask-image: linear-gradient(180deg, transparent 0, #000 24%, transparent 100%);
}

.stage-vignette {
  z-index: -2;
  background:
    linear-gradient(180deg, rgba(1, 6, 14, 0.08), rgba(1, 6, 14, 0.18) 44%, rgba(1, 6, 14, 0.78)),
    radial-gradient(circle at 50% 37%, rgba(255, 255, 255, 0.08), transparent 33%),
    radial-gradient(circle at 50% 78%, rgba(49, 231, 255, 0.16), transparent 36%);
}

.score-strip {
  position: absolute;
  z-index: 5;
  top: 16px;
  left: 16px;
  right: 16px;
  display: grid;
  grid-template-columns: 1fr 0.78fr 1fr;
  gap: 8px;
}

.score-card {
  min-width: 0;
  min-height: 54px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 8px;
  background: rgba(3, 9, 16, 0.66);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px);
}

.score-card span {
  min-width: 0;
  overflow: hidden;
  color: #b6c7d8;
  font-size: 0.68rem;
  font-weight: 950;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.score-card strong {
  color: #ffffff;
  font-size: 1.22rem;
  font-weight: 950;
  line-height: 1;
}

.red-score {
  border-color: rgba(255, 50, 79, 0.4);
}

.red-score strong {
  color: #ff5f72;
}

.gold-score {
  border-color: rgba(255, 209, 102, 0.42);
}

.gold-score strong {
  color: #ffd166;
}

.draw-score {
  border-color: rgba(49, 231, 255, 0.34);
}

.match-panel {
  position: absolute;
  z-index: 5;
  top: 68px;
  left: 15%;
  right: 15%;
  display: grid;
  grid-template-columns: 160fr 470fr 10fr 455fr 10fr 455fr 10fr 455fr 147fr;
  grid-template-rows: 96fr 520fr 108fr;
  aspect-ratio: 2172 / 724;
  min-width: 0;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.34));
}

.match-panel-art {
  position: absolute;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.match-panel.is-disabled .match-panel-art {
  filter: saturate(0.9);
}

.match-objective,
.match-rewards,
.match-reward,
.match-reward strong {
  min-width: 0;
}

.match-objective {
  position: relative;
  z-index: 1;
  grid-column: 2;
  grid-row: 2;
  display: block;
  padding: 0;
  text-align: center;
}

.match-objective span,
.match-reward span {
  position: absolute;
  left: 50%;
  top: 32%;
  display: block;
  width: calc(100% - 24px);
  max-width: 100%;
  text-align: center;
  transform: translate(-50%, -50%);
  font-size: 0.58rem;
  font-weight: 950;
  line-height: 0.96;
  text-transform: uppercase;
  white-space: pre-line;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.72);
}

.match-objective span {
  top: 30%;
  color: #9af7ff;
}

.match-objective strong,
.match-reward strong {
  position: absolute;
  left: 50%;
  top: 59%;
  width: calc(100% - 24px);
  transform: translate(-50%, -50%);
}

.match-objective strong {
  display: block;
  color: #fff7cc;
  font-size: 1.22rem;
  font-weight: 950;
  line-height: 0.95;
  text-shadow:
    0 2px 0 rgba(59, 27, 0, 0.82),
    0 0 16px rgba(255, 209, 102, 0.58);
}

.match-rewards {
  position: relative;
  z-index: 1;
  grid-column: 4 / 9;
  grid-row: 2;
  display: grid;
  grid-template-columns: 455fr 10fr 455fr 10fr 455fr;
  height: 100%;
}

.match-reward {
  position: relative;
  display: block;
  padding: 0;
  text-align: center;
}

.match-reward::before {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 6px 7px;
  border: 1px solid rgba(255, 209, 102, 0);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 58%, rgba(125, 223, 255, 0.2), transparent 38%),
    linear-gradient(180deg, rgba(255, 209, 102, 0.12), rgba(255, 50, 79, 0.08));
  opacity: 0;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0),
    0 0 0 rgba(255, 209, 102, 0);
  transition: opacity 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.match-reward.is-active::before {
  border-color: rgba(255, 232, 142, 0.74);
  opacity: 1;
  box-shadow:
    inset 0 0 24px rgba(255, 209, 102, 0.13),
    0 0 18px rgba(255, 209, 102, 0.26),
    0 0 28px rgba(125, 223, 255, 0.16);
  animation: activeRewardPulse 1.2s ease-in-out infinite alternate;
}

.match-reward:nth-child(1) {
  grid-column: 1;
}

.match-reward:nth-child(2) {
  grid-column: 3;
}

.match-reward:nth-child(3) {
  grid-column: 5;
}

.match-reward span {
  z-index: 1;
  color: rgba(226, 244, 255, 0.92);
}

.match-reward strong {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #ffd166;
  font-size: 0.82rem;
  font-weight: 950;
  line-height: 1;
  text-shadow:
    0 2px 0 rgba(62, 27, 0, 0.86),
    0 0 12px rgba(255, 209, 102, 0.52);
}

.match-reward img {
  width: 20px;
  min-width: 20px;
  height: 20px;
  object-fit: contain;
  filter:
    drop-shadow(0 1px 0 rgba(255, 255, 255, 0.42))
    drop-shadow(0 0 7px rgba(125, 223, 255, 0.72));
}

.match-reward.is-active span {
  color: #ffffff;
  text-shadow:
    0 1px 8px rgba(0, 0, 0, 0.72),
    0 0 12px rgba(255, 209, 102, 0.42);
}

.match-reward.is-active strong {
  color: #fff2a8;
  text-shadow:
    0 2px 0 rgba(62, 27, 0, 0.86),
    0 0 14px rgba(255, 209, 102, 0.78);
}

.arena-board {
  --connect-board-padding: 12px;
  position: absolute;
  z-index: 4;
  top: 190px;
  left: 18px;
  right: 18px;
  display: grid;
  gap: 8px;
}

.column-gates {
  width: var(--connect-board-width);
  box-sizing: border-box;
  padding: 0 var(--connect-board-padding);
  justify-self: center;
  display: grid;
  grid-template-columns: repeat(var(--connect-columns), minmax(0, 1fr));
  gap: 6px;
}

.column-gates button {
  height: 33px;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  border: 1px solid rgba(49, 231, 255, 0.36);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(49, 231, 255, 0.28), rgba(3, 9, 16, 0.84)),
    rgba(3, 9, 16, 0.76);
  color: #d8fbff;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.column-gates button span {
  width: 21px;
  min-width: 0;
  height: 21px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 6px;
  background:
    radial-gradient(circle at 32% 18%, rgba(255, 255, 255, 0.95), transparent 30%),
    linear-gradient(180deg, #ecfeff, #67e8f9 52%, #0891b2);
  color: #03131a;
  font-size: 0.72rem;
  font-weight: 950;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.38);
  box-shadow:
    inset 0 -4px 8px rgba(6, 95, 115, 0.34),
    0 0 12px rgba(103, 232, 249, 0.42);
}

.column-gates-shell,
.board-axis-shell {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}

.turn-red .column-gates button {
  border-color: rgba(255, 50, 79, 0.5);
  background:
    linear-gradient(180deg, rgba(255, 50, 79, 0.32), rgba(3, 9, 16, 0.84)),
    rgba(3, 9, 16, 0.76);
  color: #ffd8df;
}

.turn-red .column-gates button span {
  border-color: rgba(255, 255, 255, 0.76);
  background:
    radial-gradient(circle at 32% 18%, rgba(255, 255, 255, 0.95), transparent 30%),
    linear-gradient(180deg, #ffe4e9, #ff526b 52%, #be123c);
  color: #2a0309;
  box-shadow:
    inset 0 -4px 8px rgba(136, 19, 55, 0.34),
    0 0 12px rgba(255, 50, 79, 0.46);
}

.turn-gold .column-gates button {
  border-color: rgba(255, 209, 102, 0.48);
  background:
    linear-gradient(180deg, rgba(255, 209, 102, 0.32), rgba(3, 9, 16, 0.84)),
    rgba(3, 9, 16, 0.76);
  color: #ffe6a3;
}

.turn-gold .column-gates button span {
  border-color: rgba(255, 255, 255, 0.76);
  background:
    radial-gradient(circle at 32% 18%, rgba(255, 255, 255, 0.95), transparent 30%),
    linear-gradient(180deg, #fff7cc, #ffd166 52%, #d97706);
  color: #251200;
  box-shadow:
    inset 0 -4px 8px rgba(146, 64, 14, 0.3),
    0 0 12px rgba(255, 209, 102, 0.46);
}

.column-gates button:not(:disabled):hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.62);
}

.column-gates button:disabled {
  opacity: 0.34;
  cursor: default;
}

.board-frame {
  position: relative;
  width: var(--connect-board-width);
  justify-self: center;
  display: grid;
  aspect-ratio: var(--connect-board-ratio);
  grid-template-columns: repeat(var(--connect-columns), minmax(0, 1fr));
  grid-template-rows: repeat(var(--connect-rows), minmax(0, 1fr));
  gap: 6px;
  padding: var(--connect-board-padding);
  border: 1px solid rgba(49, 231, 255, 0.38);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.11), transparent 18%),
    linear-gradient(180deg, rgba(11, 26, 42, 0.96), rgba(4, 10, 19, 0.98));
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.035),
    inset 0 -20px 38px rgba(0, 0, 0, 0.34),
    0 18px 54px rgba(0, 0, 0, 0.52),
    0 0 34px rgba(49, 231, 255, 0.18);
}

.board-frame::before,
.board-frame::after {
  content: "";
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 7px;
  border-radius: 999px;
  background: linear-gradient(180deg, #31e7ff, #ff324f 52%, #ffd166);
  box-shadow: 0 0 18px rgba(49, 231, 255, 0.42);
}

.board-frame::before {
  left: -9px;
}

.board-frame::after {
  right: -9px;
}

.cell-button {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.cell-button:disabled {
  cursor: default;
}

.cell-rim {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 1px solid rgba(124, 215, 255, 0.24);
  border-radius: 50%;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(1, 6, 13, 0.96), rgba(3, 12, 22, 0.98));
  box-shadow:
    inset 0 8px 13px rgba(0, 0, 0, 0.72),
    inset 0 -4px 12px rgba(49, 231, 255, 0.1),
    0 1px 0 rgba(255, 255, 255, 0.08);
}

.cell-button:not(:disabled):hover .cell-rim {
  border-color: rgba(255, 255, 255, 0.54);
  box-shadow:
    inset 0 8px 13px rgba(0, 0, 0, 0.66),
    0 0 18px rgba(49, 231, 255, 0.22);
}

.disc {
  position: relative;
  width: 82%;
  height: 82%;
  display: block;
  border-radius: 50%;
  transform: translateZ(0);
  box-shadow:
    inset 0 3px 0 rgba(255, 255, 255, 0.44),
    inset 0 -9px 15px rgba(0, 0, 0, 0.34),
    0 5px 11px rgba(0, 0, 0, 0.38);
}

.disc::before {
  content: "";
  position: absolute;
  inset: 17%;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: inherit;
  box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.25);
}

.disc.red {
  background:
    radial-gradient(circle at 32% 22%, rgba(255, 255, 255, 0.5), transparent 17%),
    linear-gradient(145deg, #ff7383 0%, #ff2443 42%, #8e061b 100%);
  filter: drop-shadow(0 0 10px rgba(255, 50, 79, 0.58));
}

.disc.gold {
  background:
    radial-gradient(circle at 32% 22%, rgba(255, 255, 255, 0.58), transparent 17%),
    linear-gradient(145deg, #fff1a8 0%, #ffc43d 42%, #9b5a05 100%);
  filter: drop-shadow(0 0 10px rgba(255, 209, 102, 0.58));
}

.disc.dropped {
  animation: discDrop 0.42s cubic-bezier(0.14, 0.8, 0.26, 1.18) both;
}

.cell-button.last .cell-rim {
  animation: cellImpact 0.58s ease both;
}

.cell-button.winning .cell-rim {
  border-color: rgba(255, 241, 168, 0.82);
  box-shadow:
    inset 0 8px 13px rgba(0, 0, 0, 0.6),
    0 0 0 2px rgba(255, 209, 102, 0.22),
    0 0 22px rgba(255, 209, 102, 0.62);
}

.cell-button.winning .disc {
  animation: winnerPulse 0.84s ease-in-out infinite alternate;
}

.winning-beam {
  position: absolute;
  z-index: 7;
  height: 9px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #fff7c7 14%, #ffd166 48%, #31e7ff 82%, transparent);
  box-shadow: 0 0 16px rgba(255, 209, 102, 0.82), 0 0 32px rgba(49, 231, 255, 0.42);
  transform-origin: left center;
  pointer-events: none;
  animation: winnerBeam 0.74s ease both;
}

.end-game-button {
  justify-self: center;
  min-width: 168px;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 14px;
  border: 1px solid rgba(255, 232, 142, 0.68);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 0, rgba(255, 255, 255, 0.22), transparent 48%),
    linear-gradient(135deg, rgba(255, 50, 79, 0.28), rgba(255, 209, 102, 0.22)),
    rgba(5, 8, 20, 0.82);
  color: #fff7cc;
  font-size: 0.72rem;
  font-weight: 950;
  line-height: 1;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 10px 28px rgba(0, 0, 0, 0.36),
    0 0 24px rgba(255, 209, 102, 0.2);
  text-shadow:
    0 2px 0 rgba(74, 34, 0, 0.86),
    0 0 12px rgba(255, 209, 102, 0.52);
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.end-game-button svg {
  color: #ffd166;
  filter: drop-shadow(0 0 8px rgba(255, 209, 102, 0.52));
}

.end-game-button:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 244, 191, 0.86);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 14px 34px rgba(0, 0, 0, 0.4),
    0 0 30px rgba(255, 209, 102, 0.28);
}

.launch-dialog-layer {
  position: absolute;
  z-index: 14;
  top: 190px;
  left: 18px;
  right: 18px;
  bottom: 31%;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.launch-dialog {
  width: min(100%, 444px);
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(49, 231, 255, 0.18), rgba(255, 209, 102, 0.08)),
    rgba(3, 9, 16, 0.9);
  box-shadow: 0 18px 52px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px);
  pointer-events: auto;
}

.launch-dialog-head {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.launch-dialog-head span {
  color: #9af7ff;
  font-size: 0.68rem;
  font-weight: 950;
  text-transform: uppercase;
}

.launch-dialog-head h2,
.launch-dialog-head p {
  margin: 0;
}

.launch-dialog-head h2 {
  min-width: 0;
  overflow: hidden;
  color: #ffffff;
  font-size: 1.28rem;
  font-weight: 950;
  line-height: 1.02;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launch-dialog-head p {
  min-width: 0;
  overflow: hidden;
  color: #c6d4df;
  font-size: 0.74rem;
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launch-mode-grid {
  display: grid;
  gap: 10px;
}

.launch-mode-button {
  --launch-accent: 49, 231, 255;
  min-width: 0;
  min-height: 86px;
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) minmax(92px, auto);
  align-items: center;
  gap: 9px;
  overflow: hidden;
  padding: 12px 13px;
  border: 1px solid rgba(255, 209, 102, 0.4);
  border-radius: 8px;
  background: #04070b;
  color: #ffffff;
  cursor: pointer;
  isolation: isolate;
  text-align: left;
  box-shadow:
    0 16px 34px rgba(0, 0, 0, 0.38),
    0 0 22px rgba(var(--launch-accent), 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  transition: transform 0.16s ease, border-color 0.16s ease, filter 0.16s ease, box-shadow 0.16s ease;
}

.launch-mode-button::before,
.launch-mode-button::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.launch-mode-button::before {
  z-index: -2;
  background: url("../../assets/games/connect-four/launch-banner.png") center / cover no-repeat;
  filter: saturate(1.12) contrast(1.08);
}

.launch-mode-button::after {
  z-index: -1;
  background:
    linear-gradient(90deg, rgba(1, 4, 12, 0.92), rgba(1, 4, 12, 0.62) 42%, rgba(1, 4, 12, 0.22) 72%),
    radial-gradient(circle at 78% 42%, rgba(var(--launch-accent), 0.18), transparent 32%);
}

.launch-mode-button:not(:disabled):hover {
  transform: translateY(-3px) scale(1.01);
  border-color: rgba(255, 244, 191, 0.76);
  filter: brightness(1.08) saturate(1.08);
  box-shadow:
    0 22px 42px rgba(0, 0, 0, 0.44),
    0 0 30px rgba(var(--launch-accent), 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.launch-mode-symbol {
  width: 42px;
  height: 42px;
  padding: 9px;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(var(--launch-accent), 0.26)),
    rgba(5, 12, 23, 0.64);
  color: #ffffff;
  filter: drop-shadow(0 0 12px rgba(var(--launch-accent), 0.34));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.12);
}

.launch-mode-copy {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.launch-mode-button b,
.launch-mode-button small,
.launch-mode-button strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launch-mode-button b {
  color: #fff7cc;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.08rem;
  font-weight: 950;
  line-height: 0.95;
  text-shadow:
    0 2px 0 rgba(63, 27, 0, 0.88),
    0 0 14px rgba(255, 209, 102, 0.48),
    0 0 28px rgba(var(--launch-accent), 0.28);
}

.launch-mode-button small {
  color: rgba(226, 244, 255, 0.9);
  font-size: 0.64rem;
  font-weight: 900;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.72);
  text-transform: uppercase;
}

.launch-price {
  min-width: 88px;
  min-height: 46px;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 232, 142, 0.64);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 0, rgba(255, 255, 255, 0.22), transparent 48%),
    linear-gradient(180deg, rgba(35, 18, 3, 0.62), rgba(8, 12, 24, 0.72)),
    rgba(5, 8, 20, 0.66);
  color: #ffd166;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.08rem;
  font-weight: 950;
  line-height: 0.95;
  text-align: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -8px 18px rgba(97, 41, 0, 0.22),
    0 0 18px rgba(255, 209, 102, 0.24);
  text-shadow:
    0 2px 0 rgba(74, 34, 0, 0.9),
    0 0 12px rgba(255, 209, 102, 0.56);
}

.launch-price svg {
  width: 17px;
  min-width: 17px;
  height: 17px;
  padding: 0;
  background: transparent;
  color: #7ddfff;
  filter:
    drop-shadow(0 1px 0 rgba(255, 255, 255, 0.42))
    drop-shadow(0 0 8px rgba(125, 223, 255, 0.5));
}

.launch-price span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launch-price.is-free {
  background:
    linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(49, 231, 255, 0.22)),
    rgba(5, 8, 20, 0.66);
  color: #eafff7;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 0.74rem;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.62);
}

.launch-mode-button.tone-red {
  --launch-accent: 255, 50, 79;
}

.launch-mode-button.tone-gold {
  --launch-accent: 255, 209, 102;
}

.launch-mode-button.tone-cyan {
  --launch-accent: 105, 245, 201;
}

.particle {
  position: absolute;
  z-index: 20;
  border-radius: 2px;
  box-shadow: 0 0 10px currentColor;
  animation: particlePop 1.2s cubic-bezier(0.12, 0.74, 0.24, 1) forwards;
}

@media (max-height: 790px) {
  .score-strip {
    top: 14px;
  }

  .score-card {
    min-height: 47px;
    padding: 7px 9px;
  }

  .match-panel {
    top: 62px;
  }

  .match-objective span,
  .match-reward span {
    font-size: 0.52rem;
  }

  .match-objective,
  .match-reward {
    gap: 0;
    padding: 0;
  }

  .match-objective strong {
    font-size: 1.06rem;
  }

  .match-reward strong {
    font-size: 0.72rem;
  }

  .match-reward img {
    width: 17px;
    min-width: 17px;
    height: 17px;
  }

  .arena-board {
    --connect-board-padding: 10px;
    top: 164px;
    gap: 6px;
  }

  .column-gates button {
    height: 25px;
  }

  .board-frame {
    gap: 5px;
    padding: var(--connect-board-padding);
  }

  .launch-dialog-layer {
    top: 164px;
    bottom: 30%;
  }

  .end-game-button {
    min-width: 148px;
    min-height: 34px;
    padding: 7px 12px;
    font-size: 0.64rem;
  }

  .launch-dialog {
    gap: 8px;
    padding: 10px;
  }

  .launch-dialog-head h2 {
    font-size: 1rem;
  }

  .launch-mode-grid {
    gap: 7px;
  }

  .launch-mode-button {
    min-height: 68px;
    grid-template-columns: 36px minmax(0, 1fr) minmax(74px, auto);
    gap: 7px;
    padding: 8px 9px;
  }

  .launch-mode-symbol {
    width: 34px;
    height: 34px;
    padding: 7px;
  }

  .launch-mode-button b {
    font-size: 0.92rem;
  }

  .launch-mode-button small {
    font-size: 0.55rem;
  }

  .launch-price {
    min-width: 74px;
    min-height: 36px;
    gap: 4px;
    padding: 5px 6px;
    font-size: 0.9rem;
  }

  .launch-price svg {
    width: 14px;
    min-width: 14px;
    height: 14px;
  }
}

@media (max-width: 390px) {
  .score-strip,
  .arena-board,
  .launch-dialog-layer {
    left: 13px;
    right: 13px;
  }

  .arena-board {
    --connect-board-padding: 9px;
  }

  .match-panel {
    left: 15%;
    right: 15%;
    top: 62px;
  }

  .match-objective,
  .match-reward {
    gap: 0;
    padding: 0;
  }

  .match-objective span,
  .match-reward span,
  .match-objective strong,
  .match-reward strong {
    width: calc(100% - 12px);
  }

  .match-objective span,
  .match-reward span {
    font-size: 0.48rem;
  }

  .match-objective strong {
    font-size: 0.96rem;
  }

  .match-reward strong {
    gap: 2px;
    font-size: 0.66rem;
  }

  .match-reward img {
    width: 15px;
    min-width: 15px;
    height: 15px;
  }

  .score-strip {
    gap: 6px;
  }

  .score-card {
    padding: 7px;
  }

  .score-card span {
    font-size: 0.61rem;
  }

  .board-frame {
    gap: 4px;
    padding: var(--connect-board-padding);
  }

  .end-game-button {
    min-width: 136px;
    min-height: 32px;
    padding: 6px 10px;
    font-size: 0.58rem;
  }

  .launch-mode-button {
    min-height: 72px;
    grid-template-columns: 34px minmax(0, 1fr) minmax(70px, auto);
    gap: 6px;
    padding: 8px;
  }

  .launch-mode-symbol {
    width: 32px;
    height: 32px;
    padding: 7px;
  }

  .launch-mode-button b {
    font-size: 0.92rem;
  }

  .launch-mode-button small {
    font-size: 0.53rem;
  }

  .launch-price {
    min-width: 70px;
    min-height: 36px;
    font-size: 0.84rem;
  }

  .launch-price.is-free {
    font-size: 0.66rem;
  }
}

@keyframes beamSweep {
  from {
    opacity: 0.52;
    transform: rotate(-16deg) translateX(-4%);
  }
  to {
    opacity: 0.9;
    transform: rotate(12deg) translateX(4%);
  }
}

@keyframes stageImageDrift {
  from {
    transform: scale(1.04) translateY(0);
  }
  to {
    transform: scale(1.08) translateY(-1.2%);
  }
}

@keyframes discDrop {
  0% {
    transform: translateY(var(--drop-offset)) scale(0.84);
    filter: brightness(1.18);
  }
  72% {
    transform: translateY(4%) scale(1.03);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes cellImpact {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes winnerPulse {
  from {
    transform: scale(1);
    filter: brightness(1) drop-shadow(0 0 10px rgba(255, 209, 102, 0.46));
  }
  to {
    transform: scale(1.08);
    filter: brightness(1.18) drop-shadow(0 0 18px rgba(255, 209, 102, 0.82));
  }
}

@keyframes winnerBeam {
  from {
    opacity: 0;
    clip-path: inset(0 100% 0 0);
  }
  to {
    opacity: 1;
    clip-path: inset(0 0 0 0);
  }
}

@keyframes activeRewardPulse {
  from {
    filter: brightness(0.98);
  }
  to {
    filter: brightness(1.18);
  }
}

@keyframes particlePop {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--tx), var(--ty), 0) rotate(var(--spin)) scale(0.62);
  }
}
</style>
