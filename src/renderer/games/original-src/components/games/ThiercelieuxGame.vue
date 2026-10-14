<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import landscapeUrl from '../../../../assets/games/catalog/thiercelieux-landscape.png?url'
import portraitUrl from '../../../../assets/games/catalog/thiercelieux-portrait.png?url'
import {
  ACTION_REVEAL_POLICY,
  MAX_ACTIVE_PLAYERS,
  MIN_ACTIVE_PLAYERS,
  ROLE_BY_ID,
  appointCaptain,
  availableTargets,
  beginDiscussion,
  beginSecondVote,
  beginVote,
  checkVictory,
  createGame,
  finishVerdict,
  guideForStep,
  hideAndConfirmRole,
  hydrateGame,
  normalizeConfig,
  privatePlayerView,
  publicGameView,
  recommendedRoleIds,
  resolveDeathTrigger,
  resolveScapegoatVoters,
  resolveVote,
  revealRole,
  serializeGame,
  skipDeathTrigger,
  startNight,
  submitNightAction,
  submitVote,
  validateSetup,
} from '../../domain/thiercelieuxEngine.mjs'

type Screen = 'ready' | 'reveal' | 'game' | 'ended'

const MULTIPLE_TARGET_LIMITS: Record<string, number> = {
  lovers: 2,
  charm: 2,
}

const props = defineProps<{ initialSettings?: Record<string, any> }>()
const GAME_KEY = 'shenpulse.thiercelieux.game.v1'
const api = window.shenPulse as any
const screen = ref<Screen>('ready')
const config = ref<any>(normalizeConfig(props.initialSettings || {}))
const preparedPlayers = ref<any[]>([])
const roleIds = ref<string[]>([])
const game = ref<any>(null)
const privateUnlocked = ref(false)
const selectedTargetId = ref('')
const selectedTargetIds = ref<string[]>([])
const actionChoice = ref('')
const witchHeal = ref(false)
const paused = ref(false)
const phaseRemaining = ref(0)
const revealRemaining = ref(0)
const toast = ref('')
const hostError = ref('')
const ambienceMuted = ref(false)
const phasePulse = ref(0)
const privateResults = ref<any[]>([])
const privateResultUnlocked = ref(false)
const pendingDawnAfterResults = ref(false)
const lastDawnAnnouncements = ref<string[]>([])
const shownBriefStepIds = new Set<string>()
let toastTimer = 0
let phaseTimer = 0
let revealTimer = 0
let ambienceTimer = 0
let audioContext: AudioContext | null = null
let ambienceGain: GainNode | null = null
let ambienceNodes: AudioNode[] = []
let unsubscribeCommand = () => {}

const setupValidation = computed(() => validateSetup({ players: preparedPlayers.value, roleIds: roleIds.value, config: config.value }))
const saved = computed(() => savedGame())
const currentRevealPlayer = computed(() => game.value?.players?.[game.value.revealIndex] || null)
const currentPrivateView = computed(() => currentRevealPlayer.value && privateUnlocked.value ? privatePlayerView(game.value, currentRevealPlayer.value.id) : null)
const currentPrivateResult = computed(() => privateResults.value[0] || null)
const publicView = computed(() => game.value ? publicGameView(game.value) : null)
const guide = computed(() => game.value ? guideForStep(game.value) : null)
const guideTargets = computed(() => game.value ? availableTargets(game.value) : [])
const multipleTargetLimit = computed(() => MULTIPLE_TARGET_LIMITS[guide.value?.action || ''] || 0)
const deathTrigger = computed(() => game.value?.deathTriggers?.[0] || null)
const deathTargets = computed(() => game.value?.players?.filter((player: any) => {
  if (!player.alive || player.id === deathTrigger.value?.actorId) return false
  if (deathTrigger.value?.kind === 'colossus') return player.camp === 'wolves' || player.roleId === 'loup-garou-blanc'
  if (deathTrigger.value?.kind === 'servant') return player.id === deathTrigger.value.victimId
  return true
}) || [])
const aliveVoters = computed(() => game.value?.players?.filter((player: any) => player.alive
  && !player.statuses.includes('no-vote')
  && (game.value?.restrictedVoteDay !== game.value?.day || game.value?.restrictedVoterIds?.includes(player.id))) || [])
const currentVoter = computed(() => aliveVoters.value.find((player: any) => !(player.id in (game.value?.votes || {}))) || null)
const currentNightActor = computed(() => guide.value ? game.value?.players?.find((player: any) => player.id === guide.value.actorId) || null : null)
const activeBackdrop = computed(() => config.value.orientation === 'portrait' ? portraitUrl : landscapeUrl)
const boardPlayers = computed(() => publicView.value?.players || preparedPlayers.value.map((player: any, index: number) => ({ ...player, seat: player.seat || index + 1, alive: true })))
const aliveCount = computed(() => boardPlayers.value.filter((player: any) => player.alive !== false).length)
const gamePhaseTitle = computed(() => currentPrivateResult.value ? 'Résultat privé' : ({
  'night-intro': 'La nuit approche',
  night: `Nuit ${game.value?.night || 1}`,
  dawn: `Aube · Jour ${game.value?.day || 1}`,
  discussion: 'Le village débat',
  vote: 'Le village vote',
  verdict: 'Le verdict tombe',
  'death-trigger': 'Une dernière volonté',
  ended: 'La partie est terminée',
} as Record<string, string>)[game.value?.phase] || (screen.value === 'reveal' ? 'Les cartes sont distribuées' : 'Le village vous attend'))
const boardHint = computed(() => {
  if (currentPrivateResult.value) return privateResultUnlocked.value ? 'Touchez encore pour refermer' : `Pour ${currentPrivateResult.value.recipientName} · touchez la carte`
  if (screen.value === 'ready') return setupValidation.value.valid ? 'Pilotage depuis ShenPulse' : 'Configuration en attente'
  if (screen.value === 'reveal') return privateUnlocked.value ? 'Touchez encore pour refermer' : `Carte ${Number(game.value?.revealIndex || 0) + 1} sur ${game.value?.players?.length || 0}`
  if (game.value?.phase === 'night' && guideTargets.value.length) return 'Choisissez une carte'
  if (game.value?.phase === 'vote') return currentVoter.value ? `Au tour de ${currentVoter.value.name}` : 'Votes enregistrés'
  if (game.value?.phase === 'death-trigger') return 'Choisissez une carte'
  return 'Suivez la voix du village'
})
const selectableIds = computed(() => {
  if (currentPrivateResult.value) return new Set<string>([currentPrivateResult.value.displayPlayerId])
  if (screen.value !== 'game' || !game.value) return new Set<string>()
  if (game.value.phase === 'night') {
    const targetIds = guideTargets.value.map((player: any) => player.id)
    const limit = multipleTargetLimit.value
    if (limit && selectedTargetIds.value.length >= limit) {
      const selected = new Set(selectedTargetIds.value)
      return new Set(targetIds.filter((id: string) => selected.has(id)))
    }
    return new Set(targetIds)
  }
  if (game.value.phase === 'vote') return new Set(game.value.players.filter((player: any) => player.alive).map((player: any) => player.id))
  if (game.value.phase === 'death-trigger') return new Set(deathTargets.value.map((player: any) => player.id))
  return new Set<string>()
})
const selectedIds = computed(() => new Set([selectedTargetId.value, ...selectedTargetIds.value].filter(Boolean)))

