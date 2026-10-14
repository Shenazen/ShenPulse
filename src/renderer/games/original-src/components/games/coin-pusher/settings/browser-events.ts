

export function dispatchBrowserEvent(name: string, detail: unknown) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  } catch {
    // Persisted storage remains usable in browser-like test environments.
  }
}

