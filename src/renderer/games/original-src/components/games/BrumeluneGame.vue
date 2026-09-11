<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import villageImageUrl from '../../../../assets/games/catalog/brumelune.png?url'
import {
  CAMPS,
  DEFAULT_CONFIG,
  EVENTS,
  OCCUPATIONS,
  ROLE_CATALOG,
  ROLE_BY_ID,
  VARIANTS,
  addSpectatorPrediction,
  assignDeathReactionWithoutTarget,
  beginDiscussion,
  beginVote,
  checkVictory,
  confirmRoleReveal,
  correctLastAction,
  createGame,
  createId,
  currentNightStep,
  exportGameSummary,
  finishVerdict,
  getRole,
  hydrateGame,
  omniscientGameView,
  prepareDawn,
  privatePlayerView,
  privateStateMap,
  publicGameView,
  recommendedRoleIds,
  requestSecondVote,
  resolveDeathTrigger,
  resolveVote,
  revealRole,
  serializeGame,
  skipNightAction,
  startNight,
  submitNightAction,
  submitVote,
  validateSetup,
} from '../../domain/brumeluneEngine.mjs'

type Screen = 'home' | 'setup' | 'reveal' | 'game' | 'ended'
type SetupStep = 'players' | 'roles' | 'options'

const STORAGE_KEY = 'shenpulse.brumelune.game.v1'
const FAVORITES_KEY = 'shenpulse.brumelune.favorites.v1'
const api = window.shenPulse as any
const screen = ref<Screen>('home')
const setupStep = ref<SetupStep>('players')
const players = ref(defaultPlayers(8))
const roleIds = ref<string[]>(recommendedRoleIds(8))
const config = ref<any>({ ...DEFAULT_CONFIG })
const game = ref<any>(null)
const selectedRoleId = ref('astromancienne')
const roleSearch = ref('')
const roleCampFilter = ref('all')
const roleComplexityFilter = ref('all')
const revealUnlocked = ref(false)
const secretStepUnlocked = ref(false)
const selectedTargetId = ref('')
const selectedTargetIds = ref<string[]>([])
const actionChoice = ref('')
const activePanel = ref<'play' | 'players' | 'history' | 'spectators' | 'settings'>('play')
const toastMessage = ref('')
const confirmationOpen = ref(false)
const showPrivateCodes = ref(false)
const discussionRemaining = ref(0)
const voteRemaining = ref(0)
const timerRunning = ref(false)
const cameraActive = ref(false)
const cameraError = ref('')
const recording = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
const lanInfo = ref<any>(null)
const qrDataUrl = ref('')
const favorites = ref<any[]>(loadFavorites())
const favoriteName = ref('Ma composition')
const spectatorName = ref('Public')
const spectatorTarget = ref('')
const spectatorCamp = ref('hostile')
const spectatorRole = ref('')
const phaseCaption = ref('Prêt à entrer dans Brumelune.')
let toastTimer = 0
let phaseTimer = 0
let lanPollTimer = 0
let lanSyncTimer = 0
let cameraStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let recordingChunks: Blob[] = []
let audioContext: AudioContext | null = null

const setupValidation = computed(() => validateSetup({ players: players.value, roleIds: roleIds.value, config: config.value }))
const selectedRole = computed(() => ROLE_BY_ID[selectedRoleId.value] || ROLE_CATALOG[0])
const filteredRoles = computed(() => ROLE_CATALOG.filter((role: any) => {
  const query = roleSearch.value.trim().toLocaleLowerCase('fr')
  const matchesSearch = !query || `${role.name} ${role.publicDescription} ${role.tags.join(' ')}`.toLocaleLowerCase('fr').includes(query)
  const matchesCamp = roleCampFilter.value === 'all' || role.initialCamp === roleCampFilter.value
  const matchesComplexity = roleComplexityFilter.value === 'all' || role.complexity === roleComplexityFilter.value
  return matchesSearch && matchesCamp && matchesComplexity
}))
const selectedCounts = computed(() => roleIds.value.reduce((counts: Record<string, number>, id: string) => {
  counts[id] = (counts[id] || 0) + 1
  return counts
}, {}))
const currentRevealPlayer = computed(() => game.value?.players?.[game.value.revealIndex] || null)
const currentRevealView = computed(() => currentRevealPlayer.value && revealUnlocked.value ? privatePlayerView(game.value, currentRevealPlayer.value.id) : null)
const nightStep = computed(() => game.value ? currentNightStep(game.value) : null)
const nightActor = computed(() => nightStep.value ? game.value.players.find((player: any) => player.id === nightStep.value.actorId) : null)
const nightPrompt = computed(() => nightActor.value && secretStepUnlocked.value ? privatePlayerView(game.value, nightActor.value.id).actionPrompt : null)
const publicPlayers = computed(() => game.value?.players || [])
const alivePlayers = computed(() => publicPlayers.value.filter((player: any) => player.alive))
const pendingDeathTrigger = computed(() => game.value?.pendingDeathTriggers?.[0] || null)
const deathTriggerActor = computed(() => pendingDeathTrigger.value ? game.value.players.find((player: any) => player.id === pendingDeathTrigger.value.actorId) : null)
const deathTriggerTargets = computed(() => {
  if (!pendingDeathTrigger.value) return []
  return alivePlayers.value.filter((player: any) => player.id !== pendingDeathTrigger.value.actorId && (pendingDeathTrigger.value.kind !== 'titan' || player.currentCamp === 'hostile'))
})
const eligibleVoters = computed(() => alivePlayers.value.filter((player: any) => !player.statuses.includes('no-vote')))
const currentVoter = computed(() => eligibleVoters.value.find((player: any) => !(player.id in (game.value?.votes || {}))) || null)
const currentVoterUnlocked = ref(false)
const winnerPlayers = computed(() => game.value?.players?.filter((player: any) => game.value.winners.includes(player.id)) || [])
const publicHistory = computed(() => game.value?.history?.filter((entry: any) => entry.visibility === 'public') || [])
const fullHistory = computed(() => game.value?.history || [])
const spectatorScores = computed(() => {
  const scores: Record<string, { name: string, score: number }> = {}
  for (const prediction of game.value?.spectatorPredictions || []) {
    scores[prediction.spectatorId] ||= { name: prediction.spectatorName, score: 0 }
    scores[prediction.spectatorId].score += Number(prediction.score || 0)
  }
  return Object.values(scores).sort((left, right) => right.score - left.score)
})
const eventOptions = computed(() => EVENTS.filter((event: any) => config.value.selectedEventIds.includes(event.id)))
const canResume = computed(() => Boolean(loadSavedGame(false)))
const secretCameraPhase = computed(() => ['reveal', 'night', 'death-trigger', 'vote'].includes(game.value?.phase))
const phaseTitle = computed(() => {
  const phase = game.value?.phase
  return ({
    'night-intro': 'Le village s’endort',
    night: `Nuit ${game.value?.night || 1}`,
    dawn: `Aube ${game.value?.night || 1}`,
    discussion: `Conseil · Jour ${game.value?.day || 1}`,
    vote: 'Bulletins du conseil',
    verdict: 'Verdict du conseil',
    'death-trigger': 'Dernière volonté',
    ended: 'La brume se dissipe',
  } as Record<string, string>)[phase] || 'Veilleurs de Brumelune'
})

watch([players, config], () => {
  if (roleIds.value.length !== players.value.length) roleIds.value = recommendedRoleIds(players.value.length, config.value)
}, { deep: true })

watch(game, () => {
  if (!game.value) return
  try { localStorage.setItem(STORAGE_KEY, serializeGame(game.value)) } catch {}
  scheduleLanSync()
  if (game.value.finished) screen.value = 'ended'
}, { deep: true })

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('shenpulse:brumelune-effect', handleExternalEffect as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('shenpulse:brumelune-effect', handleExternalEffect as EventListener)
  window.clearTimeout(toastTimer)
  window.clearInterval(phaseTimer)
  window.clearTimeout(lanPollTimer)
  window.clearTimeout(lanSyncTimer)
  stopCamera()
  void api?.brumeluneLan?.stop?.().catch(() => {})
  audioContext?.close().catch(() => {})
})

function defaultPlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: createId('player'), name: `Joueur ${index + 1}`, avatar: ['✦', '☾', '◇', '◈', '✺', '⬡', '♜', '❖'][index % 8] }))
}

function beginCreation() {
  screen.value = 'setup'
  setupStep.value = 'players'
  if (players.value.length < 5) players.value = defaultPlayers(8)
  roleIds.value = recommendedRoleIds(players.value.length, config.value)
}

function addPlayer() {
  if (players.value.length >= 30) return
  const index = players.value.length
  players.value.push({ id: createId('player'), name: `Joueur ${index + 1}`, avatar: ['✦', '☾', '◇', '◈', '✺', '⬡', '♜', '❖'][index % 8] })
}

function removePlayer(index: number) {
  if (players.value.length <= 5) return
  players.value.splice(index, 1)
}

function autoCompose() {
  roleIds.value = recommendedRoleIds(players.value.length, config.value)
  notify('Composition équilibrée générée.')
}

function addRole(roleId: string) {
  if (roleIds.value.length >= players.value.length) return notify('Retirez d’abord un rôle de la composition.')
  roleIds.value.push(roleId)
}

function removeRole(roleId: string) {
  const index = roleIds.value.lastIndexOf(roleId)
  if (index >= 0) roleIds.value.splice(index, 1)
}

function saveFavorite() {
  const entry = {
    id: createId('favorite'),
    name: favoriteName.value.trim().slice(0, 50) || 'Composition favorite',
    playerCount: players.value.length,
    roleIds: [...roleIds.value],
    config: { ...config.value },
  }
  favorites.value = [entry, ...favorites.value].slice(0, 12)
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.value))
  notify('Composition enregistrée dans vos favoris.')
}

function applyFavorite(favorite: any) {
  players.value = defaultPlayers(favorite.playerCount)
  roleIds.value = [...favorite.roleIds]
  config.value = { ...DEFAULT_CONFIG, ...favorite.config }
  notify(`Composition « ${favorite.name} » chargée.`)
}

function loadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function requestLaunch() {
  if (!setupValidation.value.valid) return notify(setupValidation.value.errors[0])
  confirmationOpen.value = setupValidation.value.warnings.length > 0
  if (!confirmationOpen.value) launchGame()
}

function launchGame() {
  confirmationOpen.value = false
  game.value = createGame({ players: players.value, roleIds: roleIds.value, config: config.value, favoriteName: favoriteName.value })
  screen.value = 'reveal'
  revealUnlocked.value = false
  phaseCaption.value = 'Chaque joueur consulte son rôle à l’abri des regards.'
  playCue('start')
  if (config.value.cameraEnabled) void startCamera()
  if (config.value.deviceMode === 'devices' || config.value.spectatorEnabled) void startLan()
}

function showRole() {
  if (!currentRevealPlayer.value) return
  revealRole(game.value, currentRevealPlayer.value.id)
  revealUnlocked.value = true
  playCue('secret')
}

function confirmCurrentRole() {
  if (!currentRevealPlayer.value) return
  confirmRoleReveal(game.value, currentRevealPlayer.value.id)
  revealUnlocked.value = false
  playCue('confirm')
  if (game.value.phase === 'night-intro') {
    screen.value = 'game'
    activePanel.value = 'play'
    phaseCaption.value = 'Tous les rôles sont distribués. Le village peut s’endormir.'
  }
}

function startCurrentNight() {
  startNight(game.value)
  resetSecretSelection()
  phaseCaption.value = 'Tous les joueurs ferment les yeux ou se tournent. Seul le personnage appelé consulte l’écran.'
  playCue('night')
  speak(`La nuit ${game.value.night} commence. Tous les habitants ferment les yeux.`)
  if (!game.value.nightQueue.length) prepareDawn(game.value)
}

function revealNightStep() {
  secretStepUnlocked.value = true
  playCue('secret')
  speak(`${getRole(nightStep.value.roleId).name}, vous pouvez regarder l’écran.`)
}

function toggleTarget(targetId: string, multi = false) {
  if (!multi) {
    selectedTargetId.value = targetId
    return
  }
  if (selectedTargetIds.value.includes(targetId)) selectedTargetIds.value = selectedTargetIds.value.filter((id) => id !== targetId)
  else selectedTargetIds.value = [...selectedTargetIds.value, targetId].slice(-2)
}