watch(game, () => {
  if (!game.value) return
  if (config.value.saveEnabled) try { localStorage.setItem(GAME_KEY, serializeGame(game.value)) } catch {}
  if (game.value.finished) screen.value = 'ended'
}, { deep: true })

watch(() => guide.value?.id, () => {
  resetAction()
  phasePulse.value += 1
  maybeQueueActionBrief()
  if (guide.value && config.value.runMode !== 'manual') speak(guide.value.phrase)
})

watch(
  [screen, game, privateUnlocked, privateResults, privateResultUnlocked, lastDawnAnnouncements, selectedTargetId, selectedTargetIds, actionChoice, witchHeal, paused, phaseRemaining, revealRemaining, hostError, ambienceMuted, () => config.value.ambienceVolume],
  () => publishHostState(),
  { deep: true, immediate: true },
)

onMounted(() => {
  applySettings(props.initialSettings || {})
  window.addEventListener('shenpulse:thiercelieux-settings', handleSettings as EventListener)
  window.addEventListener('shenpulse:thiercelieux-effect', handleExternalEffect as EventListener)
  window.addEventListener('shenpulse:thiercelieux-command', handleCommandEvent as EventListener)
  unsubscribeCommand = api?.on?.('thiercelieux-command', (command: any) => handleCommand(command)) || (() => {})
  publishHostState()
})

onBeforeUnmount(() => {
  window.removeEventListener('shenpulse:thiercelieux-settings', handleSettings as EventListener)
  window.removeEventListener('shenpulse:thiercelieux-effect', handleExternalEffect as EventListener)
  window.removeEventListener('shenpulse:thiercelieux-command', handleCommandEvent as EventListener)
  unsubscribeCommand()
  window.clearTimeout(toastTimer)
  window.clearInterval(phaseTimer)
  window.clearInterval(revealTimer)
  stopAmbience()
  window.speechSynthesis?.cancel()
})

function applySettings(settings: Record<string, any>) {
  if (screen.value !== 'ready') return
  config.value = normalizeConfig(settings)
  ambienceMuted.value = config.value.audioEnabled === false
  preparedPlayers.value = Array.isArray(settings.activePlayers) ? structuredClone(settings.activePlayers).slice(0, MAX_ACTIVE_PLAYERS) : []
  const suppliedRoles = Array.isArray(settings.roleIds) ? settings.roleIds.map(String) : []
  roleIds.value = suppliedRoles.length === preparedPlayers.value.length
    ? suppliedRoles.slice(0, preparedPlayers.value.length)
    : preparedPlayers.value.length >= MIN_ACTIVE_PLAYERS
      ? recommendedRoleIds(preparedPlayers.value.length, { packs: config.value.packs })
      : []
  void api?.setGameWindowFormat?.('thiercelieux', config.value.orientation).catch(() => {})
}

function handleSettings(event: CustomEvent) { applySettings(event.detail || {}); notify('Le plateau est synchronisé avec ShenPulse.') }
function handleExternalEffect(event: CustomEvent) {
  const effectId = String(event.detail?.effectId || '')
  if (effectId === 'ajouter-temps') phaseRemaining.value += 30
  if (effectId === 'hurlement') { playHowl(); notify('Un hurlement traverse le village…') }
}
function handleCommandEvent(event: CustomEvent) { handleCommand(event.detail || {}) }
function savedGame() { try { return hydrateGame(localStorage.getItem(GAME_KEY) || '') } catch { return null } }

function startPreparedGame() {
  if (!setupValidation.value.valid) return fail(setupValidation.value.errors[0] || 'La régie est incomplète.')
  clearPrivateResults()
  lastDawnAnnouncements.value = []
  game.value = createGame({ players: preparedPlayers.value, roleIds: roleIds.value, config: config.value })
  screen.value = 'reveal'
  privateUnlocked.value = false
  hostError.value = ''
  phasePulse.value += 1
  startAmbience()
  playTransitionSound()
}

function resumeGame() {
  const restored = savedGame()
  if (!restored) return fail('Aucune sauvegarde compatible.')
  clearPrivateResults()
  game.value = restored
  config.value = normalizeConfig(restored.config)
  void api?.setGameWindowFormat?.('thiercelieux', config.value.orientation).catch(() => {})
  screen.value = restored.finished ? 'ended' : restored.phase === 'reveal' ? 'reveal' : 'game'
  startAmbience()
  phasePulse.value += 1
}

function unlockRole() {
  if (!currentRevealPlayer.value) return
  revealRole(game.value, currentRevealPlayer.value.id)
  privateUnlocked.value = true
  revealRemaining.value = config.value.revealSeconds
  playCardSound(520)
  window.clearInterval(revealTimer)
  revealTimer = window.setInterval(() => {
    revealRemaining.value -= 1
    if (revealRemaining.value <= 0) { window.clearInterval(revealTimer); privateUnlocked.value = false }
  }, 1000)
}

