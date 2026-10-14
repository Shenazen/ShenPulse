<script setup lang="ts">
import type { CellValue, Player, GamePhase, GameMode, GridCell, RewardResult, Particle } from './connect-four/models'
import { createConnectFourBoardEngine } from './connect-four/board-engine'
import { createConnectFourSound } from './connect-four/sound'
import { getGameNumberFormatter } from '../../utils/numberFormat'
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

const AI_PLAYER: Player = 2
const REWARD_DIRECTIONS: ConnectFourRewardDirection[] = ['horizontal', 'vertical', 'diagonal']

const { t } = useI18n()
let idSeed = 1
let aiTimer: number | undefined
let launchDialogTimer: number | undefined
let unlockTimer: number | undefined

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
const sound = createConnectFourSound(soundEnabled)
const { getAudioContext, playTone, playMoveSound, playStartSound, playDrawSound, playWinSound } = sound
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
const { findOpenRow, findWinningCells, winDirectionForCells, collectDirection, selectAiColumn, selectEasyAiColumn, selectHardAiColumn, orderedAvailableColumns, minimax, simulateMove, evaluateMove, evaluateBoardPosition, collectWindows, scoreWindow } = createConnectFourBoardEngine({
  board, rowCount, columnCount, winLength, mode, availableColumns,
})
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
  sound.dispose()
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
    amount: getGameNumberFormatter(undefined, { maximumFractionDigits: 0 }).format(cost),
  })
}

function formatRewardAmount(value: unknown) {
  const amount = normalizeConnectFourRewardAmount(value)
  if (amount <= 0) return t('playableGames.connectFour.rewards.noReward')
  return getGameNumberFormatter(undefined, { maximumFractionDigits: 0 }).format(amount)
}

function formatHudRewardAmount(value: unknown) {
  const amount = normalizeConnectFourRewardAmount(value)
  return getGameNumberFormatter(undefined, { maximumFractionDigits: 0 }).format(amount)
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

<style scoped src="./styles/connect-four/index.generated.css"></style>