function submitCurrentNightAction(skip = false) {
  const step = nightStep.value
  if (!step) return
  try {
    const payload: any = skip
      ? { skip: true }
      : step.action === 'bond' || step.action === 'charm'
        ? { targetIds: selectedTargetIds.value }
        : step.action === 'choose-camp'
          ? { camp: actionChoice.value }
          : step.action === 'choose-event'
            ? { eventId: actionChoice.value }
            : step.action === 'borrow'
              ? { borrowedAction: actionChoice.value, targetId: selectedTargetId.value }
              : step.action === 'sense-neighbors'
                ? {}
                : { targetId: selectedTargetId.value, ...(actionChoice.value ? { choice: actionChoice.value } : {}) }
    if (skip) skipNightAction(game.value, step.id)
    else submitNightAction(game.value, step.id, payload)
    resetSecretSelection()
    playCue('confirm')
    if (game.value.phase === 'dawn') {
      phaseCaption.value = dawnCaption()
      playCue('dawn')
      speak(phaseCaption.value)
    }
  } catch (error: any) {
    notify(error?.message || 'Action impossible.')
  }
}

function resetSecretSelection() {
  secretStepUnlocked.value = false
  selectedTargetId.value = ''
  selectedTargetIds.value = []
  actionChoice.value = ''
}

function submitDeathReaction(targetId: string) {
  try {
    resolveDeathTrigger(game.value, pendingDeathTrigger.value.actorId, targetId)
    selectedTargetId.value = ''
    secretStepUnlocked.value = false
    playCue('impact')
    if (game.value.phase === 'dawn') phaseCaption.value = dawnCaption()
  } catch (error: any) { notify(error?.message || 'Réaction impossible.') }
}

function skipDeathReaction() {
  assignDeathReactionWithoutTarget(game.value, pendingDeathTrigger.value.actorId)
  secretStepUnlocked.value = false
}

function dawnCaption() {
  const names = (game.value.dawnSummary?.victimIds || []).map((id: string) => game.value.players.find((player: any) => player.id === id)?.name).filter(Boolean)
  return names.length ? `À l’aube, ${names.join(' et ')} ne répondent plus à l’appel.` : 'À l’aube, tous les habitants répondent encore à l’appel.'
}

function openDiscussion() {
  beginDiscussion(game.value)
  discussionRemaining.value = game.value.discussionSeconds
  timerRunning.value = true
  startCountdown('discussion')
  phaseCaption.value = 'Le conseil est ouvert. Observez, argumentez, doutez.'
  playCue('day')
  speak(`Le conseil du jour ${game.value.day} est ouvert.`)
}

function startCountdown(kind: 'discussion' | 'vote') {
  window.clearInterval(phaseTimer)
  phaseTimer = window.setInterval(() => {
    if (!timerRunning.value || game.value?.paused) return
    const target = kind === 'discussion' ? discussionRemaining : voteRemaining
    target.value = Math.max(0, target.value - 1)
    if (target.value === 0) {
      window.clearInterval(phaseTimer)
      timerRunning.value = false
      playCue('timer')
      speak(kind === 'discussion' ? 'Le temps du débat est terminé.' : 'Le vote est terminé.')
    }
  }, 1000)
}

function adjustTimer(seconds: number) {
  if (game.value.phase === 'discussion') discussionRemaining.value = Math.max(0, discussionRemaining.value + seconds)
  if (game.value.phase === 'vote') voteRemaining.value = Math.max(0, voteRemaining.value + seconds)
}

function openVote() {
  beginVote(game.value)
  voteRemaining.value = game.value.config.voteSeconds
  currentVoterUnlocked.value = false
  selectedTargetId.value = ''
  timerRunning.value = true
  startCountdown('vote')
  phaseCaption.value = game.value.config.voteMode === 'secret' ? 'Les bulletins restent scellés jusqu’à la dernière confirmation.' : 'Le vote du conseil est public.'
  playCue('vote')
}

function revealVoterScreen() {
  currentVoterUnlocked.value = true
  selectedTargetId.value = ''
}

function confirmVote(abstain = false) {
  if (!currentVoter.value) return
  try {
    submitVote(game.value, currentVoter.value.id, abstain ? null : selectedTargetId.value)
    currentVoterUnlocked.value = false
    selectedTargetId.value = ''
    playCue('confirm')
    if (!currentVoter.value) {
      window.clearInterval(phaseTimer)
      timerRunning.value = false
      resolveVote(game.value)
      phaseCaption.value = verdictCaption()
      playCue('verdict')
      speak(phaseCaption.value)
    }
  } catch (error: any) { notify(error?.message || 'Vote impossible.') }
}

function forceResolveVote() {
  if (!Object.keys(game.value.votes).length) return notify('Aucun bulletin n’a été déposé.')
  resolveVote(game.value)
  window.clearInterval(phaseTimer)
  timerRunning.value = false
  phaseCaption.value = verdictCaption()
}

function verdictCaption() {
  const id = game.value.voteResult?.eliminatedId
  if (!id) return game.value.voteResult?.outcome === 'tie' ? 'Le conseil reste partagé. Personne n’est condamné.' : 'Le conseil accorde sa grâce.'
  const player = game.value.players.find((candidate: any) => candidate.id === id)
  return `${player?.name || 'Un habitant'} est condamné par le conseil.`
}

function continueAfterVerdict() {
  finishVerdict(game.value)
  if (!game.value.finished) {
    phaseCaption.value = 'Le soleil décline. Préparez la prochaine nuit.'
    activePanel.value = 'play'
  }
}

function askSecondVote() {
  const magistrate = alivePlayers.value.find((player: any) => player.currentRoleId === 'magistrat' && Number(player.charges || 0) > 0)
  if (!magistrate) return notify('Aucun rappel du conseil n’est disponible.')
  requestSecondVote(game.value, magistrate.id)
  continueAfterVerdict()
}

function restoreCheckpoint() {
  if (correctLastAction(game.value)) {
    resetSecretSelection()
    currentVoterUnlocked.value = false
    notify('Le point de contrôle précédent a été restauré.')
  } else notify('Aucun point de contrôle antérieur.')
}

function togglePause() {
  game.value.paused = !game.value.paused
  timerRunning.value = !game.value.paused
  notify(game.value.paused ? 'Partie mise en pause.' : 'Partie reprise.')
}

function manuallyEnd() {
  const result = checkVictory(game.value)
  if (!result.ended) notify('Aucune condition de victoire n’est remplie.')
}

function resumeGame() {
  const restored = loadSavedGame(true)
  if (!restored) return notify('Aucune sauvegarde compatible.')
  game.value = restored
  screen.value = restored.finished ? 'ended' : restored.phase === 'reveal' ? 'reveal' : 'game'
  config.value = { ...restored.config }
  players.value = restored.players.map((player: any) => ({ id: player.id, name: player.name, avatar: player.avatar }))
  roleIds.value = restored.players.map((player: any) => player.initialRoleId)
  phaseCaption.value = 'La partie a repris depuis la dernière action importante.'
  if (restored.config.cameraEnabled) void startCamera()
  if (restored.config.deviceMode === 'devices' || restored.config.spectatorEnabled) void startLan()
}

function loadSavedGame(shouldHydrate: boolean) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = shouldHydrate ? hydrateGame(raw) : JSON.parse(raw)
    return value?.schemaVersion === 1 ? value : null
  } catch { return null }
}

function abandonGame() {
  if (!window.confirm('Abandonner cette partie et effacer sa reprise locale ?')) return
  stopCamera()
  void api?.brumeluneLan?.stop?.().catch(() => {})
  localStorage.removeItem(STORAGE_KEY)
  game.value = null
  lanInfo.value = null
  screen.value = 'home'
}

async function startLan() {
  if (!api?.brumeluneLan || !game.value) return
  try {
    lanInfo.value = await api.brumeluneLan.start(lanPayload())
    qrDataUrl.value = await QRCode.toDataURL(lanInfo.value.url, { width: 260, margin: 1, color: { dark: '#101126', light: '#f5f0ff' } })
    scheduleLanPoll()
  } catch (error: any) {
    notify(error?.message || 'Le compagnon réseau local n’a pas pu démarrer.')
  }
}

function lanPayload() {
  return {
    roomCode: game.value.roomCode,
    players: game.value.players.map((player: any) => ({ id: player.id, name: player.name, pin: player.pin })),
    spectatorEnabled: game.value.config.spectatorEnabled,
    spectatorMode: game.value.config.spectatorMode,
    publicState: publicGameView(game.value),
    privateStates: privateStateMap(game.value),
    omniscientState: omniscientGameView(game.value),
  }
}

function scheduleLanSync() {
  if (!lanInfo.value?.active || !game.value) return
  window.clearTimeout(lanSyncTimer)
  lanSyncTimer = window.setTimeout(async () => {
    try { lanInfo.value = await api.brumeluneLan.update(lanPayload()) } catch {}
  }, 180)
}

function scheduleLanPoll() {
  window.clearTimeout(lanPollTimer)
  lanPollTimer = window.setTimeout(async () => {
    try {
      const result = await api.brumeluneLan.poll()
      lanInfo.value = result.info
      for (const action of result.actions || []) processLanAction(action)
    } catch {}
    if (lanInfo.value?.active) scheduleLanPoll()
  }, 900)
}

function processLanAction(entry: any) {
  try {
    if (entry.type === 'night-action') {
      const step = currentNightStep(game.value)
      if (!step || !step.actorIds.includes(entry.actorId) || entry.payload.stepId !== step.id) return
      if (entry.payload.skip === 'true') skipNightAction(game.value, step.id)
      else submitNightAction(game.value, step.id, entry.payload)
      resetSecretSelection()
    }
    if (entry.type === 'vote' && game.value.phase === 'vote') submitVote(game.value, entry.actorId, entry.payload.targetId || null)
    if (entry.type === 'prediction') addSpectatorPrediction(game.value, { ...entry.payload, spectatorId: entry.actorId, spectatorName: entry.actorName })
    if (entry.type === 'confirm-role' && game.value.phase === 'reveal') {
      revealRole(game.value, entry.actorId)
      confirmRoleReveal(game.value, entry.actorId)
      if (game.value.phase === 'night-intro') {
        screen.value = 'game'
        activePanel.value = 'play'
        phaseCaption.value = 'Tous les rôles sont distribués. Le village peut s’endormir.'
      }
    }
    if (game.value.phase === 'vote' && !currentVoter.value) resolveVote(game.value)
  } catch (error: any) { notify(`Action distante refusée : ${error?.message || 'invalide'}`) }
}

async function copyJoinUrl() {
  if (!lanInfo.value?.url) return
  await api?.copy?.(lanInfo.value.url)
  notify('Adresse de connexion copiée.')
}

async function startCamera() {
  cameraError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'Caméra indisponible sur cet appareil.'
    return
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    cameraActive.value = true
    await nextTick()
    if (videoRef.value) videoRef.value.srcObject = cameraStream
  } catch {
    cameraError.value = 'Accès caméra refusé. Le jeu continue normalement sans caméra.'
    cameraActive.value = false
  }
}

function stopCamera() {
  if (recording.value) stopRecording()
  cameraStream?.getTracks().forEach((track) => track.stop())
  cameraStream = null
  cameraActive.value = false
}

function startRecording() {
  if (!cameraStream || !config.value.recordingEnabled) return
  if (!window.confirm('Confirmez-vous que tous les participants ont explicitement accepté cet enregistrement local ?')) return
  recordingChunks = []
  mediaRecorder = new MediaRecorder(cameraStream)
  mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data) }
  mediaRecorder.onstop = downloadRecording
  mediaRecorder.start()
  recording.value = true
}

function stopRecording() {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
  recording.value = false
}

function downloadRecording() {
  if (!recordingChunks.length) return
  const blob = new Blob(recordingChunks, { type: mediaRecorder?.mimeType || 'video/webm' })
  downloadBlob(blob, `brumelune-${game.value?.roomCode || 'partie'}.webm`)
  recordingChunks = []
}