function confirmRole() {
  if (!currentRevealPlayer.value) return
  window.clearInterval(revealTimer)
  hideAndConfirmRole(game.value, currentRevealPlayer.value.id)
  privateUnlocked.value = false
  playCardSound(280)
  if (game.value.phase !== 'reveal') {
    screen.value = 'game'
    phasePulse.value += 1
    playTransitionSound()
  }
}

function beginCurrentNight() { clearPrivateResults(); startNight(game.value); queuePendingNightNotices(); resetAction(); phasePulse.value += 1; playHowl() }
function toggleTarget(id: string, multiple = false) {
  if (!multiple) selectedTargetId.value = selectedTargetId.value === id ? '' : id
  else if (selectedTargetIds.value.includes(id)) selectedTargetIds.value = selectedTargetIds.value.filter((entry) => entry !== id)
  else {
    const limit = multipleTargetLimit.value
    if (limit && selectedTargetIds.value.length >= limit) return
    selectedTargetIds.value = [...selectedTargetIds.value, id]
  }
  playCardSound(selectedIds.value.has(id) ? 430 : 240)
}

function validateNightStep(skip = false) {
  try {
    if (currentPrivateResult.value) return fail('Refermez d’abord le résultat privé affiché sur le plateau.')
    const step = guide.value ? { ...guide.value } : null
    const actor = step ? game.value?.players?.find((player: any) => player.id === step.actorId) : null
    if (!step || !actor) return fail('Aucune action nocturne n’est attendue.')
    const action = guide.value?.action
    const payload: any = { skip }
    if (['lovers', 'charm'].includes(action)) payload.targetIds = selectedTargetIds.value
    else if (['choose-camp', 'steal', 'spiritism'].includes(action)) payload.choice = actionChoice.value
    else if (action === 'actor') { payload.choice = actionChoice.value; payload.targetId = selectedTargetId.value }
    else if (action === 'witch') { payload.heal = witchHeal.value; payload.poisonTargetId = selectedTargetId.value }
    else payload.targetId = selectedTargetId.value
    const messageCounts = Object.fromEntries(game.value.players.map((player: any) => [player.id, (game.value.privateMessages?.[player.id] || []).length]))
    submitNightAction(game.value, payload)
    queueNightResults({ step, actor, payload, messageCounts })
    resetAction()
    hostError.value = ''
    if (game.value.phase === 'dawn' || game.value.phase === 'death-trigger') {
      if (privateResults.value.length) pendingDawnAfterResults.value = true
      else speakDawn()
    }
  } catch (error: any) { fail(error.message) }
}

function queueNightResults({ step, actor, payload, messageCounts }: any) {
  if (payload.skip) return
  const policy = ACTION_REVEAL_POLICY[step.action as keyof typeof ACTION_REVEAL_POLICY] || 'none'
  const newMessages = new Map<string, string[]>()
  for (const player of game.value.players) {
    const messages = (game.value.privateMessages?.[player.id] || []).slice(Number(messageCounts[player.id] || 0)).map((entry: any) => String(entry.message || '')).filter(Boolean)
    if (messages.length) newMessages.set(player.id, messages)
  }
  const target = game.value.players.find((player: any) => player.id === (payload.targetId || payload.poisonTargetId))
  const targets = (payload.targetIds || []).map((id: string) => game.value.players.find((player: any) => player.id === id)).filter(Boolean)
  if (policy === 'private-actor') {
    const actorMessages = newMessages.get(actor.id) || []
    const displayPlayerId = ['inspect-role', 'monkey'].includes(step.action) && target ? target.id : actor.id
    queuePrivateResult({
      recipient: actor,
      displayPlayerId,
      title: `${ROLE_BY_ID[step.roleId]?.name || 'Personnage'} · résultat`,
      eyebrow: 'INFORMATION IMMÉDIATE',
      lines: actorMessages.length ? actorMessages : nightResultFallback(step.action, actor, target, targets, payload),
    })
  }
  if (policy === 'private-targets') {
    for (const [playerId, lines] of newMessages) {
      const recipient = game.value.players.find((player: any) => player.id === playerId)
      if (recipient) queuePrivateResult({ recipient, displayPlayerId: recipient.id, title: privateTargetTitle(step.action), eyebrow: 'INFORMATION SECRÈTE', lines })
    }
  }
}

function privateTargetTitle(action: string) {
  return ({ lovers: 'Les Amoureux se reconnaissent', charm: 'Les joueurs charmés se reconnaissent', infect: 'La morsure de l’Infect Père', 'suppress-power': 'Votre pouvoir est neutralisé' } as Record<string, string>)[action] || 'Message secret'
}

function nightResultFallback(action: string, actor: any, target: any, targets: any[], payload: any) {
  if (payload.skip) return ['Vous avez choisi de ne pas utiliser ce pouvoir cette nuit.']
  const names = targets.map((player) => player.name).join(' et ')
  const fallbacks: Record<string, string> = {
    steal: payload.choice ? `Votre nouveau personnage est ${ROLE_BY_ID[payload.choice]?.name || payload.choice}.` : 'Vous conservez votre personnage.',
    actor: 'Le pouvoir du Comédien a été confirmé pour cette nuit.',
    lovers: `${names || 'Les deux cartes choisies'} sont désormais Amoureux.`,
    'choose-model': `${target?.name || 'La carte choisie'} devient votre modèle.`,
    'judge-sign': 'Votre signe secret est enregistré pour cette partie.',
    bear: actor.statuses?.includes('bear-growl') ? 'Votre ours grogne : un Loup-Garou se trouve à votre voisinage.' : 'Votre ours reste calme : aucun Loup-Garou à votre voisinage.',
    raven: `${target?.name || 'La cible'} recevra deux voix supplémentaires au prochain vote.`,
    'burn-building': target?.buildingId ? `Le bâtiment de ${target.name} a été incendié.` : 'Aucun bâtiment n’a pu être incendié.',
    protect: `${target?.name || 'La cible'} est protégé·e contre l’attaque normale de la meute.`,
    'wolf-vote': `La meute a désigné ${target?.name || 'sa victime'}.`,
    'observe-wolves': 'La phase d’observation est terminée.',
    'white-wolf': `${target?.name || 'La cible'} a été désigné·e par le Loup-Garou Blanc.`,
    infect: `${target?.name || 'La victime de la meute'} sera infecté·e au lieu d’être éliminé·e.`,
    'big-wolf': `${target?.name || 'La cible'} a été désigné·e comme seconde victime.`,
    'suppress-power': `Le pouvoir de ${target?.name || 'la cible'} est neutralisé.`,
    witch: witchResultLine(payload, target),
    spiritism: 'La question de Spiritisme du lendemain est préparée.',
    charm: `${names || 'Aucune nouvelle personne'} ${targets.length > 1 ? 'sont charmées' : 'est charmée'}.`,
    fox: 'Le résultat du groupe inspecté est enregistré.',
    recognize: 'Vous avez pu reconnaître les membres de votre groupe.',
    'choose-camp': `Votre camp est désormais ${payload.choice === 'wolves' ? 'Loups-Garous' : 'Villageois'}.`,
    'inspect-role': 'Le personnage de la carte choisie va être révélé.',
    monkey: 'Le personnage de la carte choisie va être révélé.',
  }
  return [fallbacks[action] || 'Votre action a bien été enregistrée.']
}

