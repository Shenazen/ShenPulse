export type KeyboardShortcutFromEventOptions = {
  requireModifier?: boolean
}

const modifierOrder = ['CTRL', 'ALT', 'SHIFT', 'WIN'] as const
const layoutAliasKeys: Record<string, string[]> = {
  A: ['Q'],
  Q: ['A'],
  W: ['Z'],
  Z: ['W'],
}

export function normalizeKeyboardShortcut(value: unknown) {
  const parts = String(value || '')
    .trim()
    .replace(/\s*\+\s*/g, '+')
    .replace(/\s+/g, '+')
    .split('+')
    .filter(Boolean)

  if (!parts.length) return ''

  const modifiers: string[] = []
  let key = ''

  for (const part of parts) {
    const upper = part.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (upper === 'CONTROL' || upper === 'CTRL') pushUnique(modifiers, 'CTRL')
    else if (upper === 'ALT' || upper === 'OPTION') pushUnique(modifiers, 'ALT')
    else if (upper === 'SHIFT') pushUnique(modifiers, 'SHIFT')
    else if (upper === 'META' || upper === 'CMD' || upper === 'COMMAND' || upper === 'WIN' || upper === 'WINDOWS') pushUnique(modifiers, 'WIN')
    else if (upper === 'ARROWUP' || upper === 'FLECHEHAUT' || upper === 'UP') key = 'UP'
    else if (upper === 'ARROWDOWN' || upper === 'FLECHEBAS' || upper === 'DOWN') key = 'DOWN'
    else if (upper === 'ARROWLEFT' || upper === 'FLECHEGAUCHE' || upper === 'LEFT') key = 'LEFT'
    else if (upper === 'ARROWRIGHT' || upper === 'FLECHEDROITE' || upper === 'RIGHT') key = 'RIGHT'
    else if (upper === 'ESCAPE' || upper === 'ESC') key = 'ESC'
    else if (upper === 'ENTER' || upper === 'RETURN') key = 'ENTER'
    else if (upper === 'SPACE' || upper === 'ESPACE') key = 'SPACE'
    else if (upper === 'DELETE' || upper === 'DEL') key = 'DELETE'
    else if (upper === 'BACKSPACE' || upper === 'BKSP') key = 'BACKSPACE'
    else if (upper === 'PAGEUP' || upper === 'PGUP') key = 'PAGEUP'
    else if (upper === 'PAGEDOWN' || upper === 'PGDN') key = 'PAGEDOWN'
    else if (upper === 'NUMPADADD') key = 'NUMPADADD'
    else if (upper === 'NUMPADSUBTRACT') key = 'NUMPADSUBTRACT'
    else key = part.length === 1 ? part.toUpperCase() : part.toUpperCase()
  }

  return [...modifierOrder.filter((modifier) => modifiers.includes(modifier)), key]
    .filter(Boolean)
    .join('+')
}

export function keyboardShortcutFromEvent(
  event: KeyboardEvent,
  options: KeyboardShortcutFromEventOptions = {},
) {
  const key = keyboardShortcutKeyFromEvent(event)
  if (!key) return ''

  const parts: string[] = []
  if (event.ctrlKey) parts.push('CTRL')
  if (event.altKey) parts.push('ALT')
  if (event.shiftKey) parts.push('SHIFT')
  if (event.metaKey) parts.push('WIN')
  if (options.requireModifier && !parts.length) return ''

  parts.push(key)
  return normalizeKeyboardShortcut(parts.join('+'))
}

