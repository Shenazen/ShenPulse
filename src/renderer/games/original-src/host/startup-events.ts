/** Garde l’ordre des interactions reçues pendant le téléchargement du jeu actif. */
export function createStartupEventQueue<T>() {
  const pending: T[] = []
  let handler: ((event: T) => void) | null = null
  let draining = false
  let disposed = false

  return {
    enqueue(event: T) {
      if (disposed) return
      if (handler && !draining) handler(event)
      else pending.push(event)
    },
    activate(callback: (event: T) => void) {
      if (disposed) return
      handler = callback
      draining = true
      try {
        // Pas de shift() quadratique ; les arrivées réentrantes restent à la fin.
        for (let index = 0; index < pending.length; index += 1) callback(pending[index]!)
      } finally {
        pending.length = 0
        draining = false
      }
    },
    dispose() {
      disposed = true
      handler = null
      pending.length = 0
    },
  }
}