function witchResultLine(payload: any, target: any) {
  const actions = []
  if (payload.heal) actions.push('la potion de vie a été utilisée')
  if (payload.poisonTargetId) actions.push(`${target?.name || 'la cible'} a reçu la potion de mort`)
  return actions.length ? `Action confirmée : ${actions.join(' et ')}.` : 'Vous n’avez utilisé aucune potion cette nuit.'
}

function maybeQueueActionBrief() {
  const step = guide.value
  if (!step || shownBriefStepIds.has(step.id) || !['witch', 'steal'].includes(step.action)) return
  const actor = game.value?.players?.find((player: any) => player.id === step.actorId)
  const victim = game.value?.players?.find((player: any) => player.id === game.value?.wolfVictimId)
  const line = step.action === 'steal'
    ? `Cartes au centre : ${(game.value?.centerRoles || []).map((roleId: string) => ROLE_BY_ID[roleId]?.name || roleId).join(' et ')}.`
    : step.privateAlert || (victim ? `Victime de la meute : ${victim.name}.` : '')
  if (!actor || !line) return
  shownBriefStepIds.add(step.id)
  queuePrivateResult({ recipient: actor, displayPlayerId: actor.id, title: step.action === 'witch' ? 'Victime de la meute' : 'Cartes du Voleur', eyebrow: 'AVANT VOTRE ACTION', lines: [line] })
}

function queuePendingNightNotices() {
  for (const player of game.value?.players || []) {
    if (player.alive && player.statuses?.includes('wild-converted') && !player.statuses.includes('wild-notified')) {
      player.statuses.push('wild-notified')
      queuePrivateResult({ recipient: player, displayPlayerId: player.id, title: 'Votre camp change', eyebrow: 'INFORMATION SECRÈTE', lines: ['Votre modèle est mort. À partir de cette nuit, vous rejoignez les Loups-Garous.'] })
    }
  }
}

function queuePrivateResult({ recipient, displayPlayerId, title, eyebrow, lines }: any) {
  if (!recipient || !displayPlayerId || !Array.isArray(lines) || !lines.length) return
  privateResults.value.push({
    id: `${Date.now()}-${recipient.id}-${privateResults.value.length}`,
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientSeat: recipient.seat,
    displayPlayerId,
    title,
    eyebrow,
    lines: lines.map(String).filter(Boolean),
  })
  privateResultUnlocked.value = false
  phasePulse.value += 1
}

function revealPrivateResult() { if (currentPrivateResult.value) { privateResultUnlocked.value = true; playCardSound(560); phasePulse.value += 1 } }
function confirmPrivateResult() {
  if (!currentPrivateResult.value) return
  privateResultUnlocked.value = false
  privateResults.value.shift()
  phasePulse.value += 1
  playCardSound(300)
  if (!privateResults.value.length && pendingDawnAfterResults.value) { pendingDawnAfterResults.value = false; speakDawn() }
}
function clearPrivateResults() { privateResults.value = []; privateResultUnlocked.value = false; pendingDawnAfterResults.value = false; shownBriefStepIds.clear() }

function resetAction() { selectedTargetId.value = ''; selectedTargetIds.value = []; actionChoice.value = ''; witchHeal.value = false }
function repeatGuide() { if (guide.value) speak(guide.value.phrase) }
function speakDawn() {
  const dead = game.value.players.filter((player: any) => !player.alive && player.eliminatedBy && !player.announced)
  const roleReveals = dead
    .filter((player: any) => player.rolePublic)
    .map((player: any) => `Le rôle de ${player.name} est révélé : ${ROLE_BY_ID[player.roleId]?.name || 'personnage inconnu'}.`)
  const lines = [dead.length ? `À l'aube, ${dead.map((player: any) => player.name).join(' et ')} ne répondent plus.` : 'À l’aube, tous les habitants répondent encore.', ...roleReveals, ...(game.value.dawnAnnouncements || [])]
  dead.forEach((player: any) => { player.announced = true })
  lastDawnAnnouncements.value = lines
  if (config.value.runMode !== 'manual') speak(lines.join(' '))
  if (lines.length > 1) notify(lines[1])
  phasePulse.value += 1
  playTransitionSound()
}

