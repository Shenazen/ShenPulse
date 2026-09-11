<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import landscapeUrl from '../../../../assets/games/catalog/thiercelieux-landscape.png?url'
import portraitUrl from '../../../../assets/games/catalog/thiercelieux-portrait.png?url'
import {
  MAX_ACTIVE_PLAYERS,
  MIN_ACTIVE_PLAYERS,
  ROLE_BY_ID,
  appointCaptain,
  availableTargets,
  beginDiscussion,
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
const deathTrigger = computed(() => game.value?.deathTriggers?.[0] || null)
const deathTargets = computed(() => game.value?.players?.filter((player: any) => {
  if (!player.alive || player.id === deathTrigger.value?.actorId) return false
  if (deathTrigger.value?.kind === 'colossus') return player.camp === 'wolves'
  if (deathTrigger.value?.kind === 'servant') return player.id === deathTrigger.value.victimId
  return true
}) || [])
const aliveVoters = computed(() => game.value?.players?.filter((player: any) => player.alive && !player.statuses.includes('no-vote')) || [])
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
  if (game.value.phase === 'night') return new Set(guideTargets.value.map((player: any) => player.id))
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
  [screen, game, privateUnlocked, privateResults, privateResultUnlocked, selectedTargetId, selectedTargetIds, actionChoice, witchHeal, paused, phaseRemaining, revealRemaining, hostError, ambienceMuted],
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

function beginCurrentNight() { clearPrivateResults(); startNight(game.value); resetAction(); phasePulse.value += 1; playHowl() }
function toggleTarget(id: string, multiple = false) {
  if (!multiple) selectedTargetId.value = selectedTargetId.value === id ? '' : id
  else selectedTargetIds.value = selectedTargetIds.value.includes(id) ? selectedTargetIds.value.filter((entry) => entry !== id) : [...selectedTargetIds.value, id].slice(-3)
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
    if (['lovers', 'charm', 'fox'].includes(action)) payload.targetIds = selectedTargetIds.value
    else if (action === 'choose-camp' || action === 'steal') payload.choice = actionChoice.value
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
  const newMessages = new Map<string, string[]>()
  for (const player of game.value.players) {
    const messages = (game.value.privateMessages?.[player.id] || []).slice(Number(messageCounts[player.id] || 0)).map((entry: any) => String(entry.message || '')).filter(Boolean)
    if (messages.length) newMessages.set(player.id, messages)
  }
  const actorMessages = newMessages.get(actor.id) || []
  const target = game.value.players.find((player: any) => player.id === (payload.targetId || payload.poisonTargetId))
  const targets = (payload.targetIds || []).map((id: string) => game.value.players.find((player: any) => player.id === id)).filter(Boolean)
  const displayPlayerId = ['inspect-role', 'monkey'].includes(step.action) && target ? target.id : actor.id
  queuePrivateResult({
    recipient: actor,
    displayPlayerId,
    title: `${ROLE_BY_ID[step.roleId]?.name || 'Personnage'} · résultat`,
    eyebrow: step.collective ? 'RÉSULTAT DE LA MEUTE' : 'RÉSULTAT DE VOTRE ACTION',
    lines: actorMessages.length ? actorMessages : nightResultFallback(step.action, actor, target, targets, payload),
  })
  newMessages.delete(actor.id)
  for (const [playerId, lines] of newMessages) {
    const recipient = game.value.players.find((player: any) => player.id === playerId)
    if (recipient) queuePrivateResult({ recipient, displayPlayerId: recipient.id, title: 'Message secret', eyebrow: 'INFORMATION PERSONNELLE', lines })
  }
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
  if (!step || shownBriefStepIds.has(step.id) || !['witch', 'infect'].includes(step.action)) return
  const actor = game.value?.players?.find((player: any) => player.id === step.actorId)
  const victim = game.value?.players?.find((player: any) => player.id === game.value?.wolfVictimId)
  const line = step.privateAlert || (victim ? `Victime de la meute : ${victim.name}.` : '')
  if (!actor || !line) return
  shownBriefStepIds.add(step.id)
  queuePrivateResult({ recipient: actor, displayPlayerId: actor.id, title: step.action === 'witch' ? 'Information de la Sorcière' : 'Information de l’Infect Père', eyebrow: 'AVANT VOTRE ACTION', lines: [line] })
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
  const line = dead.length ? `À l'aube, ${dead.map((player: any) => player.name).join(' et ')} ne répondent plus.` : 'À l’aube, tous les habitants répondent encore.'
  dead.forEach((player: any) => { player.announced = true })
  if (config.value.runMode !== 'manual') speak(line)
  phasePulse.value += 1
  playTransitionSound()
}

function openDiscussion() { beginDiscussion(game.value); phaseRemaining.value = config.value.debateSeconds; startTimer(); phasePulse.value += 1; if (config.value.runMode !== 'manual') speak('Le débat est ouvert. Observez, argumentez, doutez.') }
function openVote() { beginVote(game.value); phaseRemaining.value = config.value.voteSeconds; startTimer(); selectedTargetId.value = ''; phasePulse.value += 1; playTransitionSound() }
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
    if (actor && target && trigger) {
      const copy: Record<string, { title: string, line: string }> = {
        hunter: { title: 'Dernier tir du Chasseur', line: `${target.name} a été touché par votre dernier tir.` },
        colossus: { title: 'Dernière force du Colosse', line: `${target.name} a été emporté·e avec vous.` },
        'captain-successor': { title: 'Succession du Capitaine', line: `${target.name} devient le nouveau Capitaine.` },
        servant: { title: 'Nouvelle identité', line: `Vous devenez secrètement ${inheritedRole?.name || 'le personnage choisi'}. ${inheritedRole?.power || ''}` },
      }
      const result = copy[trigger.kind]
      if (result) queuePrivateResult({ recipient: actor, displayPlayerId: trigger.kind === 'servant' ? actor.id : target.id, title: result.title, eyebrow: 'RÉSULTAT DE VOTRE ACTION', lines: [result.line] })
    }
    hostError.value = ''
    phasePulse.value += 1
  } catch (error: any) { fail(error.message) }
}
function skipCurrentDeathTrigger() { skipDeathTrigger(game.value); phasePulse.value += 1 }
function electCaptain(id: string) { try { appointCaptain(game.value, id); notify('Le Capitaine est élu.') } catch (error: any) { fail(error.message) } }
function continueAfterVerdict() {
  const messageCounts = Object.fromEntries(game.value.players.map((player: any) => [player.id, (game.value.privateMessages?.[player.id] || []).length]))
  finishVerdict(game.value)
  checkVictory(game.value)
  for (const player of game.value.players) {
    const lines = (game.value.privateMessages?.[player.id] || []).slice(Number(messageCounts[player.id] || 0)).map((entry: any) => String(entry.message || '')).filter(Boolean)
    if (lines.length) queuePrivateResult({ recipient: player, displayPlayerId: player.id, title: 'Votre personnage évolue', eyebrow: 'INFORMATION PERSONNELLE', lines })
  }
  phasePulse.value += 1
}
function newRound() { clearPrivateResults(); game.value = null; screen.value = 'ready'; privateUnlocked.value = false; resetAction(); hostError.value = ''; phasePulse.value += 1 }

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
  if (game.value.phase === 'night') toggleTarget(player.id, ['lovers', 'charm', 'fox'].includes(guide.value?.action))
  else if (game.value.phase === 'vote') toggleTarget(player.id)
  else if (game.value.phase === 'death-trigger') chooseDeathTarget(player.id)
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
    else if (type === 'confirm-vote') confirmVote(false)
    else if (type === 'abstain-vote') confirmVote(true)
    else if (type === 'death-target') chooseDeathTarget(String(command.playerId || ''))
    else if (type === 'skip-death') skipCurrentDeathTrigger()
    else if (type === 'elect-captain') electCaptain(String(command.playerId || ''))
    else if (type === 'continue-verdict') continueAfterVerdict()
    else if (type === 'new-round') newRound()
    else if (type === 'toggle-music') toggleAmbience()
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
    title: 'Dernière volonté', dialogue: `${game.value?.players?.find((player: any) => player.id === deathTrigger.value?.actorId)?.name || 'Un habitant'} doit désigner une carte.`, expected: 'Sélectionner la cible sur le plateau ou depuis la régie.',
  }
  if (phase === 'dawn') return {
    title: `Le village se réveille · Jour ${game.value?.day || 1}`, dialogue: 'Annoncez : « Le jour se lève. Le village ouvre les yeux. » Révélez ensuite les disparitions visibles sur le plateau.', expected: 'Ouvrir la discussion lorsque les annonces sont terminées.',
  }
  if (phase === 'discussion') return {
    title: 'Le débat est ouvert', dialogue: 'Laissez les habitants accuser, se défendre et observer. Relancez avec : « Qui ment ? Qui protège la meute ? »', expected: 'Ouvrir le vote quand le débat est mûr.',
  }
  if (phase === 'vote') return {
    title: currentVoter.value ? `Vote de ${currentVoter.value.name}` : 'Tous les votes sont saisis', dialogue: currentVoter.value ? `Invitez ${currentVoter.value.name} à toucher la carte de son choix sur le plateau.` : 'Les votes sont prêts à être dépouillés.', expected: currentVoter.value ? 'Confirmer la carte sélectionnée ou enregistrer une abstention.' : 'Le verdict va apparaître.',
  }
  if (phase === 'verdict') return {
    title: 'Le verdict du village', dialogue: 'Laissez le plateau révéler le résultat. Annoncez calmement la décision du village.', expected: 'Continuer vers la nuit suivante.',
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
    remainingSeconds: screen.value === 'reveal' ? revealRemaining.value : phaseRemaining.value,
    currentVoterId: phase === 'vote' ? currentVoter.value?.id || '' : '',
    action: currentPrivateResult.value ? '' : guide.value?.action || '',
    multipleTargets: ['lovers', 'charm', 'fox'].includes(guide.value?.action),
    requiresChoice: ['choose-camp', 'steal'].includes(guide.value?.action),
    choice: actionChoice.value,
    healSelected: witchHeal.value,
    canSkip: guide.value?.canSkip !== false,
    players,
    availableTargets: targets.map((player: any) => ({ id: player.id, name: player.name, seat: player.seat, alive: player.alive !== false, selected: selectedIds.value.has(player.id) })),
    winnerLabel: game.value?.winnerLabel || '',
    error: hostError.value,
    updatedAt: Date.now(),
  }
  void api.publishThiercelieuxHostState(state).catch(() => {})
}