function exportSummary() {
  const summary = exportGameSummary(game.value)
  downloadBlob(new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' }), `brumelune-${game.value.roomCode}-resume.json`)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function addHostPrediction() {
  if (!spectatorTarget.value) return notify('Choisissez un joueur à pronostiquer.')
  addSpectatorPrediction(game.value, {
    spectatorId: `local-${spectatorName.value}`,
    spectatorName: spectatorName.value,
    playerId: spectatorTarget.value,
    guessedCamp: spectatorCamp.value,
    guessedRoleId: spectatorRole.value,
    confidence: 50,
  })
  notify('Pronostic spectateur enregistré secrètement.')
}

function occupationName(id: string) {
  return OCCUPATIONS.find((occupation: any) => occupation.id === id)?.name || ''
}

function eventEnabled(eventId: string) {
  return config.value.selectedEventIds.includes(eventId)
}

function toggleEvent(eventId: string) {
  if (eventEnabled(eventId)) config.value.selectedEventIds = config.value.selectedEventIds.filter((id: string) => id !== eventId)
  else config.value.selectedEventIds = [...config.value.selectedEventIds, eventId]
}

function roleCampName(camp: string) {
  return CAMPS[camp]?.name || camp
}

function roleCampClass(camp: string) {
  return `camp-${camp}`
}

function formatTime(total: number) {
  const seconds = Math.max(0, Math.round(total || 0))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatMoment(entry: any) {
  if (entry.day) return `Jour ${entry.day}`
  if (entry.night) return `Nuit ${entry.night}`
  return 'Préparation'
}

function notify(message: string) {
  toastMessage.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastMessage.value = '' }, 3600)
}

function playCue(kind: string) {
  if (!config.value.effectsEnabled) return
  try {
    audioContext ||= new AudioContext()
    const now = audioContext.currentTime
    const patterns: Record<string, number[]> = {
      start: [220, 330, 440], night: [146, 196], dawn: [330, 440, 660], day: [392, 523], vote: [220, 220], verdict: [174, 130], confirm: [520, 660], secret: [294, 370], timer: [880, 660, 440], impact: [110, 82],
    }
    const notes = patterns[kind] || [440]
    notes.forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator()
      const gain = audioContext!.createGain()
      oscillator.type = kind === 'night' || kind === 'verdict' ? 'sine' : 'triangle'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + index * .12)
      gain.gain.exponentialRampToValueAtTime(Math.max(.006, config.value.effectsVolume * .08), now + index * .12 + .02)
      gain.gain.exponentialRampToValueAtTime(.0001, now + index * .12 + .22)
      oscillator.connect(gain).connect(audioContext!.destination)
      oscillator.start(now + index * .12)
      oscillator.stop(now + index * .12 + .24)
    })
  } catch {}
}

