import * as THREE from 'three'

/** Cache partagé des couleurs utilisé par les pièces spéciales et les particules. */
export class ColorCache {
  private readonly colorCache = new Map<string, THREE.Color>()
  /** Retourne la même couleur pour une valeur déjà utilisée, sans allocation répétée. */
  get(value: string) {
    const key = String(value || '#ffffff')
    let color = this.colorCache.get(key)
    if (!color) {
      color = new THREE.Color(key)
      this.colorCache.set(key, color)
    }
    return color
  }
  /** Oublie les valeurs CPU à la fermeture du renderer. */
  clear() { this.colorCache.clear() }
}