function ensureAudio() { if (!ambienceMuted.value) startAmbience() }
function startAmbience() {
  if (ambienceMuted.value || audioContext) return
  try {
    audioContext = new AudioContext()
    ambienceGain = audioContext.createGain()
    ambienceGain.gain.setValueAtTime(0.0001, audioContext.currentTime)
    ambienceGain.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 1.8)
    ambienceGain.connect(audioContext.destination)
    ;[55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator()
      const gain = audioContext!.createGain()
      const lfo = audioContext!.createOscillator()
      const lfoGain = audioContext!.createGain()
      oscillator.type = index === 1 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      gain.gain.value = index === 0 ? 0.5 : 0.18
      lfo.frequency.value = 0.035 + index * 0.018
      lfoGain.gain.value = index === 0 ? 0.12 : 0.05
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
function toggleAmbience() { ambienceMuted.value = !ambienceMuted.value; if (ambienceMuted.value) stopAmbience(); else startAmbience() }
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
function roleGlyph(role: any) { if (role?.camp === 'wolves') return '◆'; if (role?.camp === 'solitary') return '✦'; if (role?.action === 'inspect-role') return '◉'; if (role?.action === 'witch') return '⚗'; return '◇' }
function knownPlayerNames(view: any) { return (view?.knownPlayers || []).map((known: any) => known.name).join(', ') }
</script>

<template>
  <main class="thiercelieux-table" :class="[`format-${config.orientation}`, `phase-${game?.phase || screen}`]" :style="{ '--scene': `url(${activeBackdrop})` }" @pointerdown.once="ensureAudio">
    <div class="night-sky" aria-hidden="true"><i class="moon"></i><i class="cloud cloud-a"></i><i class="cloud cloud-b"></i><i v-for="spark in 18" :key="spark" class="spark" :style="{ '--i': spark }"></i></div>
    <header class="table-header">
      <div class="table-brand"><span>◈</span><div><b>THIERCELIEUX</b><small>SHENPULSE</small></div></div>
      <div :key="phasePulse" class="phase-title"><small>{{ currentPrivateResult ? 'INFORMATION SECRÈTE' : screen === 'reveal' ? 'DISTRIBUTION PRIVÉE' : game?.phase === 'night' ? 'LA NUIT EST TOMBÉE' : 'LE VILLAGE' }}</small><strong>{{ gamePhaseTitle }}</strong></div>
      <button class="sound-control" type="button" :aria-label="ambienceMuted ? 'Activer l’ambiance' : 'Couper l’ambiance'" @click.stop="toggleAmbience">{{ ambienceMuted ? '♩' : '♫' }}</button>
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
        <button v-for="(player, index) in boardPlayers" :key="player.id || index" type="button" class="board-card" :class="{ selectable: selectableIds.has(player.id), selected: selectedIds.has(player.id), eliminated: player.alive === false, current: currentPrivateResult ? player.id === currentPrivateResult.displayPlayerId : screen === 'reveal' && player.id === currentRevealPlayer?.id, revealed: currentPrivateResult ? player.id === currentPrivateResult.displayPlayerId && privateResultUnlocked : screen === 'reveal' && player.id === currentRevealPlayer?.id && privateUnlocked }" :disabled="currentPrivateResult ? player.id !== currentPrivateResult.displayPlayerId : screen === 'reveal' ? player.id !== currentRevealPlayer?.id : !selectableIds.has(player.id)" @click="handleBoardCard(player)">
          <span class="card-shell">
            <span class="card-side card-back">
              <i class="seat-rune">{{ String(player.seat || index + 1).padStart(2, '0') }}</i>
              <span class="wolf-seal">◈</span>
              <strong>{{ player.name }}</strong>
              <small v-if="player.captain">CAPITAINE</small><small v-else-if="player.alive === false">ÉLIMINÉ</small><small v-else>CARTE SCELLÉE</small>
            </span>
            <span class="card-side card-front" :class="currentPrivateResult ? 'result-front' : `camp-${currentPrivateView?.role?.camp || 'village'}`">
              <template v-if="currentPrivateResult && player.id === currentPrivateResult.displayPlayerId">
                <i class="role-glyph result-glyph">✦</i>
                <small>{{ currentPrivateResult.eyebrow }}</small>
                <strong>{{ currentPrivateResult.title }}</strong>
                <p v-for="(line, lineIndex) in currentPrivateResult.lines" :key="lineIndex">{{ line }}</p>
                <em>Toucher pour masquer et continuer</em>
              </template>
              <template v-else>
                <i class="role-glyph">{{ roleGlyph(currentPrivateView?.role || {}) }}</i>
                <small>{{ currentPrivateView?.camp?.name }}</small>
                <strong>{{ currentPrivateView?.role?.name }}</strong>
                <p>{{ currentPrivateView?.role?.power }}</p>
                <em v-if="currentPrivateView?.knownPlayers?.length">Allié·e·s : {{ knownPlayerNames(currentPrivateView) }}</em>
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

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
.format-landscape{width:100%}
*{box-sizing:border-box}.thiercelieux-table{--gold:#d8b875;--blood:#be3446;position:relative;width:100vw;min-height:100vh;overflow:hidden;background:#05070c;color:#f5efe7;font-family:Inter,system-ui,sans-serif;isolation:isolate}.thiercelieux-table:before{content:"";position:absolute;inset:0;z-index:-3;background:linear-gradient(180deg,rgba(4,6,12,.38),rgba(3,5,10,.86)),var(--scene) center/cover no-repeat;transform:scale(1.03);animation:sceneBreath 15s ease-in-out infinite alternate}.thiercelieux-table:after{content:"";position:absolute;inset:0;z-index:20;pointer-events:none;box-shadow:inset 0 0 150px 45px #020309}.night-sky{position:absolute;inset:0;z-index:-2;overflow:hidden}.moon{position:absolute;width:min(20vw,220px);aspect-ratio:1;border-radius:50%;right:8%;top:8%;background:radial-gradient(circle at 38% 35%,#fff9dd 0 4%,#d8d3c3 35%,#817f82 66%,#30333c 69%);box-shadow:0 0 55px rgba(209,219,232,.22);opacity:.28;animation:moonGlow 7s ease-in-out infinite}.phase-night .moon,.phase-night-intro .moon{opacity:.55;box-shadow:0 0 90px rgba(172,194,232,.38)}.cloud{position:absolute;width:65vw;height:18vh;border-radius:50%;background:radial-gradient(ellipse,rgba(121,137,155,.15),transparent 68%);filter:blur(20px);animation:cloudDrift 24s linear infinite}.cloud-a{left:-50vw;top:18%}.cloud-b{left:-65vw;top:60%;animation-duration:34s;animation-delay:-12s}.spark{position:absolute;left:calc(4% + var(--i)*5%);top:calc(8% + var(--i)*3.8%);width:2px;height:2px;border-radius:50%;background:#f5dfad;box-shadow:0 0 9px #e9c980;opacity:.2;animation:sparkle calc(2.4s + var(--i)*.11s) ease-in-out infinite}.table-header{height:92px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:18px clamp(22px,4vw,64px);border-bottom:1px solid rgba(216,184,117,.22);background:linear-gradient(180deg,rgba(4,6,11,.9),rgba(4,6,11,.45));backdrop-filter:blur(16px)}.table-brand{display:flex;align-items:center;gap:12px}.table-brand>span{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--gold);transform:rotate(45deg);color:var(--blood);font-size:19px}.table-brand b,.table-brand small{display:block;font-family:Cinzel,serif;letter-spacing:.15em}.table-brand b{font-size:15px}.table-brand small{margin-top:3px;color:#777d89;font-size:9px}.phase-title{text-align:center;animation:phaseReveal .85s both}.phase-title small{display:block;color:var(--gold);font-size:9px;font-weight:700;letter-spacing:.25em}.phase-title strong{display:block;margin-top:5px;font:600 clamp(18px,2.5vw,28px) Cinzel,serif}.sound-control{justify-self:end;width:42px;height:42px;border:1px solid rgba(216,184,117,.35);border-radius:50%;background:rgba(10,13,21,.72);color:var(--gold);font-size:19px;cursor:pointer;transition:.25s}.sound-control:hover{background:rgba(216,184,117,.12);transform:scale(1.06)}.moon-table{position:relative;width:min(1120px,94vw);height:calc(100vh - 144px);min-height:560px;margin:0 auto;display:grid;place-items:center}.moon-table:before{content:"";position:absolute;width:min(74vw,780px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(20,26,37,.92) 0 47%,rgba(9,12,19,.96) 48% 64%,rgba(216,184,117,.14) 64.3% 64.7%,rgba(5,7,12,.92) 65%);box-shadow:0 35px 90px #000,0 0 60px rgba(190,52,70,.08),inset 0 0 80px #020308;transform:perspective(850px) rotateX(55deg) translateY(8%)}.orbit{position:absolute;z-index:1;width:min(67vw,710px);aspect-ratio:1;border-radius:50%;border:1px dashed rgba(216,184,117,.24);pointer-events:none}.orbit-outer{animation:orbit 80s linear infinite}.orbit-inner{width:min(45vw,470px);border-style:solid;border-color:rgba(190,52,70,.16);animation:orbit 48s linear infinite reverse}.table-core{position:absolute;z-index:5;display:flex;flex-direction:column;align-items:center;width:min(310px,28vw);text-align:center;animation:coreArrival .7s cubic-bezier(.2,.8,.2,1) both}.core-sigil{display:grid;place-items:center;width:72px;height:72px;border:1px solid var(--gold);border-radius:50%;background:rgba(7,10,16,.9);box-shadow:0 0 32px rgba(216,184,117,.16),inset 0 0 18px rgba(216,184,117,.09);color:var(--blood);font:28px Cinzel,serif}.table-core>strong{max-width:310px;margin-top:14px;font:600 clamp(17px,2vw,27px)/1.2 Cinzel,serif}.table-core>small{margin-top:8px;color:#9399a4;font-size:12px;letter-spacing:.08em}.public-clock{margin-top:11px;color:var(--gold);font:600 21px Cinzel,serif;letter-spacing:.1em}.card-board{position:absolute;inset:0;z-index:7;display:grid;grid-template-columns:repeat(4,minmax(135px,1fr));grid-template-rows:repeat(2,minmax(190px,1fr));gap:clamp(36px,5vh,76px) clamp(56px,7vw,110px);align-content:center;padding:clamp(30px,5vh,72px) clamp(10px,2vw,30px);pointer-events:none}.board-card{position:relative;justify-self:center;width:min(150px,13vw);min-width:116px;aspect-ratio:.68;padding:0;border:0;background:none;color:inherit;perspective:1000px;pointer-events:auto;cursor:default;filter:drop-shadow(0 15px 18px rgba(0,0,0,.62));transition:transform .35s,filter .35s,opacity .55s}.board-card:nth-child(n+5){grid-row:2}.board-card:disabled{opacity:1}.board-card.selectable,.board-card.current{cursor:pointer}.board-card.selectable:hover,.board-card.current:hover{transform:translateY(-12px) scale(1.035);filter:drop-shadow(0 20px 24px rgba(0,0,0,.72)) drop-shadow(0 0 12px rgba(216,184,117,.32))}.board-card.selected{transform:translateY(-14px) scale(1.055);filter:drop-shadow(0 20px 25px rgba(0,0,0,.7)) drop-shadow(0 0 19px rgba(190,52,70,.7));animation:selectedPulse 1.25s ease-in-out infinite}.board-card.eliminated{opacity:.34;filter:grayscale(1) drop-shadow(0 8px 10px #000);transform:rotate(4deg) translateY(12px)}.board-card.current{z-index:12;animation:currentCard 1.8s ease-in-out infinite}.card-shell{position:absolute;inset:0;display:block;transform-style:preserve-3d;transition:transform .8s cubic-bezier(.2,.75,.22,1)}.board-card.revealed .card-shell{transform:rotateY(180deg)}.card-side{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15px;border:1px solid rgba(216,184,117,.72);border-radius:11px;backface-visibility:hidden;overflow:hidden}.card-side:before{content:"";position:absolute;inset:8px;border:1px solid rgba(216,184,117,.18);border-radius:7px;pointer-events:none}.card-back{background:linear-gradient(145deg,rgba(23,28,40,.97),rgba(6,8,14,.99)),repeating-radial-gradient(circle,#151a26 0 2px,#090c13 3px 8px)}.seat-rune{position:absolute;left:13px;top:11px;color:var(--gold);font:600 11px Cinzel,serif}.wolf-seal{display:grid;place-items:center;width:54px;height:54px;border:1px solid rgba(216,184,117,.55);transform:rotate(45deg);color:#ece7df;font:26px Cinzel,serif;box-shadow:inset 0 0 18px rgba(216,184,117,.09)}.card-back strong{max-width:100%;margin-top:23px;overflow:hidden;text-overflow:ellipsis;color:#f0e9df;font:600 clamp(12px,1.15vw,16px) Cinzel,serif;white-space:nowrap}.card-back small{margin-top:7px;color:#9d8558;font-size:8px;font-weight:700;letter-spacing:.17em}.card-front{transform:rotateY(180deg);background:linear-gradient(155deg,#171c28,#070a11);text-align:center}.card-front.camp-wolves{background:linear-gradient(155deg,#27141a,#08090e)}.role-glyph{color:var(--gold);font:38px Cinzel,serif}.card-front>small{margin-top:8px;color:var(--gold);font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.card-front>strong{margin-top:7px;font:600 clamp(16px,1.65vw,23px)/1.1 Cinzel,serif}.card-front>p{margin:12px 0 0;color:#d5d2ce;font-size:clamp(12px,1vw,15px);line-height:1.45}.card-front>em{margin-top:10px;color:#efce86;font-size:11px;font-style:normal;line-height:1.35}.table-footer{position:absolute;left:0;right:0;bottom:0;height:52px;display:flex;align-items:center;justify-content:center;gap:28px;border-top:1px solid rgba(216,184,117,.16);background:rgba(3,5,9,.64);color:#747b88;font-size:10px;letter-spacing:.12em}.table-footer span:first-child{display:flex;align-items:center;gap:7px}.table-footer i{width:6px;height:6px;border-radius:50%;background:#73d8b5;box-shadow:0 0 10px #73d8b5}.table-footer b{color:var(--gold);font-size:9px}.table-toast{position:fixed;z-index:60;left:50%;bottom:70px;transform:translateX(-50%);max-width:min(520px,88vw);padding:13px 20px;border:1px solid rgba(216,184,117,.36);border-radius:8px;background:rgba(9,12,18,.94);box-shadow:0 18px 55px #000;color:#f3eadc;font-size:14px;text-align:center}.toast-enter-active,.toast-leave-active{transition:.25s}.toast-enter-from,.toast-leave-to{opacity:0;transform:translate(-50%,12px)}
.result-front{padding:14px 12px;background:radial-gradient(circle at 50% 20%,#2a2630,#0a0d15 72%);box-shadow:inset 0 0 34px rgba(216,184,117,.12)}.result-front .result-glyph{font-size:34px;text-shadow:0 0 18px rgba(216,184,117,.55)}.result-front>small{font-size:10px;line-height:1.3}.result-front>strong{font-size:clamp(17px,1.5vw,22px);line-height:1.18}.result-front>p{margin-top:10px;font-size:clamp(14px,1.2vw,18px);font-weight:600;line-height:1.42}.result-front>em{font-size:11px}.private-mode .board-card:not(.current){opacity:.12;filter:grayscale(1) blur(1px);transform:scale(.82)}.private-mode .board-card.current{transform:scale(1.72);filter:drop-shadow(0 25px 32px rgba(0,0,0,.78)) drop-shadow(0 0 34px rgba(216,184,117,.58));animation:privateCard 2s ease-in-out infinite}.format-portrait{max-width:720px;margin:auto}.format-portrait .table-header{height:88px;padding:15px 20px}.format-portrait .table-brand div{display:none}.format-portrait .phase-title strong{font-size:20px}.format-portrait .moon-table{width:100%;height:calc(100vh - 140px);min-height:680px}.format-portrait .moon-table:before{width:680px;opacity:.72}.format-portrait .orbit{width:610px}.format-portrait .orbit-inner{width:390px}.format-portrait .table-core{width:200px}.format-portrait .table-core>strong{font-size:19px}.format-portrait .table-core>small{font-size:11px}.format-portrait .card-board{grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(4,1fr);gap:14px 210px;padding:22px 34px}.format-portrait .board-card{width:132px;min-width:0;max-height:190px}.format-portrait .board-card:nth-child(n){grid-row:auto}.format-portrait .card-back strong{font-size:13px}.format-portrait .card-front>strong{font-size:17px}.format-portrait .card-front>p{font-size:12px}.format-portrait .card-front>em{font-size:10px}.format-portrait .result-front>strong{font-size:18px}.format-portrait .result-front>p{font-size:14px}.format-portrait .core-sigil{width:60px;height:60px}.format-portrait .table-footer{font-size:9px;gap:15px}
.private-mode .board-card.current{opacity:1}
@media(max-width:900px) and (orientation:landscape){.table-header{height:76px;padding:12px 24px}.moon-table{height:calc(100vh - 120px);min-height:520px}.card-board{gap:38px 48px;padding:36px 15px}.board-card{width:120px}.card-front>p{font-size:11px}.card-front>em{font-size:9px}.result-front>p{font-size:14px}.result-front>strong{font-size:17px}}
@keyframes sceneBreath{to{transform:scale(1.08)}}@keyframes moonGlow{50%{filter:brightness(1.22);transform:scale(1.025)}}@keyframes cloudDrift{to{transform:translateX(180vw)}}@keyframes sparkle{50%{opacity:.8;transform:scale(2)}}@keyframes orbit{to{transform:rotate(360deg)}}@keyframes phaseReveal{from{opacity:0;transform:translateY(-12px);filter:blur(7px)}}@keyframes coreArrival{from{opacity:0;transform:scale(.65);filter:blur(10px)}}@keyframes selectedPulse{50%{filter:drop-shadow(0 22px 25px rgba(0,0,0,.72)) drop-shadow(0 0 32px rgba(190,52,70,.9))}}@keyframes currentCard{50%{transform:translateY(-8px);filter:drop-shadow(0 23px 28px rgba(0,0,0,.72)) drop-shadow(0 0 18px rgba(216,184,117,.5))}}@keyframes privateCard{50%{transform:scale(1.67) translateY(-3px);filter:drop-shadow(0 28px 38px rgba(0,0,0,.8)) drop-shadow(0 0 34px rgba(216,184,117,.58))}}
</style>