function openDiscussion() { beginDiscussion(game.value); phaseRemaining.value = config.value.debateSeconds; startTimer(); phasePulse.value += 1; if (config.value.runMode !== 'manual') speak('Le débat est ouvert. Observez, argumentez, doutez.') }
function openVote() { beginVote(game.value); phaseRemaining.value = config.value.voteSeconds; startTimer(); selectedTargetId.value = ''; phasePulse.value += 1; playTransitionSound() }
function openSecondVote() { beginSecondVote(game.value); phaseRemaining.value = config.value.voteSeconds; startTimer(); selectedTargetId.value = ''; phasePulse.value += 1; playTransitionSound() }
function startTimer() { window.clearInterval(phaseTimer); phaseTimer = window.setInterval(() => { if (!paused.value && phaseRemaining.value > 0) phaseRemaining.value -= 1 }, 1000) }
function confirmVote(abstain = false) {
  try {
    if (!currentVoter.value) return
    submitVote(game.value, currentVoter.value.id, abstain ? null : selectedTargetId.value)
    selectedTargetId.value = ''
    hostError.value = ''
    if (!currentVoter.value) { window.clearInterval(phaseTimer); resolveVote(game.value); phasePulse.value += 1; playTransitionSound() }
  } catch (error: any) { fail(error.message) }
}
function chooseDeathTarget(id: string) {
  try {
    const trigger = deathTrigger.value ? { ...deathTrigger.value } : null
    const actor = game.value?.players?.find((player: any) => player.id === trigger?.actorId)
    const target = game.value?.players?.find((player: any) => player.id === id)
    const inheritedRole = trigger?.kind === 'servant' ? ROLE_BY_ID[target?.roleId] : null
    resolveDeathTrigger(game.value, id)
    if (actor && target && trigger?.kind === 'servant') {
      queuePrivateResult({ recipient: actor, displayPlayerId: actor.id, title: 'Nouvelle identité', eyebrow: 'INFORMATION SECRÈTE', lines: [`Vous devenez secrètement ${inheritedRole?.name || 'le personnage choisi'}. ${inheritedRole?.power || ''}`] })
    }
    hostError.value = ''
    phasePulse.value += 1
  } catch (error: any) { fail(error.message) }
}
function validateDeathSelection() {
  try {
    resolveScapegoatVoters(game.value, selectedTargetIds.value)
    resetAction()
    hostError.value = ''
    phasePulse.value += 1
  } catch (error: any) { fail(error.message) }
}
function skipCurrentDeathTrigger() { skipDeathTrigger(game.value); phasePulse.value += 1 }
function electCaptain(id: string) { try { appointCaptain(game.value, id); notify('Le Capitaine est élu.') } catch (error: any) { fail(error.message) } }
function continueAfterVerdict() {
  finishVerdict(game.value)
  checkVictory(game.value)
  phasePulse.value += 1
}
function newRound() { clearPrivateResults(); lastDawnAnnouncements.value = []; game.value = null; screen.value = 'ready'; privateUnlocked.value = false; resetAction(); hostError.value = ''; phasePulse.value += 1 }

function handleBoardCard(player: any) {
  ensureAudio()
  if (currentPrivateResult.value && player.id === currentPrivateResult.value.displayPlayerId) {
    if (privateResultUnlocked.value) confirmPrivateResult()
    else revealPrivateResult()
    return
  }
  if (screen.value === 'reveal' && player.id === currentRevealPlayer.value?.id) {
    if (privateUnlocked.value) confirmRole()
    else unlockRole()
    return
  }
  if (screen.value !== 'game' || !selectableIds.value.has(player.id)) return
  if (game.value.phase === 'night') toggleTarget(player.id, ['lovers', 'charm'].includes(guide.value?.action))
  else if (game.value.phase === 'vote') toggleTarget(player.id)
  else if (game.value.phase === 'death-trigger') {
    if (deathTrigger.value?.kind === 'scapegoat') toggleTarget(player.id, true)
    else chooseDeathTarget(player.id)
  }
}

function handleCommand(command: any) {
  try {
    ensureAudio()
    const type = String(command?.type || '')
    if (type === 'start') startPreparedGame()
    else if (type === 'resume') resumeGame()
    else if (type === 'reveal-card') unlockRole()
    else if (type === 'confirm-reveal') confirmRole()
    else if (type === 'reveal-result') revealPrivateResult()
    else if (type === 'confirm-result') confirmPrivateResult()
    else if (type === 'begin-night') beginCurrentNight()
    else if (type === 'select-target') toggleTarget(String(command.playerId || ''), Boolean(command.multiple))
    else if (type === 'set-choice') actionChoice.value = String(command.choice || '')
    else if (type === 'toggle-heal') witchHeal.value = !witchHeal.value
    else if (type === 'validate-night') validateNightStep(false)
    else if (type === 'skip-night') validateNightStep(true)
    else if (type === 'repeat') repeatGuide()
    else if (type === 'toggle-pause') paused.value = !paused.value
    else if (type === 'open-discussion') openDiscussion()
    else if (type === 'open-vote') openVote()
    else if (type === 'second-vote') openSecondVote()
    else if (type === 'confirm-vote') confirmVote(false)
    else if (type === 'abstain-vote') confirmVote(true)
    else if (type === 'death-target') chooseDeathTarget(String(command.playerId || ''))
    else if (type === 'validate-death') validateDeathSelection()
    else if (type === 'skip-death') skipCurrentDeathTrigger()
    else if (type === 'elect-captain') electCaptain(String(command.playerId || ''))
    else if (type === 'continue-verdict') continueAfterVerdict()
    else if (type === 'new-round') newRound()
    else if (type === 'toggle-music') toggleAmbience()
    else if (type === 'set-volume') setAmbienceVolume(command.value)
  } catch (error: any) { fail(error.message || String(error)) }
}