function speak(message: string) {
  phaseCaption.value = message
  if (!config.value.voiceEnabled || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(message)
  utterance.lang = 'fr-FR'
  utterance.volume = Math.max(0, Math.min(1, config.value.voiceVolume))
  utterance.rate = .95
  speechSynthesis.speak(utterance)
}

function handleBeforeUnload() {
  if (game.value) localStorage.setItem(STORAGE_KEY, serializeGame(game.value))
}

function handleExternalEffect(event: CustomEvent) {
  const effectId = String(event.detail?.effectId || '')
  if (effectId === 'ajouter-30-secondes-au-conseil') {
    if (!game.value || !['discussion', 'vote'].includes(game.value.phase)) return notify('Aucun conseil chronométré n’est actif.')
    adjustTimer(30)
    phaseCaption.value = 'Le public offre trente secondes supplémentaires au conseil.'
    playCue('day')
    return
  }
  if (effectId === 'jouer-un-signal-de-tension') {
    playCue('verdict')
    phaseCaption.value = 'Un grondement traverse la place de Brumelune.'
    return
  }
  if (effectId === 'afficher-un-rappel-public') {
    phaseCaption.value = 'Rappel : argumentez sans révéler votre carte et respectez les joueurs silencieux.'
    playCue('confirm')
  }
}
</script>

<template>
  <main class="brume-app" :style="{ '--brume-village': `url(${villageImageUrl})` }">
    <section v-if="screen === 'home'" class="brume-home">
      <div class="home-veil"></div>
      <header class="home-brand"><span class="moon-mark">◐</span><span>SHENPULSE ORIGINAL</span></header>
      <div class="home-copy">
        <span class="eyebrow">JEU SOCIAL À RÔLES CACHÉS</span>
        <h1>Veilleurs de<br><em>Brumelune</em></h1>
        <p>Quand les lanternes s’éteignent, chacun devient un secret. Déduisez, protégez, trompez — ShenPulse orchestre la partie sans maître du jeu humain.</p>
        <div class="home-actions">
          <button class="primary huge" @click="beginCreation">Créer une partie</button>
          <button v-if="canResume" class="glass huge" @click="resumeGame">Reprendre la partie</button>
        </div>
        <div class="feature-row"><span>◈ 5–30 joueurs</span><span>⌁ Téléphones locaux</span><span>◎ Sans caméra obligatoire</span><span>♙ Spectateurs</span></div>
      </div>
      <aside class="home-card"><span>CE QUI VOUS ATTEND</span><strong>29 rôles originaux</strong><p>Allégeances mouvantes, protections, présages, métiers publics et victoires solitaires.</p><div class="mini-camps"><i></i><i></i><i></i></div></aside>
    </section>

    <section v-else-if="screen === 'setup'" class="setup-shell">
      <header class="topbar">
        <button class="brand-button" @click="screen = 'home'"><span class="moon-mark">◐</span><b>Brumelune</b></button>
        <nav class="wizard-nav" aria-label="Étapes de création">
          <button :class="{ active: setupStep === 'players' }" @click="setupStep = 'players'"><span>1</span>Joueurs</button>
          <button :class="{ active: setupStep === 'roles' }" @click="setupStep = 'roles'"><span>2</span>Rôles</button>
          <button :class="{ active: setupStep === 'options' }" @click="setupStep = 'options'"><span>3</span>Expérience</button>
        </nav>
        <div class="balance-pill" :class="`score-${setupValidation.label.toLowerCase()}`"><span>{{ setupValidation.score }}</span><div><small>ÉQUILIBRE</small><b>{{ setupValidation.label }}</b></div></div>
      </header>

      <div class="setup-body">
        <section v-if="setupStep === 'players'" class="setup-page narrow-page">
          <header class="page-heading"><div><span class="eyebrow">ÉTAPE 1</span><h2>Qui entre dans la brume ?</h2><p>Ajoutez les participants. Les pseudonymes suffisent : aucune donnée personnelle n’est requise.</p></div><button class="outline" @click="addPlayer">＋ Ajouter</button></header>
          <div class="players-editor">
            <label v-for="(player, index) in players" :key="player.id" class="player-edit-row">
              <span class="seat">{{ index + 1 }}</span><span class="avatar">{{ player.avatar }}</span>
              <input v-model="player.name" maxlength="40" :aria-label="`Nom du joueur ${index + 1}`">
              <button type="button" title="Retirer" :disabled="players.length <= 5" @click="removePlayer(index)">×</button>
            </label>
          </div>
          <section v-if="favorites.length" class="favorites"><span class="section-label">COMPOSITIONS FAVORITES</span><button v-for="favorite in favorites" :key="favorite.id" @click="applyFavorite(favorite)"><b>{{ favorite.name }}</b><small>{{ favorite.playerCount }} joueurs · {{ favorite.roleIds.length }} rôles</small></button></section>
        </section>

        <section v-if="setupStep === 'roles'" class="setup-page role-page">
          <header class="page-heading"><div><span class="eyebrow">ÉTAPE 2</span><h2>Composez votre constellation</h2><p>Un moteur extensible contrôle l’ordre, les incompatibilités et les priorités.</p></div><button class="primary" @click="autoCompose">✦ Équilibrer automatiquement</button></header>
          <div class="assignment-choice choice-grid two">
            <label :class="{ active: config.assignmentMode === 'random' }"><input v-model="config.assignmentMode" type="radio" value="random"><b>Attribution secrète aléatoire</b><small>ShenPulse mélange les cartes au lancement.</small></label>
            <label :class="{ active: config.assignmentMode === 'manual' }"><input v-model="config.assignmentMode" type="radio" value="manual"><b>Attribution manuelle par l’hôte</b><small>L’ordre ci-dessous correspond exactement aux joueurs.</small></label>
          </div>
          <div class="role-workspace">
            <aside class="role-filters">
              <label class="search-field"><span>⌕</span><input v-model="roleSearch" type="search" placeholder="Rechercher un rôle"></label>
              <div class="filter-group"><span>CAMP</span><button v-for="filter in [{id:'all',name:'Tous'},{id:'village',name:'Veilleurs'},{id:'hostile',name:'Brumes'},{id:'solitary',name:'Solitaires'},{id:'undecided',name:'Indécis'}]" :key="filter.id" :class="{ active: roleCampFilter === filter.id }" @click="roleCampFilter = filter.id">{{ filter.name }}</button></div>
              <div class="filter-group"><span>COMPLEXITÉ</span><button :class="{ active: roleComplexityFilter === 'all' }" @click="roleComplexityFilter = 'all'">Toutes</button><button :class="{ active: roleComplexityFilter === 'simple' }" @click="roleComplexityFilter = 'simple'">Accessibles</button><button :class="{ active: roleComplexityFilter === 'advanced' }" @click="roleComplexityFilter = 'advanced'">Avancées</button></div>
              <div class="composition-count"><span>{{ roleIds.length }} / {{ players.length }}</span><small>cartes attribuées</small><div><i :style="{ width: `${Math.min(100, roleIds.length / players.length * 100)}%` }"></i></div></div>
            </aside>
            <div class="role-catalog">
              <button v-for="role in filteredRoles" :key="role.id" class="role-tile" :class="[roleCampClass(role.initialCamp), { selected: selectedRoleId === role.id }]" @click="selectedRoleId = role.id">
                <span class="role-glyph">{{ role.initialCamp === 'hostile' ? '◢' : role.initialCamp === 'solitary' ? '◆' : role.initialCamp === 'undecided' ? '◇' : '✦' }}</span>
                <div><small>{{ roleCampName(role.initialCamp) }}</small><strong>{{ role.name }}</strong><p>{{ role.publicDescription }}</p></div>
                <span v-if="selectedCounts[role.id]" class="role-count">{{ selectedCounts[role.id] }}</span>
              </button>
            </div>
            <aside class="role-detail" :class="roleCampClass(selectedRole.initialCamp)">
              <span class="large-glyph">{{ selectedRole.initialCamp === 'hostile' ? '◢' : selectedRole.initialCamp === 'solitary' ? '◆' : '✦' }}</span>
              <span class="eyebrow">{{ roleCampName(selectedRole.initialCamp) }} · {{ selectedRole.complexity === 'advanced' ? 'AVANCÉ' : 'ACCESSIBLE' }}</span>
              <h3>{{ selectedRole.name }}</h3><p>{{ selectedRole.secretDescription }}</p>
              <dl><div><dt>Victoire</dt><dd>{{ selectedRole.winCondition }}</dd></div><div><dt>Action</dt><dd>{{ selectedRole.frequency === 'passive' ? 'Pouvoir passif' : selectedRole.frequency }}</dd></div><div><dt>Priorité</dt><dd>{{ selectedRole.resolutionPriority }}</dd></div></dl>
              <div class="role-add"><button class="outline" :disabled="!selectedCounts[selectedRole.id]" @click="removeRole(selectedRole.id)">−</button><b>{{ selectedCounts[selectedRole.id] || 0 }}</b><button class="primary" :disabled="roleIds.length >= players.length" @click="addRole(selectedRole.id)">＋</button></div>
            </aside>
          </div>
          <div v-if="config.assignmentMode === 'manual'" class="manual-assignment-grid">
            <label v-for="(player, index) in players" :key="player.id"><span><b>{{ index + 1 }}</b>{{ player.name }}</span><select v-model="roleIds[index]" :aria-label="`Rôle secret de ${player.name}`"><option v-for="role in ROLE_CATALOG" :key="role.id" :value="role.id">{{ role.name }} · {{ roleCampName(role.initialCamp) }}</option></select></label>
          </div>
          <div v-else class="composition-strip"><span v-for="(roleId, index) in roleIds" :key="`${roleId}-${index}`" :title="getRole(roleId).name" :class="roleCampClass(getRole(roleId).initialCamp)">{{ getRole(roleId).name }}</span><i v-for="index in Math.max(0, players.length - roleIds.length)" :key="`empty-${index}`">Rôle manquant</i></div>
        </section>

        <section v-if="setupStep === 'options'" class="setup-page options-page">
          <header class="page-heading"><div><span class="eyebrow">ÉTAPE 3</span><h2>Réglez l’expérience</h2><p>La caméra reste facultative, inactive par défaut et sans reconnaissance biométrique.</p></div></header>
          <div class="options-grid">
            <article class="option-card wide"><span class="card-icon">⌁</span><div><h3>Mode de jeu</h3><p>Choisissez où les secrets et les actions seront consultés.</p></div><div class="choice-grid three"><label :class="{ active: config.deviceMode === 'shared' }"><input v-model="config.deviceMode" type="radio" value="shared"><b>Écran partagé</b><small>Passage privé de l’écran</small></label><label :class="{ active: config.deviceMode === 'devices' }"><input v-model="config.deviceMode" type="radio" value="devices"><b>Téléphones</b><small>Serveur local protégé</small></label><label :class="{ active: config.deviceMode === 'camera' }"><input v-model="config.deviceMode" type="radio" value="camera"><b>Mode caméra</b><small>Aperçu local facultatif</small></label></div></article>
            <article class="option-card"><span class="card-icon">◷</span><div><h3>Rythme du conseil</h3><p>Modifiable à tout moment par l’hôte.</p></div><label class="range-row"><span>Débat <b>{{ Math.round(config.debateSeconds / 60) }} min</b></span><input v-model.number="config.debateSeconds" type="range" min="30" max="900" step="30"></label><label class="range-row"><span>Vote <b>{{ config.voteSeconds }} s</b></span><input v-model.number="config.voteSeconds" type="range" min="15" max="180" step="15"></label></article>
            <article class="option-card"><span class="card-icon">▣</span><div><h3>Bulletins</h3><p>Les votes secrets ne sont dévoilés qu’après confirmation.</p></div><select v-model="config.voteMode"><option value="secret">Secrets et séquentiels</option><option value="public">Publics</option><option value="simultaneous">Simultanés sur téléphones</option></select><label class="toggle-row"><input v-model="config.allowAbstain" type="checkbox"><span><b>Autoriser l’abstention</b><small>Le joueur peut déposer un bulletin blanc.</small></span></label><label class="toggle-row"><input v-model="config.revealEliminatedRoles" type="checkbox"><span><b>Révéler les rôles éliminés</b><small>Sinon, ils restent secrets jusqu’à la fin.</small></span></label></article>
            <article class="option-card"><span class="card-icon">♙</span><div><h3>Spectateurs</h3><p>Leurs pronostics restent invisibles aux joueurs.</p></div><label class="toggle-row"><input v-model="config.spectatorEnabled" type="checkbox"><span><b>Activer les spectateurs</b><small>Classement de précision et rapidité.</small></span></label><select v-model="config.spectatorMode" :disabled="!config.spectatorEnabled"><option value="detective">Enquêteurs · rôles inconnus</option><option value="omniscient">Omniscients · avertissement anti-aide</option></select></article>
            <article class="option-card"><span class="card-icon">◎</span><div><h3>Caméra respectueuse</h3><p>Pas d’analyse, pas de reconnaissance faciale, pas de stockage par défaut.</p></div><label class="toggle-row"><input v-model="config.cameraEnabled" type="checkbox"><span><b>Activer après consentement</b><small>Un témoin permanent sera affiché.</small></span></label><label class="toggle-row"><input v-model="config.cameraBlurDuringSecrets" type="checkbox"><span><b>Flouter pendant les secrets</b><small>Masque l’aperçu lors des actions.</small></span></label><label class="toggle-row"><input v-model="config.recordingEnabled" type="checkbox"><span><b>Autoriser l’enregistrement manuel</b><small>Une seconde confirmation sera exigée.</small></span></label></article>
            <article class="option-card"><span class="card-icon">♬</span><div><h3>Son et accessibilité</h3><p>Toutes les annonces importantes restent sous-titrées.</p></div><label class="toggle-row"><input v-model="config.effectsEnabled" type="checkbox"><span><b>Signaux sonores originaux</b><small>Confirmation, vote, aube et victoire.</small></span></label><label class="toggle-row"><input v-model="config.voiceEnabled" type="checkbox"><span><b>Synthèse vocale</b><small>Voix système facultative.</small></span></label><label class="toggle-row"><input v-model="config.musicEnabled" type="checkbox"><span><b>Ambiance discrète</b><small>Mode silencieux disponible.</small></span></label></article>
            <article class="option-card wide"><span class="card-icon">✧</span><div><h3>Modules avancés</h3><p>Ils s’ajoutent aux rôles secrets sans changer leur identité.</p></div><div class="choice-grid"><label class="toggle-row"><input v-model="config.eventsEnabled" type="checkbox"><span><b>Présages</b><small>Événements temporaires originaux</small></span></label><label class="toggle-row"><input v-model="config.occupationsEnabled" type="checkbox"><span><b>Métiers et bâtiments</b><small>Pouvoirs publics additionnels</small></span></label><label class="toggle-row"><input v-model="config.allowSolitary" type="checkbox"><span><b>Victoires solitaires</b><small>Objectifs individuels autorisés</small></span></label><label class="toggle-row"><input v-model="config.allowComplex" type="checkbox"><span><b>Rôles complexes</b><small>Conversions, copies et réactions</small></span></label></div></article>
            <article v-if="config.eventsEnabled" class="option-card wide"><span class="card-icon">☄</span><div><h3>Pioche de présages</h3><p>Sélectionnez les événements pouvant apparaître.</p></div><div class="event-grid"><button v-for="event in EVENTS" :key="event.id" :class="{ active: eventEnabled(event.id) }" @click="toggleEvent(event.id)"><b>{{ event.name }}</b><small>{{ event.description }}</small></button></div></article>
          </div>
          <div class="favorite-save"><input v-model="favoriteName" maxlength="50"><button class="outline" @click="saveFavorite">☆ Enregistrer cette composition</button></div>
          <div class="validation-box" :class="{ valid: setupValidation.valid && !setupValidation.warnings.length }"><div><span>{{ setupValidation.valid ? '✓' : '!' }}</span><div><b>{{ setupValidation.valid ? 'Vérification terminée' : 'Composition incomplète' }}</b><small>{{ setupValidation.errors[0] || setupValidation.warnings[0] || 'Tous les rôles sont compatibles avec les options choisies.' }}</small></div></div><strong>{{ setupValidation.score }}/100</strong></div>
        </section>
      </div>
      <footer class="setup-footer"><button class="glass" @click="setupStep = setupStep === 'options' ? 'roles' : setupStep === 'roles' ? 'players' : 'players'">← Précédent</button><div><span>{{ players.length }} joueurs</span><span>{{ roleIds.length }} rôles</span><button v-if="setupStep !== 'options'" class="primary" @click="setupStep = setupStep === 'players' ? 'roles' : 'options'">Continuer →</button><button v-else class="primary launch" @click="requestLaunch">Lancer la partie ✦</button></div></footer>
    </section>

    <section v-else-if="screen === 'reveal'" class="secret-screen">
      <div class="secret-stars"></div>
      <header><span class="moon-mark">◐</span><b>Attribution privée</b><span>{{ game.revealIndex + 1 }} / {{ game.players.length }}</span></header>
      <div v-if="currentRevealPlayer" class="handoff-card" :class="{ revealed: revealUnlocked }">
        <template v-if="!revealUnlocked"><span class="seat-orb">{{ currentRevealPlayer.avatar }}</span><span class="eyebrow">PASSEZ L’ÉCRAN À</span><h1>{{ currentRevealPlayer.name }}</h1><p>Vérifiez que personne d’autre ne peut voir l’écran avant de révéler votre rôle.</p><button class="primary huge" @click="showRole">Maintenir le secret et révéler</button></template>
        <template v-else><span class="role-sigil" :class="roleCampClass(currentRevealView.self.currentCamp)">{{ currentRevealView.self.currentCamp === 'hostile' ? '◢' : currentRevealView.self.currentCamp === 'solitary' ? '◆' : '✦' }}</span><span class="eyebrow">VOTRE RÔLE SECRET</span><h1>{{ currentRevealView.self.role.name }}</h1><span class="camp-banner" :class="roleCampClass(currentRevealView.self.currentCamp)">{{ roleCampName(currentRevealView.self.currentCamp) }}</span><p class="role-secret">{{ currentRevealView.self.role.secretDescription }}</p><div class="win-box"><small>VOTRE CONDITION DE VICTOIRE</small><b>{{ currentRevealView.self.role.winCondition }}</b></div><div v-if="currentRevealView.self.occupation" class="occupation-box"><small>MÉTIER PUBLIC</small><b>{{ currentRevealView.self.occupation.name }}</b><p>{{ currentRevealView.self.occupation.description }}</p></div><div v-for="message in currentRevealView.self.messages" :key="message.id" class="known-box">{{ message.message }}</div><button class="primary huge" @click="confirmCurrentRole">J’ai mémorisé mon rôle</button></template>
      </div>
      <p class="privacy-note">L’information disparaît dès confirmation. Aucun rôle secret n’est affiché sur l’écran central.</p>
    </section>

    <section v-else-if="screen === 'game' || screen === 'ended'" class="game-shell">
      <header class="game-topbar"><button class="brand-button" @click="activePanel = 'play'"><span class="moon-mark">◐</span><div><small>VEILLEURS DE</small><b>Brumelune</b></div></button><div class="phase-chip" :class="`phase-${game.phase}`"><i></i><span>{{ phaseTitle }}</span></div><div class="game-top-actions"><span class="room-chip">SALLE <b>{{ game.roomCode }}</b></span><button class="icon-button" title="Pause" @click="togglePause">{{ game.paused ? '▶' : 'Ⅱ' }}</button><button class="icon-button" title="Paramètres" @click="activePanel = 'settings'">⚙</button></div></header>
      <div class="game-layout">
        <aside class="game-nav"><button v-for="item in [{id:'play',icon:'◐',name:'Partie'},{id:'players',icon:'♙',name:'Habitants'},{id:'spectators',icon:'◎',name:'Public'},{id:'history',icon:'≡',name:'Chronologie'},{id:'settings',icon:'⚙',name:'Contrôle'}]" :key="item.id" :class="{ active: activePanel === item.id }" @click="activePanel = item.id as any"><span>{{ item.icon }}</span><small>{{ item.name }}</small></button><div class="nav-spacer"></div><button class="danger-nav" @click="abandonGame"><span>×</span><small>Quitter</small></button></aside>
        <section class="stage" :class="[`stage-${game.phase}`, { paused: game.paused }]">
          <div v-if="game.paused" class="pause-overlay"><span>Ⅱ</span><h2>Partie en pause</h2><p>L’état est sauvegardé. Aucun chronomètre ne progresse.</p><button class="primary" @click="togglePause">Reprendre</button></div>
          <template v-if="activePanel === 'play'">
            <div class="caption-bar"><span>CC</span><p>{{ phaseCaption }}</p></div>
            <section v-if="game.phase === 'night-intro'" class="phase-hero night-hero"><span class="orb moon">◐</span><span class="eyebrow">PROCHAINE PHASE</span><h1>La nuit appelle ses secrets</h1><p>Les actions seront appelées dans un ordre déterministe. Protections, conversions et attaques seront résolues avant l’aube.</p><button class="primary huge" @click="startCurrentNight">Commencer la nuit {{ game.night + 1 }}</button><div class="phase-notes"><span>✓ Sauvegarde automatique</span><span>✓ Résolution sans révélation</span><span>✓ Correction possible</span></div></section>

            <section v-else-if="game.phase === 'night' && nightStep" class="night-action-stage">
              <div v-if="!secretStepUnlocked" class="secret-call"><span class="orb role-orb">{{ nightActor.avatar }}</span><span class="eyebrow">TOUS LES AUTRES GARDENT LES YEUX FERMÉS</span><h1>{{ getRole(nightStep.roleId).name }}</h1><p>{{ nightStep.collective ? 'Les membres des Brumes peuvent regarder ensemble.' : `${nightActor.name} peut maintenant consulter l’écran.` }}</p><button class="primary huge" @click="revealNightStep">Je suis prêt · révéler l’action</button><small>Étape {{ game.nightStepIndex + 1 }} sur {{ game.nightQueue.length }}</small></div>
              <div v-else class="action-console"><header><span class="role-sigil" :class="roleCampClass(getRole(nightStep.roleId).initialCamp)">{{ getRole(nightStep.roleId).initialCamp === 'hostile' ? '◢' : '✦' }}</span><div><span class="eyebrow">ACTION PRIVÉE</span><h2>{{ nightPrompt.title }}</h2><p>{{ nightPrompt.instruction }}</p></div></header>
                <div v-if="nightStep.action === 'choose-camp'" class="target-grid"><button v-for="camp in [{id:'village',name:'Rejoindre les Veilleurs',icon:'✦'},{id:'hostile',name:'Rejoindre les Brumes',icon:'◢'}]" :key="camp.id" :class="{ selected: actionChoice === camp.id }" @click="actionChoice = camp.id"><span>{{ camp.icon }}</span><b>{{ camp.name }}</b></button></div>
                <div v-else-if="nightStep.action === 'alchemy'" class="choice-grid two"><button :class="{ active: actionChoice === 'heal' }" @click="actionChoice = 'heal'"><b>Essence réparatrice</b><small>Annule une attaque nocturne</small></button><button :class="{ active: actionChoice === 'poison' }" @click="actionChoice = 'poison'"><b>Fiole corrosive</b><small>Ajoute une élimination nocturne</small></button></div>
                <div v-else-if="nightStep.action === 'choose-event'" class="choice-grid two"><button v-for="event in nightPrompt.events" :key="event.id" :class="{ active: actionChoice === event.id }" @click="actionChoice = event.id"><b>{{ event.name }}</b><small>{{ event.description }}</small></button></div>
                <div v-else-if="nightStep.action === 'borrow'" class="choice-grid two"><button v-for="choice in [{id:'inspect',name:'Lecture astrale'},{id:'protect',name:'Halo protecteur'},{id:'mark',name:'Marque runique'}].filter((entry) => nightPrompt.borrowedOptions.includes(entry.id))" :key="choice.id" :class="{ active: actionChoice === choice.id }" @click="actionChoice = choice.id"><b>{{ choice.name }}</b></button></div>
                <div v-if="nightPrompt.targets?.length" class="target-grid"><button v-for="target in nightPrompt.targets" :key="target.id" :class="{ selected: selectedTargetId === target.id || selectedTargetIds.includes(target.id) }" @click="toggleTarget(target.id, ['bond','charm'].includes(nightStep.action))"><span>{{ target.seat }}</span><b>{{ target.name }}</b></button></div>
                <div v-else-if="nightStep.action === 'sense-neighbors'" class="private-result"><span>◉</span><p>L’écoute des sièges voisins sera ajoutée à vos informations privées.</p></div>
                <footer><button v-if="nightPrompt.canSkip" class="glass" @click="submitCurrentNightAction(true)">Ne rien faire</button><button class="primary" @click="submitCurrentNightAction(false)">Confirmer puis se rendormir</button></footer>
              </div>
            </section>

            <section v-else-if="game.phase === 'death-trigger' && pendingDeathTrigger" class="night-action-stage">
              <div v-if="!secretStepUnlocked" class="secret-call"><span class="orb role-orb">{{ deathTriggerActor.avatar }}</span><span class="eyebrow">RÉACTION AVANT LA RÉVÉLATION</span><h1>{{ getRole(deathTriggerActor.currentRoleId).name }}</h1><p>{{ deathTriggerActor.name }} doit accomplir sa dernière volonté en privé.</p><button class="primary huge" @click="secretStepUnlocked = true">Révéler les cibles</button></div>
              <div v-else class="action-console"><header><span class="role-sigil">✦</span><div><span class="eyebrow">DERNIÈRE VOLONTÉ</span><h2>{{ pendingDeathTrigger.kind === 'titan' ? 'Choisissez une Brume responsable' : 'Choisissez la cible du dernier trait' }}</h2></div></header><div class="target-grid"><button v-for="target in deathTriggerTargets" :key="target.id" @click="submitDeathReaction(target.id)"><span>{{ target.seat }}</span><b>{{ target.name }}</b></button></div><footer><button class="glass" @click="skipDeathReaction">Renoncer à la réaction</button></footer></div>
            </section>

            <section v-else-if="game.phase === 'dawn'" class="phase-hero dawn-hero"><span class="orb sun">✺</span><span class="eyebrow">L’AUBE SE LÈVE</span><h1>{{ dawnCaption() }}</h1><div v-if="game.activeEvent" class="event-banner"><span>☄</span><div><small>PRÉSAGE ACTIF · {{ game.activeEvent.duration }}</small><b>{{ game.activeEvent.name }}</b><p>{{ game.activeEvent.description }}</p></div></div><div class="victim-row"><article v-for="id in game.dawnSummary?.victimIds || []" :key="id"><span>{{ game.players.find((player:any) => player.id === id)?.avatar }}</span><b>{{ game.players.find((player:any) => player.id === id)?.name }}</b><small v-if="game.players.find((player:any) => player.id === id)?.rolePublic">{{ getRole(game.players.find((player:any) => player.id === id)?.currentRoleId).name }}</small></article><p v-if="!(game.dawnSummary?.victimIds || []).length">Aucune victime cette nuit.</p></div><button class="primary huge" @click="openDiscussion">Ouvrir le conseil</button></section>

            <section v-else-if="game.phase === 'discussion'" class="discussion-stage"><header><div><span class="eyebrow">JOUR {{ game.day }} · CONSEIL OUVERT</span><h1>La parole est au village</h1><p>Les joueurs muets peuvent voter, mais ne doivent pas parler.</p></div><div class="timer" :class="{ urgent: discussionRemaining <= 30 }">{{ formatTime(discussionRemaining) }}</div></header><div class="alive-circle"><article v-for="player in alivePlayers" :key="player.id" :class="{ muted: player.statuses.includes('muted') }"><span>{{ player.avatar }}</span><b>{{ player.name }}</b><small>{{ player.statuses.includes('muted') ? 'Silencieux' : occupationName(player.occupationId) || 'Habitant' }}</small></article></div><footer><div><button class="glass" @click="adjustTimer(-30)">− 30 s</button><button class="glass" @click="timerRunning = !timerRunning">{{ timerRunning ? 'Pause chrono' : 'Reprendre chrono' }}</button><button class="glass" @click="adjustTimer(60)">＋ 1 min</button></div><button class="primary huge" @click="openVote">Passer au vote</button></footer></section>

            <section v-else-if="game.phase === 'vote'" class="vote-stage">
              <header><div><span class="eyebrow">{{ game.config.voteMode === 'secret' ? 'BULLETINS SCELLÉS' : 'VOTE PUBLIC' }}</span><h1>{{ currentVoter ? `${currentVoter.name} doit voter` : 'Tous les bulletins sont déposés' }}</h1><p>{{ Object.keys(game.votes).length }} / {{ eligibleVoters.length }} votes confirmés</p></div><div class="timer compact">{{ formatTime(voteRemaining) }}</div></header>
              <div v-if="currentVoter && !currentVoterUnlocked" class="vote-handoff"><span>{{ currentVoter.avatar }}</span><h2>Passez l’écran à {{ currentVoter.name }}</h2><p>Son choix ne sera pas affiché avant le verdict.</p><button class="primary" @click="revealVoterScreen">Ouvrir mon bulletin</button></div>
              <div v-else-if="currentVoter" class="ballot"><h3>Qui doit quitter le conseil ?</h3><div class="target-grid"><button v-for="target in alivePlayers.filter((player:any) => player.id !== currentVoter.id)" :key="target.id" :class="{ selected: selectedTargetId === target.id }" @click="selectedTargetId = target.id"><span>{{ target.seat }}</span><b>{{ target.name }}</b></button></div><footer><button v-if="game.config.allowAbstain" class="glass" @click="confirmVote(true)">Bulletin blanc</button><button class="primary" :disabled="!selectedTargetId" @click="confirmVote(false)">Sceller ce vote</button></footer></div>
              <div v-else class="sealed-complete"><span>▣</span><h2>Les bulletins sont scellés</h2><button class="primary huge" @click="resolveVote(game); phaseCaption = verdictCaption()">Révéler le verdict</button></div>
              <button v-if="Object.keys(game.votes).length" class="text-button" @click="forceResolveVote">Clore avec les bulletins reçus</button>
            </section>

            <section v-else-if="game.phase === 'verdict'" class="phase-hero verdict-hero"><span class="orb verdict">⚖</span><span class="eyebrow">VERDICT DU JOUR {{ game.day }}</span><h1>{{ verdictCaption() }}</h1><div class="tally"><article v-for="(count, playerId) in game.voteResult?.tally || {}" :key="playerId"><b>{{ game.players.find((player:any) => player.id === playerId)?.name }}</b><span>{{ count }} voix</span><i :style="{ width: `${Math.min(100, Number(count) / Math.max(1, ...Object.values(game.voteResult.tally).map(Number)) * 100)}%` }"></i></article></div><div class="verdict-actions"><button v-if="alivePlayers.some((player:any) => player.currentRoleId === 'magistrat' && Number(player.charges || 0) > 0)" class="glass" @click="askSecondVote">Déclencher le rappel du conseil</button><button class="primary huge" @click="continueAfterVerdict">Vérifier la victoire et continuer</button></div></section>
          </template>

          <template v-else-if="activePanel === 'players'"><section class="panel-page"><header><span class="eyebrow">ÉTAT PUBLIC</span><h1>Habitants de Brumelune</h1><p>Les informations secrètes ne sont visibles qu’après la fin.</p></header><div class="resident-grid"><article v-for="player in publicPlayers" :key="player.id" :class="[{ dead: !player.alive }, player.rolePublic || game.finished ? roleCampClass(player.currentCamp) : '']"><span class="resident-avatar">{{ player.avatar }}</span><div><small>SIÈGE {{ player.seat }}</small><h3>{{ player.name }}</h3><p>{{ player.alive ? (player.statuses.includes('muted') ? 'En vie · silencieux' : 'En vie') : 'Éliminé' }}</p><b v-if="player.rolePublic || game.finished">{{ getRole(player.currentRoleId).name }}</b><b v-if="player.occupationId">{{ occupationName(player.occupationId) }}</b></div></article></div></section></template>

          <template v-else-if="activePanel === 'history'"><section class="panel-page"><header><span class="eyebrow">AUDIT DE PARTIE</span><h1>Chronologie déterministe</h1><p>L’hôte peut expliquer chaque résolution. Les détails secrets restent dans ce tableau de contrôle.</p></header><div class="history-list"><article v-for="entry in fullHistory.slice().reverse()" :key="entry.id" :class="`visibility-${entry.visibility}`"><span>{{ formatMoment(entry) }}</span><div><b>{{ entry.message }}</b><small>{{ entry.visibility === 'public' ? 'Information publique' : entry.visibility === 'private' ? 'Information privée' : 'Détail technique secret' }}</small></div></article></div></section></template>

          <template v-else-if="activePanel === 'spectators'"><section class="panel-page"><header><span class="eyebrow">PUBLIC SANS INFLUENCE</span><h1>Spectateurs enquêteurs</h1><p>Les pronostics ne sont jamais envoyés aux joueurs actifs.</p></header><div class="spectator-layout"><article class="panel-card"><h3>Ajouter un pronostic local</h3><label><span>Pseudonyme</span><input v-model="spectatorName"></label><label><span>Joueur observé</span><select v-model="spectatorTarget"><option value="">Choisir…</option><option v-for="player in alivePlayers" :key="player.id" :value="player.id">{{ player.name }}</option></select></label><label><span>Camp supposé</span><select v-model="spectatorCamp"><option value="village">Veilleurs</option><option value="hostile">Brumes</option><option value="solitary">Solitaire</option></select></label><label><span>Rôle supposé (facultatif)</span><select v-model="spectatorRole"><option value="">Aucun</option><option v-for="role in ROLE_CATALOG" :key="role.id" :value="role.id">{{ role.name }}</option></select></label><button class="primary" @click="addHostPrediction">Enregistrer secrètement</button></article><article class="panel-card"><h3>Classement</h3><div v-if="spectatorScores.length" class="score-list"><div v-for="(score, index) in spectatorScores" :key="score.name"><span>{{ index + 1 }}</span><b>{{ score.name }}</b><strong>{{ score.score }} pts</strong></div></div><p v-else>Les scores seront calculés à la révélation finale.</p><div class="prediction-count"><b>{{ game.spectatorPredictions.length }}</b><small>pronostics enregistrés</small></div></article></div></section></template>

          <template v-else-if="activePanel === 'settings'"><section class="panel-page"><header><span class="eyebrow">TABLEAU DE CONTRÔLE HÔTE</span><h1>Superviser la partie</h1><p>Pause, correction, caméra et connexion locale restent sous votre contrôle.</p></header><div class="control-grid"><article class="panel-card"><h3>Contrôles immédiats</h3><button class="outline full" @click="togglePause">{{ game.paused ? '▶ Reprendre la partie' : 'Ⅱ Mettre en pause' }}</button><button class="outline full" @click="restoreCheckpoint">↶ Corriger la dernière phase</button><button class="outline full" @click="phaseCaption = phaseCaption">↻ Répéter l’instruction affichée</button><button class="outline full" @click="manuallyEnd">✓ Vérifier les conditions de victoire</button></article><article class="panel-card"><h3>Caméra locale</h3><div v-if="cameraActive" class="camera-preview"><video ref="videoRef" autoplay playsinline muted :class="{ blurred: config.cameraBlurDuringSecrets && secretCameraPhase }"></video><span class="camera-live">● CAMÉRA ACTIVE</span></div><p v-if="cameraError" class="inline-error">{{ cameraError }}</p><button v-if="!cameraActive" class="outline full" @click="startCamera">Activer avec consentement</button><button v-else class="outline full" @click="stopCamera">Couper immédiatement</button><button v-if="cameraActive && config.recordingEnabled && !recording" class="outline full warning" @click="startRecording">Démarrer un enregistrement consenti</button><button v-if="recording" class="outline full danger" @click="stopRecording">● Arrêter et télécharger</button></article><article class="panel-card lan-card"><h3>Compagnon sur téléphones</h3><template v-if="lanInfo?.active"><img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code de connexion locale"><p><b>{{ lanInfo.url }}</b></p><button class="outline full" @click="copyJoinUrl">Copier l’adresse</button><button class="text-button" @click="showPrivateCodes = !showPrivateCodes">{{ showPrivateCodes ? 'Masquer' : 'Afficher' }} les codes personnels</button><div v-if="showPrivateCodes" class="pin-list"><div v-for="player in lanInfo.players" :key="player.id"><i :class="{ online: player.connected }"></i><span>{{ player.name }}</span><b>{{ player.pin }}</b></div><div><i></i><span>Spectateurs</span><b>{{ lanInfo.spectatorPin }}</b></div><div v-if="game.config.spectatorMode === 'omniscient'"><i></i><span>Omniscients</span><b>{{ lanInfo.omniscientPin }}</b></div></div></template><template v-else><p>Le serveur local n’est pas démarré.</p><button class="primary full" @click="startLan">Ouvrir la salle locale</button></template></article><article class="panel-card"><h3>Vie privée</h3><ul><li>Aucune reconnaissance faciale</li><li>Aucun enregistrement automatique</li><li>Rôles filtrés par code personnel</li><li>Serveur fermé avec la fenêtre de jeu</li><li>Aucune vidéo dans l’export</li></ul></article></div></section></template>

          <section v-if="screen === 'ended' || game.phase === 'ended'" class="end-overlay"><div class="end-card"><span class="orb victory-orb">✦</span><span class="eyebrow">PARTIE TERMINÉE</span><h1>{{ game.victoryReason }}</h1><div class="winner-row"><article v-for="player in winnerPlayers" :key="player.id"><span>{{ player.avatar }}</span><b>{{ player.name }}</b><small>{{ getRole(player.currentRoleId).name }}</small></article></div><div class="end-stats"><span><b>{{ game.night }}</b> nuits</span><span><b>{{ game.day }}</b> conseils</span><span><b>{{ game.history.length }}</b> événements</span><span><b>{{ game.spectatorPredictions.length }}</b> pronostics</span></div><div class="end-actions"><button class="glass" @click="activePanel = 'history'; screen = 'game'">Voir la chronologie</button><button class="glass" @click="exportSummary">Exporter le résumé</button><button class="primary" @click="abandonGame">Nouvelle partie</button></div></div></section>
        </section>
      </div>
    </section>

    <div v-if="toastMessage" class="brume-toast">{{ toastMessage }}</div>
    <div v-if="confirmationOpen" class="modal-backdrop"><section class="confirm-modal"><span class="large-glyph">⚠</span><span class="eyebrow">COMPOSITION ATYPIQUE</span><h2>La partie peut devenir chaotique</h2><p v-for="warning in setupValidation.warnings" :key="warning">{{ warning }}</p><div><button class="glass" @click="confirmationOpen = false">Revoir la composition</button><button class="primary" @click="launchGame">Confirmer et jouer</button></div></section></div>
  </main>
</template>

<style scoped>
:global(body) { overflow: hidden; }
:global(button), :global(input), :global(select) { font: inherit; }
:global(button) { cursor: pointer; }
.brume-app { min-height: 100vh; color: #f8f7ff; background: #080a16; --violet: #a678ff; --violet-deep: #7253e8; --mint: #55e3bf; --amber: #ffbe69; --rose: #ff6f9d; --muted: #9aa3bd; --line: rgba(187,168,255,.18); --panel: rgba(17,18,39,.94); }
.primary,.glass,.outline,.icon-button,.brand-button,.text-button { border: 0; color: inherit; }
.primary,.glass,.outline { min-height: 44px; padding: 0 18px; border-radius: 13px; font-weight: 850; }
.primary { background: linear-gradient(135deg,#7758ea,#ae4cac); box-shadow: 0 12px 28px rgba(110,67,208,.26); }
.primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
.primary:disabled,.outline:disabled { opacity: .38; cursor: not-allowed; transform: none; }
.glass,.outline { border: 1px solid var(--line); background: rgba(255,255,255,.045); }
.outline:hover,.glass:hover { border-color: rgba(166,120,255,.55); background: rgba(166,120,255,.1); }
.huge { min-height: 56px; padding: 0 26px; }
.full { width: 100%; margin-top: 9px; }
.eyebrow,.section-label { display: block; color: var(--mint); font-size: 10px; font-weight: 950; letter-spacing: .19em; text-transform: uppercase; }
.moon-mark { display: grid; width: 39px; height: 39px; place-items: center; border: 1px solid rgba(199,179,255,.3); border-radius: 13px; color: var(--amber); background: rgba(166,120,255,.13); font-size: 23px; }
.brume-home { position: relative; min-height: 100vh; overflow: hidden; background-image: linear-gradient(90deg,rgba(5,7,18,.96) 0%,rgba(7,8,20,.72) 44%,rgba(7,8,20,.15) 75%), var(--brume-village); background-position: center; background-size: cover; }
.home-veil { position: absolute; inset: 0; background: linear-gradient(180deg,transparent 60%,#080a16 100%); pointer-events: none; }
.home-brand { position: absolute; z-index: 2; top: 34px; left: 48px; display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 900; letter-spacing: .16em; }
.home-copy { position: relative; z-index: 2; width: min(720px,calc(100% - 96px)); padding: 19vh 0 80px 7vw; }
.home-copy h1 { margin: 12px 0 22px; font-family: Georgia,serif; font-size: clamp(58px,7.5vw,112px); font-weight: 500; line-height: .82; letter-spacing: -.065em; }
.home-copy h1 em { color: #c7b3ff; font-weight: 500; }
.home-copy > p { max-width: 600px; color: #c1c5d7; font-size: 17px; line-height: 1.7; }
.home-actions { display: flex; gap: 12px; margin-top: 30px; }
.feature-row { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 35px; color: #aab0c8; font-size: 12px; font-weight: 800; }
.home-card { position: absolute; z-index: 2; right: 4vw; bottom: 5vh; width: 300px; padding: 20px; border: 1px solid var(--line); border-radius: 20px; background: rgba(8,10,24,.72); backdrop-filter: blur(18px); }
.home-card > span { color: var(--amber); font-size: 9px; font-weight: 900; letter-spacing: .15em; }
.home-card strong { display: block; margin: 8px 0; font-size: 23px; }
.home-card p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.mini-camps { display: flex; gap: 6px; margin-top: 15px; }.mini-camps i { width: 34%; height: 4px; border-radius: 9px; background: var(--mint); }.mini-camps i:nth-child(2){background:var(--violet)}.mini-camps i:nth-child(3){background:var(--amber)}
.setup-shell,.game-shell { min-height: 100vh; background: radial-gradient(circle at 85% 0,rgba(120,78,207,.18),transparent 33%),#090b19; }
.topbar,.game-topbar { display: flex; min-height: 76px; align-items: center; gap: 24px; padding: 0 28px; border-bottom: 1px solid var(--line); background: rgba(8,9,22,.9); }
.brand-button { display: flex; align-items: center; gap: 10px; background: none; }.brand-button div{text-align:left}.brand-button small{display:block;color:var(--muted);font-size:8px;letter-spacing:.14em}.brand-button b{font-size:16px}
.wizard-nav { display: flex; flex: 1; justify-content: center; gap: 8px; }.wizard-nav button{display:flex;min-height:42px;align-items:center;gap:8px;padding:0 14px;border:0;border-radius:12px;color:#777f9b;background:transparent;font-weight:800}.wizard-nav button span{display:grid;width:22px;height:22px;place-items:center;border:1px solid currentColor;border-radius:50%;font-size:10px}.wizard-nav button.active{color:#fff;background:rgba(166,120,255,.14)}.wizard-nav button.active span{color:#fff;background:var(--violet-deep)}
.balance-pill { display:flex;align-items:center;gap:10px;padding:8px 13px;border:1px solid rgba(85,227,191,.24);border-radius:14px;background:rgba(85,227,191,.07)}.balance-pill>span{display:grid;width:35px;height:35px;place-items:center;border-radius:50%;color:var(--mint);background:rgba(85,227,191,.12);font-weight:900}.balance-pill small,.balance-pill b{display:block}.balance-pill small{color:var(--muted);font-size:8px;letter-spacing:.14em}.balance-pill b{font-size:11px}.score-chaotique{border-color:rgba(255,111,157,.3)}.score-chaotique>span{color:var(--rose);background:rgba(255,111,157,.1)}
.setup-body { height: calc(100vh - 148px); overflow: auto; }.setup-page{width:min(1500px,calc(100% - 48px));margin:auto;padding:34px 0 46px}.narrow-page{width:min(900px,calc(100% - 48px))}.page-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:25px}.page-heading h2,.panel-page h1{margin:7px 0 6px;font-size:34px;letter-spacing:-.035em}.page-heading p,.panel-page header p{margin:0;color:var(--muted)}
.players-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.player-edit-row{display:grid;grid-template-columns:34px 38px 1fr 34px;align-items:center;gap:9px;padding:9px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.seat{display:grid;width:30px;height:30px;place-items:center;border-radius:9px;color:var(--muted);background:rgba(255,255,255,.04);font-size:11px;font-weight:900}.avatar{font-size:23px;text-align:center;color:var(--amber)}.player-edit-row input,.favorite-save input,.panel-card input,.panel-card select,.option-card select{min-width:0;height:42px;padding:0 12px;border:1px solid rgba(255,255,255,.09);border-radius:10px;outline:none;color:#fff;background:#090b1a}.player-edit-row>button{height:32px;border:0;border-radius:9px;color:#8991aa;background:rgba(255,255,255,.04)}
.favorites{margin-top:30px}.favorites>button{display:inline-grid;gap:3px;margin:10px 8px 0 0;padding:13px 16px;border:1px solid var(--line);border-radius:13px;color:#fff;text-align:left;background:rgba(255,255,255,.035)}.favorites small{color:var(--muted)}
.role-workspace{display:grid;grid-template-columns:220px minmax(440px,1fr) 310px;gap:14px;min-height:510px}.role-filters,.role-detail{padding:17px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}.search-field{display:flex;align-items:center;gap:7px;padding:0 11px;border:1px solid var(--line);border-radius:11px;background:#090b1a}.search-field input{width:100%;height:40px;border:0;outline:none;color:#fff;background:transparent}.filter-group{display:grid;gap:4px;margin-top:18px}.filter-group>span{margin:0 0 4px;color:#727b99;font-size:9px;font-weight:900;letter-spacing:.16em}.filter-group button{padding:8px 9px;border:0;border-radius:9px;color:#929ab5;text-align:left;background:transparent}.filter-group button.active{color:#fff;background:rgba(166,120,255,.13)}.composition-count{margin-top:24px}.composition-count span,.composition-count small{display:block}.composition-count span{font-size:22px;font-weight:900}.composition-count small{color:var(--muted)}.composition-count>div{height:5px;margin-top:9px;border-radius:9px;background:rgba(255,255,255,.08)}.composition-count i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--mint),var(--violet))}
.role-catalog{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:9px;max-height:570px;overflow:auto}.role-tile{position:relative;display:grid;grid-template-columns:42px 1fr;gap:10px;padding:14px;border:1px solid var(--line);border-radius:15px;color:#fff;text-align:left;background:rgba(15,16,34,.85)}.role-tile:hover,.role-tile.selected{border-color:rgba(166,120,255,.55);background:rgba(166,120,255,.09)}.role-glyph{display:grid;width:39px;height:39px;place-items:center;border-radius:12px;color:var(--mint);background:rgba(85,227,191,.09);font-size:20px}.role-tile small,.role-tile strong{display:block}.role-tile small{color:var(--mint);font-size:8px;font-weight:900;text-transform:uppercase}.role-tile strong{margin-top:4px;font-size:14px}.role-tile p{margin:5px 0 0;color:var(--muted);font-size:10px;line-height:1.35}.role-count{position:absolute;right:9px;top:9px;display:grid;width:23px;height:23px;place-items:center;border-radius:8px;color:#fff;background:var(--violet-deep);font-size:10px;font-weight:900}.camp-hostile .role-glyph,.camp-hostile .large-glyph{color:var(--violet)}.camp-solitary .role-glyph,.camp-solitary .large-glyph{color:var(--amber)}.camp-undecided .role-glyph{color:#aab3ca}
.role-detail{position:sticky;top:0;align-self:start}.large-glyph{display:grid;width:70px;height:70px;place-items:center;margin-bottom:18px;border:1px solid currentColor;border-radius:22px;color:var(--mint);background:rgba(85,227,191,.06);font-size:35px}.role-detail h3{margin:8px 0;font-size:25px}.role-detail>p{min-height:76px;color:#b7bdd1;font-size:12px;line-height:1.55}.role-detail dl{display:grid;gap:10px;margin:18px 0}.role-detail dl div{padding-top:10px;border-top:1px solid var(--line)}.role-detail dt{color:#727b98;font-size:8px;font-weight:900;text-transform:uppercase}.role-detail dd{margin:4px 0 0;color:#d7d9e6;font-size:11px;line-height:1.4}.role-add{display:grid;grid-template-columns:45px 1fr 45px;align-items:center;gap:8px}.role-add b{text-align:center}.role-add button{padding:0}.composition-strip{display:flex;gap:6px;margin-top:14px;padding:10px;border:1px solid var(--line);border-radius:14px;overflow:auto;background:rgba(10,11,25,.8)}.composition-strip span,.composition-strip i{flex:0 0 auto;padding:7px 10px;border-radius:9px;color:var(--mint);background:rgba(85,227,191,.08);font-size:9px;font-style:normal;font-weight:800}.composition-strip .camp-hostile{color:#c7a5ff;background:rgba(166,120,255,.1)}.composition-strip .camp-solitary{color:var(--amber);background:rgba(255,190,105,.1)}.composition-strip i{color:#777e97;background:rgba(255,255,255,.04)}
.assignment-choice{margin-bottom:14px}.manual-assignment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}.manual-assignment-grid label{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(180px,1fr);align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:rgba(10,11,25,.8)}.manual-assignment-grid label>span{display:flex;align-items:center;gap:8px;min-width:0;font-size:11px;font-weight:800}.manual-assignment-grid label>span b{display:grid;width:25px;height:25px;flex:0 0 auto;place-items:center;border-radius:8px;color:var(--amber);background:rgba(255,190,105,.08);font-size:9px}
.options-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.option-card{display:grid;align-content:start;gap:12px;padding:19px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}.option-card.wide{grid-column:1/-1}.card-icon{display:grid;width:39px;height:39px;place-items:center;border-radius:12px;color:var(--amber);background:rgba(255,190,105,.08);font-size:20px}.option-card h3{margin:0 0 4px;font-size:16px}.option-card p{margin:0;color:var(--muted);font-size:11px;line-height:1.45}.choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.choice-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.choice-grid>label,.choice-grid>button{padding:13px;border:1px solid var(--line);border-radius:13px;color:#fff;background:rgba(255,255,255,.025);text-align:left}.choice-grid label.active,.choice-grid button.active{border-color:var(--violet);background:rgba(166,120,255,.12)}.choice-grid input[type=radio]{display:none}.choice-grid b,.choice-grid small{display:block}.choice-grid small{margin-top:4px;color:var(--muted);font-size:9px}.toggle-row{display:flex;align-items:start;gap:10px}.toggle-row input{accent-color:var(--violet);width:17px;height:17px}.toggle-row b,.toggle-row small{display:block}.toggle-row b{font-size:12px}.toggle-row small{margin-top:2px;color:var(--muted);font-size:9px}.range-row{display:grid;gap:8px}.range-row span{display:flex;justify-content:space-between;color:#c8cbda;font-size:11px}.range-row input{accent-color:var(--violet)}.event-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.event-grid button{padding:12px;border:1px solid var(--line);border-radius:12px;color:#aaaec0;text-align:left;background:rgba(255,255,255,.025)}.event-grid button.active{border-color:rgba(85,227,191,.45);color:#fff;background:rgba(85,227,191,.08)}.event-grid b,.event-grid small{display:block}.event-grid small{margin-top:4px;color:var(--muted);font-size:9px}.favorite-save{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.favorite-save input{width:220px}.validation-box{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:14px 17px;border:1px solid rgba(255,190,105,.3);border-radius:15px;background:rgba(255,190,105,.06)}.validation-box>div{display:flex;align-items:center;gap:11px}.validation-box>div>span{display:grid;width:32px;height:32px;place-items:center;border-radius:50%;color:var(--amber);background:rgba(255,190,105,.12);font-weight:900}.validation-box b,.validation-box small{display:block}.validation-box small{margin-top:3px;color:var(--muted)}.validation-box.valid{border-color:rgba(85,227,191,.3);background:rgba(85,227,191,.06)}
.setup-footer{display:flex;height:72px;align-items:center;justify-content:space-between;padding:0 28px;border-top:1px solid var(--line);background:#0a0b1b}.setup-footer>div{display:flex;align-items:center;gap:14px}.setup-footer span{color:var(--muted);font-size:11px}.setup-footer .launch{min-width:200px}
.secret-screen{position:relative;display:grid;min-height:100vh;place-items:center;overflow:hidden;padding:90px 24px 50px;background:radial-gradient(circle at 50% 20%,rgba(120,78,207,.35),transparent 34%),linear-gradient(rgba(4,6,17,.82),rgba(4,6,17,.96)),var(--brume-village) center/cover}.secret-screen>header{position:absolute;top:0;left:0;right:0;display:flex;height:70px;align-items:center;justify-content:space-between;padding:0 30px;border-bottom:1px solid var(--line);background:rgba(5,7,18,.55);backdrop-filter:blur(15px)}.secret-screen>header b{flex:1;margin-left:12px}.handoff-card{position:relative;width:min(640px,100%);padding:38px;border:1px solid var(--line);border-radius:28px;text-align:center;background:rgba(12,13,31,.93);box-shadow:0 30px 100px rgba(0,0,0,.45);backdrop-filter:blur(20px)}.seat-orb,.role-sigil{display:grid;width:88px;height:88px;place-items:center;margin:0 auto 20px;border:1px solid rgba(255,190,105,.35);border-radius:28px;color:var(--amber);background:rgba(255,190,105,.07);font-size:42px}.handoff-card h1{margin:10px 0;font-family:Georgia,serif;font-size:45px}.handoff-card>p{max-width:490px;margin:0 auto 25px;color:var(--muted);line-height:1.6}.handoff-card.revealed{border-color:rgba(166,120,255,.4)}.role-sigil{width:76px;height:76px;color:var(--mint);font-size:34px}.camp-banner{display:inline-flex;padding:6px 12px;border-radius:999px;color:var(--mint);background:rgba(85,227,191,.08);font-size:10px;font-weight:900;text-transform:uppercase}.camp-banner.camp-hostile{color:#c9adff;background:rgba(166,120,255,.12)}.camp-banner.camp-solitary{color:var(--amber);background:rgba(255,190,105,.1)}.role-secret{font-size:16px}.win-box,.occupation-box,.known-box{margin:13px 0;padding:14px;border:1px solid var(--line);border-radius:14px;text-align:left;background:rgba(255,255,255,.025)}.win-box small,.occupation-box small{display:block;color:var(--amber);font-size:8px;font-weight:900;letter-spacing:.14em}.win-box b,.occupation-box b{display:block;margin-top:5px}.occupation-box p{margin:5px 0 0;color:var(--muted);font-size:11px}.privacy-note{position:absolute;bottom:18px;margin:0;color:#7e859e;font-size:10px}
.game-topbar{height:70px;min-height:70px;justify-content:space-between}.phase-chip{display:flex;align-items:center;gap:8px;padding:8px 13px;border:1px solid rgba(166,120,255,.25);border-radius:999px;color:#d3c5f9;background:rgba(166,120,255,.08);font-size:11px;font-weight:900;text-transform:uppercase}.phase-chip i{width:7px;height:7px;border-radius:50%;background:var(--violet);box-shadow:0 0 12px var(--violet)}.phase-chip.phase-dawn,.phase-chip.phase-discussion{color:#ffd390;border-color:rgba(255,190,105,.25);background:rgba(255,190,105,.07)}.phase-chip.phase-dawn i,.phase-chip.phase-discussion i{background:var(--amber);box-shadow:0 0 12px var(--amber)}.game-top-actions{display:flex;align-items:center;gap:8px}.room-chip{padding:8px 11px;border:1px solid var(--line);border-radius:10px;color:var(--muted);font-size:9px;letter-spacing:.12em}.room-chip b{color:#fff}.icon-button{display:grid;width:36px;height:36px;place-items:center;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.04)}
.game-layout{display:grid;grid-template-columns:82px 1fr;height:calc(100vh - 70px)}.game-nav{display:flex;flex-direction:column;gap:6px;padding:12px 8px;border-right:1px solid var(--line);background:#090a18}.game-nav button{display:grid;min-height:58px;place-items:center;gap:2px;border:0;border-radius:12px;color:#78809b;background:transparent}.game-nav button span{font-size:18px}.game-nav button small{font-size:8px}.game-nav button.active{color:#fff;background:rgba(166,120,255,.13)}.nav-spacer{flex:1}.game-nav .danger-nav{color:#d97a96}.stage{position:relative;overflow:auto;background:radial-gradient(circle at 75% 0,rgba(119,78,207,.15),transparent 38%),#0b0c1c}.caption-bar{position:sticky;z-index:5;top:0;display:flex;align-items:center;gap:10px;min-height:43px;padding:8px 18px;border-bottom:1px solid var(--line);background:rgba(8,9,22,.88);backdrop-filter:blur(12px)}.caption-bar span{padding:3px 5px;border:1px solid #737b94;border-radius:4px;font-size:8px;font-weight:900}.caption-bar p{margin:0;color:#c6cad9;font-size:11px}.pause-overlay{position:fixed;z-index:30;inset:70px 0 0 82px;display:grid;place-content:center;text-align:center;background:rgba(5,6,16,.94);backdrop-filter:blur(18px)}.pause-overlay>span{font-size:50px;color:var(--violet)}.pause-overlay h2{margin:12px 0 6px;font-size:36px}.pause-overlay p{color:var(--muted)}.pause-overlay button{justify-self:center}
.phase-hero,.secret-call{display:grid;width:min(860px,calc(100% - 48px));min-height:calc(100vh - 170px);margin:auto;place-content:center;justify-items:center;padding:45px;text-align:center}.orb{display:grid;width:92px;height:92px;place-items:center;margin-bottom:19px;border:1px solid rgba(166,120,255,.35);border-radius:50%;color:#cbb8ff;background:radial-gradient(circle,rgba(166,120,255,.22),rgba(166,120,255,.03));box-shadow:0 0 70px rgba(125,79,226,.2);font-size:48px}.phase-hero h1,.secret-call h1{max-width:780px;margin:10px 0;font-family:Georgia,serif;font-size:clamp(36px,5vw,65px);font-weight:500;line-height:1.02}.phase-hero>p,.secret-call>p{max-width:650px;color:var(--muted);line-height:1.65}.phase-notes{display:flex;gap:16px;margin-top:25px;color:#8992ae;font-size:10px}.dawn-hero{background:radial-gradient(circle at 50% 40%,rgba(255,190,105,.11),transparent 34%)}.sun{color:var(--amber);border-color:rgba(255,190,105,.38);background:rgba(255,190,105,.08);box-shadow:0 0 80px rgba(255,178,70,.18)}.event-banner{display:flex;width:min(620px,100%);gap:14px;margin:15px 0;padding:15px;border:1px solid rgba(255,190,105,.25);border-radius:16px;text-align:left;background:rgba(255,190,105,.055)}.event-banner>span{font-size:27px;color:var(--amber)}.event-banner small,.event-banner b{display:block}.event-banner small{color:var(--amber);font-size:8px;letter-spacing:.12em}.event-banner p{margin:5px 0 0;color:var(--muted);font-size:11px}.victim-row{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:15px 0 22px}.victim-row article{display:grid;gap:3px;min-width:130px;padding:12px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.035)}.victim-row article span{font-size:25px;color:var(--amber)}.victim-row article small{color:var(--muted)}
.night-action-stage{min-height:calc(100vh - 113px);background:radial-gradient(circle at 50% 45%,rgba(113,70,203,.18),transparent 37%),linear-gradient(rgba(7,8,20,.82),rgba(7,8,20,.96)),var(--brume-village) center/cover}.secret-call small{margin-top:13px;color:#7e87a3}.role-orb{border-radius:28px;color:var(--amber);font-size:38px}.action-console{width:min(900px,calc(100% - 48px));margin:auto;padding:36px 0}.action-console>header{display:flex;align-items:center;gap:18px;margin-bottom:23px}.action-console .role-sigil{flex:0 0 auto;width:65px;height:65px;margin:0;border-radius:20px}.action-console h2{margin:5px 0;font-size:28px}.action-console header p{margin:0;color:var(--muted)}.target-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.target-grid button{display:grid;justify-items:center;gap:7px;min-height:92px;padding:13px;border:1px solid var(--line);border-radius:15px;color:#fff;background:rgba(18,19,42,.9)}.target-grid button:hover,.target-grid button.selected{border-color:var(--violet);background:rgba(166,120,255,.14);box-shadow:inset 0 0 0 1px rgba(166,120,255,.25)}.target-grid button>span{display:grid;width:32px;height:32px;place-items:center;border-radius:10px;color:var(--amber);background:rgba(255,190,105,.08);font-size:11px;font-weight:900}.action-console>footer,.ballot>footer{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.private-result{display:flex;align-items:center;gap:12px;padding:18px;border:1px solid var(--line);border-radius:15px;background:rgba(85,227,191,.06)}.private-result span{color:var(--mint);font-size:28px}.private-result p{margin:0;color:#ccd2e3}
.discussion-stage,.vote-stage,.panel-page{width:min(1160px,calc(100% - 48px));margin:auto;padding:36px 0 50px}.discussion-stage>header,.vote-stage>header{display:flex;align-items:center;justify-content:space-between}.discussion-stage h1,.vote-stage h1{margin:7px 0;font-size:38px}.discussion-stage header p,.vote-stage header p{margin:0;color:var(--muted)}.timer{font-variant-numeric:tabular-nums;font-size:62px;font-weight:300;letter-spacing:-.06em}.timer.compact{font-size:42px}.timer.urgent{color:var(--rose);animation:pulse 1s infinite}.alive-circle{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:32px 0}.alive-circle article{display:grid;justify-items:center;gap:5px;padding:19px 10px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}.alive-circle article>span{font-size:29px;color:var(--amber)}.alive-circle small{color:var(--muted);font-size:8px}.alive-circle .muted{border-color:rgba(255,111,157,.3)}.discussion-stage>footer{display:flex;align-items:center;justify-content:space-between}.discussion-stage footer>div{display:flex;gap:7px}.vote-handoff,.sealed-complete{display:grid;justify-items:center;gap:9px;margin:35px 0;padding:45px;border:1px solid var(--line);border-radius:22px;text-align:center;background:var(--panel)}.vote-handoff>span,.sealed-complete>span{font-size:48px;color:var(--amber)}.vote-handoff h2,.sealed-complete h2{margin:0}.vote-handoff p{color:var(--muted)}.ballot{margin-top:28px}.text-button{margin-top:14px;padding:8px;color:#929ab4;background:transparent;text-decoration:underline}.verdict{color:var(--amber)}.tally{display:grid;width:min(600px,100%);gap:8px;margin:15px 0}.tally article{position:relative;display:flex;overflow:hidden;justify-content:space-between;padding:12px 14px;border:1px solid var(--line);border-radius:11px;text-align:left;background:rgba(255,255,255,.03)}.tally article>*:not(i){position:relative;z-index:1}.tally i{position:absolute;inset:0 auto 0 0;background:rgba(166,120,255,.13)}.verdict-actions{display:flex;gap:8px;margin-top:15px}
.panel-page>header{margin-bottom:25px}.resident-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.resident-grid article{display:flex;gap:13px;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}.resident-grid article.dead{opacity:.52}.resident-avatar{display:grid;width:48px;height:48px;flex:0 0 auto;place-items:center;border-radius:14px;color:var(--amber);background:rgba(255,190,105,.08);font-size:25px}.resident-grid small{color:var(--muted);font-size:8px}.resident-grid h3{margin:4px 0}.resident-grid p{margin:0;color:var(--muted);font-size:10px}.resident-grid b{display:block;margin-top:5px;color:var(--mint);font-size:10px}.history-list{display:grid;gap:8px}.history-list article{display:grid;grid-template-columns:80px 1fr;gap:12px;padding:13px;border:1px solid var(--line);border-radius:13px;background:var(--panel)}.history-list>article>span{color:var(--amber);font-size:10px;font-weight:900}.history-list b,.history-list small{display:block}.history-list small{margin-top:4px;color:var(--muted);font-size:9px}.history-list .visibility-secret{border-color:rgba(166,120,255,.26)}.spectator-layout,.control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.control-grid{grid-template-columns:repeat(2,minmax(300px,1fr))}.panel-card{padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}.panel-card h3{margin-top:0}.panel-card>p{color:var(--muted);line-height:1.5}.panel-card>label{display:grid;gap:5px;margin-top:11px}.panel-card>label>span{color:var(--muted);font-size:10px}.panel-card .primary{margin-top:14px}.score-list{display:grid;gap:7px}.score-list>div,.pin-list>div{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;padding:9px;border-radius:10px;background:rgba(255,255,255,.035)}.score-list span{display:grid;width:24px;height:24px;place-items:center;border-radius:8px;color:var(--amber);background:rgba(255,190,105,.08);font-size:9px}.prediction-count{display:flex;align-items:baseline;gap:8px;margin-top:20px}.prediction-count b{font-size:34px}.prediction-count small{color:var(--muted)}.panel-card ul{padding-left:20px;color:#b7bdd1;line-height:1.8}.camera-preview{position:relative;overflow:hidden;border-radius:14px;background:#050610}.camera-preview video{display:block;width:100%;max-height:220px;object-fit:cover}.camera-preview video.blurred{filter:blur(24px) brightness(.35);transform:scale(1.08)}.camera-live{position:absolute;top:9px;left:9px;padding:5px 8px;border-radius:999px;color:#fff;background:rgba(214,50,89,.88);font-size:8px;font-weight:900}.inline-error{color:#ff9db6!important}.lan-card img{display:block;width:150px;margin:0 auto;border-radius:12px}.lan-card>p{overflow-wrap:anywhere;text-align:center;font-size:10px}.pin-list{display:grid;gap:5px;margin-top:11px}.pin-list>div{grid-template-columns:12px 1fr auto}.pin-list i{width:7px;height:7px;border-radius:50%;background:#596078}.pin-list i.online{background:var(--mint);box-shadow:0 0 9px var(--mint)}.pin-list b{font-variant-numeric:tabular-nums;letter-spacing:.12em}.warning{border-color:rgba(255,190,105,.35);color:var(--amber)}.danger{border-color:rgba(255,111,157,.35);color:var(--rose)}
.end-overlay{position:fixed;z-index:20;inset:70px 0 0 82px;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 30%,rgba(126,77,222,.3),transparent 38%),rgba(5,6,16,.96)}.end-card{width:min(850px,100%);padding:38px;border:1px solid rgba(166,120,255,.33);border-radius:28px;text-align:center;background:rgba(15,16,36,.95);box-shadow:0 30px 90px rgba(0,0,0,.4)}.victory-orb{margin:0 auto 16px}.end-card h1{margin:10px 0 22px;font-family:Georgia,serif;font-size:38px;font-weight:500}.winner-row{display:flex;flex-wrap:wrap;justify-content:center;gap:9px}.winner-row article{display:grid;min-width:130px;gap:4px;padding:13px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.035)}.winner-row article span{font-size:28px;color:var(--amber)}.winner-row small{color:var(--mint)}.end-stats{display:flex;justify-content:center;gap:28px;margin:25px 0;color:var(--muted)}.end-stats b{display:block;color:#fff;font-size:22px}.end-actions{display:flex;justify-content:center;gap:8px}
.brume-toast{position:fixed;z-index:100;right:22px;bottom:22px;max-width:420px;padding:13px 17px;border:1px solid rgba(85,227,191,.3);border-radius:13px;color:#fff;background:rgba(16,32,37,.96);box-shadow:0 18px 50px rgba(0,0,0,.35)}.modal-backdrop{position:fixed;z-index:90;inset:0;display:grid;place-items:center;padding:24px;background:rgba(3,4,11,.78);backdrop-filter:blur(12px)}.confirm-modal{width:min(520px,100%);padding:28px;border:1px solid rgba(255,190,105,.3);border-radius:24px;background:#121327}.confirm-modal h2{font-size:28px}.confirm-modal p{padding:10px;border-radius:11px;color:#c5c9d9;background:rgba(255,190,105,.06)}.confirm-modal>div{display:flex;justify-content:flex-end;gap:8px}.secret-stars{position:absolute;inset:0;opacity:.25;background-image:radial-gradient(#fff 1px,transparent 1px);background-size:45px 45px;mask-image:linear-gradient(to bottom,#000,transparent)}
@keyframes pulse{50%{opacity:.58}}
@media(max-width:1180px){.role-workspace{grid-template-columns:190px 1fr}.role-detail{grid-column:1/-1;display:grid;grid-template-columns:80px 1fr 220px;gap:14px}.role-detail .large-glyph{grid-row:1/4}.role-detail>p{min-height:0}.role-detail dl{grid-column:2/3}.role-detail .role-add{grid-column:3;grid-row:1/3}.options-grid{grid-template-columns:repeat(2,1fr)}.event-grid{grid-template-columns:repeat(2,1fr)}.home-card{display:none}.alive-circle{grid-template-columns:repeat(4,1fr)}}
@media(max-width:820px){:global(body){overflow:auto}.topbar{align-items:flex-start;padding:12px;flex-wrap:wrap}.wizard-nav{order:3;width:100%}.balance-pill{margin-left:auto}.setup-body{height:auto}.setup-footer{position:sticky;bottom:0}.players-editor,.options-grid,.resident-grid,.spectator-layout,.control-grid,.manual-assignment-grid{grid-template-columns:1fr}.option-card.wide{grid-column:auto}.role-workspace{grid-template-columns:1fr}.role-filters{display:grid;grid-template-columns:1fr 1fr;gap:10px}.role-detail{display:block;grid-column:auto}.role-catalog{grid-template-columns:1fr;max-height:none}.game-layout{grid-template-columns:1fr}.game-nav{position:fixed;z-index:15;right:0;bottom:0;left:0;display:flex;height:62px;flex-direction:row;border-top:1px solid var(--line);border-right:0}.game-nav button{flex:1;min-height:44px}.nav-spacer{display:none}.stage{padding-bottom:65px}.pause-overlay,.end-overlay{inset:70px 0 62px}.target-grid{grid-template-columns:repeat(2,1fr)}.alive-circle{grid-template-columns:repeat(2,1fr)}.home-copy{width:calc(100% - 40px);padding:18vh 20px 80px}.home-brand{left:20px}.home-copy h1{font-size:58px}.feature-row{display:grid}.page-heading,.discussion-stage>header,.vote-stage>header{align-items:flex-start;flex-direction:column}.timer{font-size:48px}.discussion-stage>footer{align-items:stretch;flex-direction:column;gap:12px}.choice-grid.three,.event-grid{grid-template-columns:1fr}.end-stats,.end-actions{flex-wrap:wrap}}
</style>
