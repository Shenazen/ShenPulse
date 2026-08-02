export type BrowserStorageArea = 'local' | 'session'

export function readBrowserStorage(area: BrowserStorageArea, key: string, fallback = '') {
  if (typeof window === 'undefined') return fallback

  try {
    return storageFor(area).getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeBrowserStorage(area: BrowserStorageArea, key: string, value: string) {
  if (typeof window === 'undefined') return false

  try {
    storageFor(area).setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeBrowserStorage(area: BrowserStorageArea, key: string) {
  if (typeof window === 'undefined') return false

  try {
    storageFor(area).removeItem(key)
    return true
  } catch {
    return false
  }
}

export function browserStorageLength(area: BrowserStorageArea) {
  if (typeof window === 'undefined') return 0

  try {
    return storageFor(area).length
  } catch {
    return 0
  }
}

export function browserStorageKey(area: BrowserStorageArea, index: number) {
  if (typeof window === 'undefined') return ''

  try {
    return storageFor(area).key(index) || ''
  } catch {
    return ''
  }
}

export function readJsonBrowserStorage<T>(area: BrowserStorageArea, key: string, fallback: T): T {
  const value = readBrowserStorage(area, key, '')
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function writeJsonBrowserStorage(area: BrowserStorageArea, key: string, value: unknown) {
  try {
    return writeBrowserStorage(area, key, JSON.stringify(value))
  } catch {
    return false
  }
}

function storageFor(area: BrowserStorageArea) {
  return area === 'session' ? window.sessionStorage : window.localStorage
}