function hostCopy() {
  const phase = game.value?.phase
  if (screen.value === 'ready') return {
    title: setupValidation.value.valid ? 'Le plateau est prêt' : 'Le plateau attend sa configuration',
    dialogue: setupValidation.value.valid ? 'Présentez les joueurs autour du plateau. Quand tout le monde est prêt, lancez la distribution depuis cette régie.' : setupValidation.value.errors[0] || 'Complétez les réglages de la partie.',
    expected: setupValidation.value.valid ? 'Lancer la distribution privée.' : 'Corriger la configuration.',
  }
  if (screen.value === 'reveal') return {
    title: `Carte de ${currentRevealPlayer.value?.name || 'joueur'}`,
    dialogue: `Confiez l’écran au siège ${currentRevealPlayer.value?.seat || ''}. Demandez aux autres joueurs de détourner le regard, puis laissez cette personne toucher sa carte.`,
    expected: privateUnlocked.value ? 'Demandez au joueur de mémoriser son personnage puis de refermer la carte.' : 'Le joueur touche sa carte sur le plateau.',
  }
  if (currentPrivateResult.value) return {
    title: `Résultat privé pour ${currentPrivateResult.value.recipientName}`,
    dialogue: `Confiez l’écran au siège ${currentPrivateResult.value.recipientSeat}. Les autres joueurs détournent le regard : le contenu du résultat restera uniquement sur le plateau.`,
    expected: privateResultUnlocked.value ? 'Le joueur lit son résultat puis touche de nouveau la carte pour le masquer.' : `Demandez à ${currentPrivateResult.value.recipientName} de toucher la carte illuminée.`,
  }
  if (screen.value === 'ended' || phase === 'ended') return {
    title: 'La partie est terminée', dialogue: game.value?.winnerLabel || 'Le village a rendu son verdict.', expected: 'Félicitez les gagnants ou préparez une nouvelle manche.',
  }
  if (phase === 'night-intro') return {
    title: 'Le village va s’endormir', dialogue: 'Annoncez : « La nuit tombe sur Thiercelieux. Tous les habitants ferment les yeux. »', expected: 'Vérifier que tout le monde a les yeux fermés, puis commencer la nuit.',
  }
  if (phase === 'night' && guide.value) return { title: guide.value.title, dialogue: `Annoncez : « ${guide.value.phrase} »`, expected: guide.value.expected }
  if (phase === 'death-trigger') return {
    title: 'Dernière volonté', dialogue: `${game.value?.players?.find((player: any) => player.id === deathTrigger.value?.actorId)?.name || 'Un habitant'} doit désigner ${deathTrigger.value?.kind === 'scapegoat' ? 'les personnes qui pourront voter demain' : 'une carte'}.`, expected: deathTrigger.value?.kind === 'scapegoat' ? 'Sélectionner au moins un votant puis valider la liste.' : 'Sélectionner la cible sur le plateau ou depuis la régie.',
  }
  if (phase === 'dawn') return {
    title: `Le village se réveille · Jour ${game.value?.day || 1}`, dialogue: `Annoncez : « Le jour se lève. Le village ouvre les yeux. » ${lastDawnAnnouncements.value.join(' ') || 'Révélez ensuite les disparitions visibles sur le plateau.'}`, expected: 'Respecter l’ordre : victimes, grognement de l’Ours, Spiritisme ou événement, puis ouvrir la discussion.',
  }
  if (phase === 'discussion') return {
    title: 'Le débat est ouvert', dialogue: 'Laissez les habitants accuser, se défendre et observer. Relancez avec : « Qui ment ? Qui protège la meute ? »', expected: 'Ouvrir le vote quand le débat est mûr.',
  }
  if (phase === 'vote') return {
    title: currentVoter.value ? `Vote de ${currentVoter.value.name}` : 'Tous les votes sont saisis', dialogue: currentVoter.value ? `Invitez ${currentVoter.value.name} à toucher la carte de son choix sur le plateau.` : 'Les votes sont prêts à être dépouillés.', expected: currentVoter.value ? 'Confirmer la carte sélectionnée ou enregistrer une abstention.' : 'Le verdict va apparaître.',
  }
  if (phase === 'verdict') return {
    title: 'Le verdict du village', dialogue: 'Laissez le plateau révéler le résultat. Annoncez calmement la décision du village.', expected: game.value?.flags?.secondVoteAvailable ? 'Le Juge Bègue peut maintenant déclencher son unique second vote sans débat.' : 'Continuer vers la nuit suivante.',
  }
  return { title: gamePhaseTitle.value, dialogue: 'Suivez le déroulé affiché dans la régie.', expected: 'Valider l’étape suivante.' }
}

function publishHostState() {
  if (!api?.publishThiercelieuxHostState) return
  const copy = hostCopy()
  const phase = game.value?.phase || screen.value
  const targets = screen.value === 'game' && !currentPrivateResult.value
    ? phase === 'night' ? guideTargets.value : phase === 'death-trigger' ? deathTargets.value : phase === 'vote' ? game.value.players.filter((player: any) => player.alive) : []
    : []
  const players = (game.value?.players || preparedPlayers.value).map((player: any, index: number) => ({
    id: player.id,
    name: player.name,
    seat: player.seat || index + 1,
    alive: player.alive !== false,
    selected: selectedIds.value.has(player.id),
    status: player.alive === false ? 'Éliminé' : game.value?.captainId === player.id ? 'Capitaine' : '',
  }))
  const state = {
    screen: screen.value,
    phase,
    phaseTitle: gamePhaseTitle.value,
    stepLabel: screen.value === 'reveal' ? `Distribution ${Number(game.value?.revealIndex || 0) + 1}/${game.value?.players?.length || 0}` : currentPrivateResult.value ? `Résultat privé · ${privateResults.value.length} à consulter` : phase === 'night' ? `Nuit ${game.value?.night || 1} · étape ${Number(game.value?.nightCursor || 0) + 1}/${game.value?.nightQueue?.length || 0}` : '',
    title: copy.title,
    dialogue: copy.dialogue,
    expected: copy.expected,
    privateAlert: currentPrivateResult.value ? '' : guide.value?.privateAlert || '',
    currentPlayerId: currentPrivateResult.value?.recipientId || currentRevealPlayer.value?.id || currentNightActor.value?.id || (phase === 'vote' ? currentVoter.value?.id : '') || '',
    currentPlayerName: currentPrivateResult.value?.recipientName || currentRevealPlayer.value?.name || currentNightActor.value?.name || (phase === 'vote' ? currentVoter.value?.name : '') || '',
    currentSeat: currentPrivateResult.value?.recipientSeat || currentRevealPlayer.value?.seat || currentNightActor.value?.seat || (phase === 'vote' ? currentVoter.value?.seat : 0) || 0,
    revealIndex: Number(game.value?.revealIndex || 0),
    revealTotal: Number(game.value?.players?.length || 0),
    revealUnlocked: privateUnlocked.value,
    resultPending: Boolean(currentPrivateResult.value),
    resultUnlocked: privateResultUnlocked.value,
    resultPlayerId: currentPrivateResult.value?.recipientId || '',
    resultPlayerName: currentPrivateResult.value?.recipientName || '',
    resultSeat: currentPrivateResult.value?.recipientSeat || 0,
    canStart: setupValidation.value.valid,
    hasSavedGame: Boolean(saved.value),
    paused: paused.value,
    audioEnabled: !ambienceMuted.value,
    ambienceVolume: config.value.ambienceVolume,
    remainingSeconds: screen.value === 'reveal' ? revealRemaining.value : phaseRemaining.value,
    currentVoterId: phase === 'vote' ? currentVoter.value?.id || '' : '',
    action: currentPrivateResult.value ? '' : guide.value?.action || '',
    multipleTargets: ['lovers', 'charm'].includes(guide.value?.action) || deathTrigger.value?.kind === 'scapegoat',
    requiresChoice: ['choose-camp', 'steal', 'actor', 'spiritism'].includes(guide.value?.action),
    choice: actionChoice.value,
    healSelected: witchHeal.value,
    canSkip: guide.value?.canSkip !== false,
    secondVoteAvailable: game.value?.flags?.secondVoteAvailable === true,
    players,
    availableTargets: targets.map((player: any) => ({ id: player.id, name: player.name, seat: player.seat, alive: player.alive !== false, selected: selectedIds.value.has(player.id), disabled: !selectableIds.value.has(player.id) })),
    winnerLabel: game.value?.winnerLabel || '',
    error: hostError.value,
    updatedAt: Date.now(),
  }
  void api.publishThiercelieuxHostState(state).catch(() => {})
}