export function keyboardShortcutKeyFromEvent(event: KeyboardEvent) {
  if (['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) return ''
  if (/^[a-z]$/i.test(event.key)) return event.key.toUpperCase()
  if (/^Digit\d$/.test(event.code)) return event.code.replace('Digit', '')
  if (/^Numpad\d$/.test(event.code)) return `NUMPAD${event.code.replace('Numpad', '')}`
  if (event.code === 'NumpadAdd') return 'NUMPADADD'
  if (event.code === 'NumpadSubtract') return 'NUMPADSUBTRACT'
  if (event.key === ' ') return 'SPACE'
  if (event.key.startsWith('Arrow')) return event.key.replace('Arrow', '').toUpperCase()
  return event.key.length === 1 ? event.key.toUpperCase() : event.key.toUpperCase()
}

export function normalizeKeyboardShortcutList(value: unknown, fallback = '', limit = Number.POSITIVE_INFINITY) {
  const shortcuts = splitKeyboardShortcutList(value || fallback)
  const fallbackShortcuts = splitKeyboardShortcutList(fallback)
  return (shortcuts.length ? shortcuts : fallbackShortcuts).slice(0, limit)
}

export function formatKeyboardShortcutList(value: unknown, fallback = '', limit = Number.POSITIVE_INFINITY) {
  return normalizeKeyboardShortcutList(value, fallback, limit).join(', ')
}

export function keyboardShortcutMatches(activeShortcut: unknown, configuredShortcuts: unknown, fallbackShortcuts = '') {
  if (keyboardShortcutExactlyMatches(activeShortcut, configuredShortcuts, fallbackShortcuts)) return true

  const activeVariants = keyboardShortcutVariants(activeShortcut)
  if (!activeVariants.length) return false
  const configuredVariants = normalizeKeyboardShortcutList(configuredShortcuts, fallbackShortcuts)
    .flatMap((shortcut) => keyboardShortcutVariants(shortcut))
  return configuredVariants.some((shortcut) => activeVariants.includes(shortcut))
}

export function keyboardShortcutExactlyMatches(activeShortcut: unknown, configuredShortcuts: unknown, fallbackShortcuts = '') {
  const active = normalizeKeyboardShortcut(activeShortcut)
  if (!active) return false
  return normalizeKeyboardShortcutList(configuredShortcuts, fallbackShortcuts).includes(active)
}

export function keyboardShortcutVariants(value: unknown) {
  const shortcut = normalizeKeyboardShortcut(value)
  if (!shortcut) return []

  const parts = shortcut.split('+').filter(Boolean)
  const key = parts[parts.length - 1] || ''
  const modifiers = parts.slice(0, -1)
  const variants = new Set([shortcut])

  for (const alias of layoutAliasKeys[key] || []) {
    variants.add(normalizeKeyboardShortcut([...modifiers, alias].join('+')))
  }

  return Array.from(variants).filter(Boolean)
}

export function isTextSafeGlobalShortcut(value: unknown) {
  const shortcut = normalizeKeyboardShortcut(value)
  if (!shortcut) return false

  const parts = shortcut.split('+').filter(Boolean)
  const key = parts[parts.length - 1] || ''
  const modifiers = parts.slice(0, -1)
  const hasCtrl = modifiers.includes('CTRL')
  const hasAlt = modifiers.includes('ALT')
  const hasShift = modifiers.includes('SHIFT')
  const hasWin = modifiers.includes('WIN')
  const hasSystemModifier = hasCtrl || hasAlt || hasWin

  if (!key) return false
  if (isFunctionShortcutKey(key)) return true
  if (!hasSystemModifier) return false
  if (hasShift && !hasCtrl && !hasAlt && !hasWin) return false
  if (isPlainTextEditingKey(key) && !hasAlt && !hasWin) return false
  if ((hasCtrl || hasWin) && isReservedTextShortcutKey(key)) return false
  if (hasCtrl && hasAlt && isPrintableShortcutKey(key)) return false
  if (hasAlt && key === 'SPACE') return false

  return true
}

export function textSafeGlobalShortcutVariants(value: unknown) {
  return keyboardShortcutVariants(value).filter(isTextSafeGlobalShortcut)
}

export function isEditableKeyboardTarget(target: EventTarget | null, extraSelector = '') {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  if (element.isContentEditable || element.closest('[contenteditable]:not([contenteditable="false"])')) return true

  const selector = [
    'input',
    'textarea',
    'select',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="searchbox"]',
    '[aria-multiline="true"]',
    '[contenteditable]:not([contenteditable="false"])',
    '[data-keyboard-editable]',
    '.dx-texteditor',
    '.dx-htmleditor',
    '.ql-editor',
    '.cm-editor',
    '.monaco-editor',
    '.ProseMirror',
    extraSelector,
  ].filter(Boolean).join(', ')

  return Boolean(element.closest(selector))
}

function isFunctionShortcutKey(key: string) {
  return /^F(?:[1-9]|1\d|2[0-4])$/.test(key)
}

function isPrintableShortcutKey(key: string) {
  return /^[A-Z0-9]$/.test(key) || /^NUMPAD\d$/.test(key)
}

function isPlainTextEditingKey(key: string) {
  return [
    'BACKSPACE',
    'DELETE',
    'ENTER',
    'ESC',
    'SPACE',
    'TAB',
  ].includes(key)
}

function isReservedTextShortcutKey(key: string) {
  return [
    'A',
    'B',
    'C',
    'F',
    'I',
    'P',
    'S',
    'U',
    'V',
    'X',
    'Y',
    'Z',
    'BACKSPACE',
    'DELETE',
    'DOWN',
    'END',
    'ENTER',
    'HOME',
    'LEFT',
    'PAGEUP',
    'PAGEDOWN',
    'RIGHT',
    'SPACE',
    'TAB',
    'UP',
  ].includes(key)
}

function splitKeyboardShortcutList(value: unknown) {
  return String(value || '')
    .split(',')
    .map(normalizeKeyboardShortcut)
    .filter(Boolean)
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value)
}