function ensureAudio() { if (!ambienceMuted.value) startAmbience() }
function ambienceLevel() {
  return Math.max(0, Math.min(100, Number(config.value.ambienceVolume) || 0)) / 100
}
function ambienceGainValue() {
  return Math.max(0.0001, ambienceLevel() * 0.18)
}
function setAmbienceVolume(value: unknown) {
  const parsed = Number(value)
  config.value.ambienceVolume = Math.max(0, Math.min(100, Number.isFinite(parsed) ? Math.round(parsed) : 70))
  if (!ambienceMuted.value && !audioContext) startAmbience()
  if (audioContext && ambienceGain) {
    ambienceGain.gain.cancelScheduledValues(audioContext.currentTime)
    ambienceGain.gain.setTargetAtTime(ambienceGainValue(), audioContext.currentTime, 0.04)
  }
}
function handleVolumeInput(event: Event) {
  setAmbienceVolume((event.target as HTMLInputElement).value)
}
function startAmbience() {
  if (ambienceMuted.value || audioContext) return
  try {
    audioContext = new AudioContext()
    ambienceGain = audioContext.createGain()
    ambienceGain.gain.setValueAtTime(0.0001, audioContext.currentTime)
    ambienceGain.gain.exponentialRampToValueAtTime(ambienceGainValue(), audioContext.currentTime + 1.2)
    ambienceGain.connect(audioContext.destination)
    ;[55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator()
      const gain = audioContext!.createGain()
      const lfo = audioContext!.createOscillator()
      const lfoGain = audioContext!.createGain()
      oscillator.type = index === 1 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      gain.gain.value = index === 0 ? 0.58 : 0.24
      lfo.frequency.value = 0.035 + index * 0.018
      lfoGain.gain.value = index === 0 ? 0.14 : 0.065
      lfo.connect(lfoGain).connect(gain.gain)
      oscillator.connect(gain).connect(ambienceGain!)
      oscillator.start(); lfo.start()
      ambienceNodes.push(oscillator, gain, lfo, lfoGain)
    })
    ambienceTimer = window.setInterval(() => playChime(), 9000)
  } catch {}
}
function stopAmbience() {
  window.clearInterval(ambienceTimer)
  ambienceNodes.forEach((node: any) => { try { node.stop?.() } catch {}; try { node.disconnect?.() } catch {} })
  ambienceNodes = []
  void audioContext?.close().catch(() => {})
  audioContext = null
  ambienceGain = null
}
function toggleAmbience() { ambienceMuted.value = !ambienceMuted.value; config.value.audioEnabled = !ambienceMuted.value; if (ambienceMuted.value) stopAmbience(); else startAmbience() }
function tone(frequency: number, duration = 0.3, volume = 0.055, type: OscillatorType = 'sine') {
  if (ambienceMuted.value) return
  startAmbience()
  if (!audioContext) return
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration)
  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start(); oscillator.stop(audioContext.currentTime + duration + 0.03)
}
function playCardSound(frequency = 360) { tone(frequency, 0.22, 0.045, 'triangle') }
function playTransitionSound() { tone(164.81, 1.2, 0.04); window.setTimeout(() => tone(246.94, 1.1, 0.035), 160) }
function playChime() { tone(game.value?.phase === 'night' ? 174.61 : 261.63, 1.8, 0.018) }
function playHowl() {
  if (ambienceMuted.value) return
  startAmbience()
  if (!audioContext) return
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = 'sawtooth'
  oscillator.frequency.setValueAtTime(180, audioContext.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(68, audioContext.currentTime + 1.35)
  gain.gain.setValueAtTime(0.001, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + 0.1)
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.4)
  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start(); oscillator.stop(audioContext.currentTime + 1.45)
}
function speak(message: string) { if (ambienceMuted.value || !config.value.audioEnabled || !('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message); utterance.lang = 'fr-FR'; utterance.rate = 0.92; utterance.pitch = 0.86; window.speechSynthesis.speak(utterance) }
function notify(message: string) { toast.value = message; window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toast.value = '' }, 3200) }
function fail(message: string) { hostError.value = message; notify(message) }
function isEliminatedRoleVisible(player: any) { return player?.alive === false && player?.rolePublic === true }
function isCardRevealed(player: any) {
  if (currentPrivateResult.value) return player.id === currentPrivateResult.value.displayPlayerId && privateResultUnlocked.value
  if (screen.value === 'reveal') return player.id === currentRevealPlayer.value?.id && privateUnlocked.value
  return isEliminatedRoleVisible(player)
}
function cardRole(player: any) {
  if (screen.value === 'reveal' && player.id === currentRevealPlayer.value?.id && privateUnlocked.value) return currentPrivateView.value?.role || null
  if (!isEliminatedRoleVisible(player)) return null
  const eliminatedPlayer = game.value?.players?.find((candidate: any) => candidate.id === player.id)
  return eliminatedPlayer ? ROLE_BY_ID[eliminatedPlayer.roleId] || null : null
}
function cardCampName(player: any) {
  if (screen.value === 'reveal' && player.id === currentRevealPlayer.value?.id && privateUnlocked.value) return currentPrivateView.value?.camp?.name || ''
  const role = cardRole(player)
  return role?.camp === 'wolves' ? 'Loups-Garous' : role?.camp === 'solitary' ? 'Camp solitaire' : 'Villageois'
}
function roleGlyph(role: any) { if (role?.camp === 'wolves') return '◆'; if (role?.camp === 'solitary') return '✦'; if (role?.action === 'inspect-role') return '◉'; if (role?.action === 'witch') return '⚗'; return '◇' }
function knownPlayerNames(view: any) { return (view?.knownPlayers || []).map((known: any) => known.name).join(', ') }
</script>

<template>
  <main class="thiercelieux-table" :class="[`format-${config.orientation}`, `phase-${game?.phase || screen}`]" :style="{ '--scene': `url(${activeBackdrop})` }" @pointerdown.once="ensureAudio">
    <div class="night-sky" aria-hidden="true"><i class="moon"></i><i class="cloud cloud-a"></i><i class="cloud cloud-b"></i><i v-for="spark in 18" :key="spark" class="spark" :style="{ '--i': spark }"></i></div>
    <header class="table-header">
      <div class="table-brand"><span>◈</span><div><b>THIERCELIEUX</b><small>SHENPULSE</small></div></div>
      <div :key="phasePulse" class="phase-title"><small>{{ currentPrivateResult ? 'INFORMATION SECRÈTE' : screen === 'reveal' ? 'DISTRIBUTION PRIVÉE' : game?.phase === 'night' ? 'LA NUIT EST TOMBÉE' : 'LE VILLAGE' }}</small><strong>{{ gamePhaseTitle }}</strong></div>
      <div class="sound-controls">
        <label :class="{ muted: ambienceMuted }"><span>Ambiance</span><input type="range" min="0" max="100" step="1" :value="config.ambienceVolume" aria-label="Volume de l’ambiance" @pointerdown.stop @input.stop="handleVolumeInput"><output>{{ config.ambienceVolume }} %</output></label>
        <button class="sound-control" type="button" :aria-label="ambienceMuted ? 'Activer l’ambiance' : 'Couper l’ambiance'" @click.stop="toggleAmbience">{{ ambienceMuted ? '♩' : '♫' }}</button>
      </div>
    </header>

    <section class="moon-table" :class="{ 'private-mode': screen === 'reveal' || currentPrivateResult }">
      <div class="orbit orbit-outer" aria-hidden="true"></div><div class="orbit orbit-inner" aria-hidden="true"></div>
      <div :key="`${screen}-${game?.phase}-${phasePulse}`" class="table-core">
        <span class="core-sigil">{{ currentPrivateResult ? '◈' : screen === 'ended' ? '✦' : game?.phase === 'night' ? '◉' : '◇' }}</span>
        <strong>{{ currentPrivateResult ? currentPrivateResult.recipientName : screen === 'ready' ? `${preparedPlayers.length} cartes` : screen === 'reveal' ? currentRevealPlayer?.name : game?.phase === 'ended' ? game?.winnerLabel : gamePhaseTitle }}</strong>
        <small>{{ boardHint }}</small>
        <div v-if="phaseRemaining && ['discussion','vote'].includes(game?.phase)" class="public-clock">{{ String(Math.floor(phaseRemaining / 60)).padStart(2, '0') }}:{{ String(phaseRemaining % 60).padStart(2, '0') }}</div>
      </div>

      <div class="card-board" :class="`cards-${Math.max(3, boardPlayers.length)}`">
        <button v-for="(player, index) in boardPlayers" :key="player.id || index" type="button" class="board-card" :class="{ selectable: selectableIds.has(player.id), selected: selectedIds.has(player.id), eliminated: player.alive === false, current: currentPrivateResult ? player.id === currentPrivateResult.displayPlayerId : screen === 'reveal' && player.id === currentRevealPlayer?.id, revealed: isCardRevealed(player) }" :disabled="currentPrivateResult ? player.id !== currentPrivateResult.displayPlayerId : screen === 'reveal' ? player.id !== currentRevealPlayer?.id : !selectableIds.has(player.id)" @click="handleBoardCard(player)">
          <span class="card-shell">
            <span class="card-side card-back">
              <i class="seat-rune">{{ String(player.seat || index + 1).padStart(2, '0') }}</i>
              <span v-if="config.showPlayerAvatarOnCardBack && player.avatarUrl" class="card-back-avatar"><img :src="player.avatarUrl" :alt="`Photo TikTok de ${player.name}`"></span>
              <span v-else class="wolf-seal">◈</span>
              <strong>{{ player.name }}</strong>
              <small v-if="player.captain">CAPITAINE</small><small v-else-if="player.alive === false">ÉLIMINÉ</small><small v-else>CARTE SCELLÉE</small>
            </span>
            <span class="card-side card-front" :class="currentPrivateResult ? 'result-front' : `camp-${cardRole(player)?.camp || 'village'}`">
              <template v-if="currentPrivateResult && player.id === currentPrivateResult.displayPlayerId">
                <i class="role-glyph result-glyph">✦</i>
                <small>{{ currentPrivateResult.eyebrow }}</small>
                <strong>{{ currentPrivateResult.title }}</strong>
                <p v-for="(line, lineIndex) in currentPrivateResult.lines" :key="lineIndex">{{ line }}</p>
                <em>Toucher pour masquer et continuer</em>
              </template>
              <template v-else>
                <i class="role-glyph">{{ roleGlyph(cardRole(player) || {}) }}</i>
                <small>{{ cardCampName(player) }}</small>
                <strong>{{ cardRole(player)?.name }}</strong>
                <p>{{ cardRole(player)?.power }}</p>
                <em v-if="screen === 'reveal' && currentPrivateView?.knownPlayers?.length">Allié·e·s : {{ knownPlayerNames(currentPrivateView) }}</em>
              </template>
            </span>
          </span>
        </button>
      </div>
    </section>

    <footer class="table-footer"><span><i></i> Plateau connecté</span><b>{{ config.orientation === 'portrait' ? 'PORTRAIT' : 'PAYSAGE' }}</b><span>{{ aliveCount }} en jeu</span></footer>
    <Transition name="toast"><div v-if="toast" class="table-toast">{{ toast }}</div></Transition>
  </main>
</template>

<style scoped src="./styles/thiercelieux/index.generated.css"></style>
