/** Dessin des scores flottants et emplacements fixes des deux thèmes. */
import * as THREE from 'three'
import { createCanvasTexture } from './resources'

export function createFloatingScoreTexture(text: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.beginPath()
    context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 25)
    context.fillStyle = 'rgba(2,6,16,.95)'
    context.fill()
    context.lineWidth = 6
    context.strokeStyle = color
    context.stroke()

    const accent = context.createLinearGradient(44, 0, canvas.width - 44, 0)
    accent.addColorStop(0, 'rgba(255,255,255,0)')
    accent.addColorStop(0.5, color)
    accent.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = accent
    context.fillRect(44, 108, canvas.width - 88, 3)

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const fontSize = fitScoreFont(context, text, 268, 82, 44)
    context.font = scoreFont(fontSize)
    context.lineJoin = 'round'
    context.lineWidth = Math.max(8, fontSize * 0.14)
    context.strokeStyle = 'rgba(1,3,10,.98)'
    context.strokeText(text, canvas.width / 2, 62)
    context.shadowColor = color
    context.shadowBlur = 12
    context.fillStyle = '#ffffff'
    context.fillText(text, canvas.width / 2, 62)
  }
  return createCanvasTexture(canvas)
}

export function createScoreSlotTexture(text: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)

    context.beginPath()
    context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 34)
    const panel = context.createLinearGradient(0, 8, 0, canvas.height - 8)
    panel.addColorStop(0, 'rgba(14,22,38,.99)')
    panel.addColorStop(0.54, 'rgba(3,8,18,.99)')
    panel.addColorStop(1, 'rgba(1,3,10,.99)')
    context.fillStyle = panel
    context.fill()
    context.lineWidth = 11
    context.strokeStyle = color
    context.stroke()

    context.beginPath()
    context.roundRect(21, 21, canvas.width - 42, canvas.height - 42, 24)
    context.lineWidth = 2
    context.strokeStyle = 'rgba(255,255,255,.28)'
    context.stroke()

    const accent = context.createLinearGradient(70, 0, canvas.width - 70, 0)
    accent.addColorStop(0, 'rgba(255,255,255,0)')
    accent.addColorStop(0.22, color)
    accent.addColorStop(0.5, '#ffffff')
    accent.addColorStop(0.78, color)
    accent.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = accent
    context.fillRect(70, 222, canvas.width - 140, 7)

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const fontSize = fitScoreFont(context, text, 430, 176, 76)
    context.font = scoreFont(fontSize)
    context.lineJoin = 'round'
    context.lineWidth = Math.max(15, fontSize * 0.13)
    context.strokeStyle = 'rgba(0,2,8,1)'
    context.strokeText(text, canvas.width / 2, 126)
    context.shadowColor = color
    context.shadowBlur = 20
    context.fillStyle = '#ffffff'
    context.fillText(text, canvas.width / 2, 126)
  }
  return createCanvasTexture(canvas)
}

export function createGalacticScoreSlotTexture(text: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)

    context.beginPath()
    context.moveTo(42, 10)
    context.lineTo(canvas.width - 42, 10)
    context.lineTo(canvas.width - 10, 48)
    context.lineTo(canvas.width - 10, canvas.height - 42)
    context.lineTo(canvas.width - 48, canvas.height - 10)
    context.lineTo(48, canvas.height - 10)
    context.lineTo(10, canvas.height - 42)
    context.lineTo(10, 48)
    context.closePath()
    const panel = context.createLinearGradient(0, 8, 0, canvas.height - 8)
    panel.addColorStop(0, 'rgba(23,20,43,.99)')
    panel.addColorStop(0.42, 'rgba(5,5,14,.995)')
    panel.addColorStop(1, 'rgba(1,2,7,.995)')
    context.fillStyle = panel
    context.fill()
    context.lineWidth = 12
    context.strokeStyle = color
    context.shadowColor = color
    context.shadowBlur = 18
    context.stroke()

    context.shadowBlur = 0
    context.beginPath()
    context.moveTo(58, 28)
    context.lineTo(canvas.width - 58, 28)
    context.lineTo(canvas.width - 29, 58)
    context.lineTo(canvas.width - 29, canvas.height - 54)
    context.lineTo(canvas.width - 58, canvas.height - 28)
    context.lineTo(58, canvas.height - 28)
    context.lineTo(29, canvas.height - 54)
    context.lineTo(29, 58)
    context.closePath()
    context.lineWidth = 3
    context.strokeStyle = 'rgba(255,222,150,.58)'
    context.stroke()

    const topAccent = context.createLinearGradient(70, 0, canvas.width - 70, 0)
    topAccent.addColorStop(0, 'rgba(255,255,255,0)')
    topAccent.addColorStop(0.25, color)
    topAccent.addColorStop(0.5, '#fff4ce')
    topAccent.addColorStop(0.75, color)
    topAccent.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = topAccent
    context.fillRect(70, 39, canvas.width - 140, 5)
    context.fillRect(92, 216, canvas.width - 184, 5)

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const fontSize = fitScoreFont(context, text, 416, 174, 74)
    context.font = scoreFont(fontSize)
    context.lineJoin = 'round'
    context.lineWidth = Math.max(16, fontSize * 0.135)
    context.strokeStyle = 'rgba(0,1,6,1)'
    context.strokeText(text, canvas.width / 2, 129)
    context.shadowColor = color
    context.shadowBlur = 24
    context.fillStyle = '#fff8e7'
    context.fillText(text, canvas.width / 2, 129)
  }
  return createCanvasTexture(canvas)
}

export function fitScoreFont(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  minimumSize: number,
) {
  let size = initialSize
  while (size > minimumSize) {
    context.font = scoreFont(size)
    if (context.measureText(text).width <= maxWidth) break
    size -= 4
  }
  return Math.max(minimumSize, size)
}

export function scoreFont(size: number) {
  return `900 ${size}px Inter, Arial Black, Arial, sans-serif`
}

export function scoreColor(value: number, index: number) {
  if (value < 0) return new THREE.Color(0xdf3f62)
  if (value === 0) return new THREE.Color(index % 2 ? 0x4f46e5 : 0x475569)
  if (value >= 25) return new THREE.Color(0xe7b84b)
  if (value >= 10) return new THREE.Color(0x8b5cf6)
  return new THREE.Color(0x28c7d8)
}

export function galacticScoreColor(value: number, index: number) {
  if (value < 0) return new THREE.Color(0xf13c73)
  if (value === 0) return new THREE.Color(index % 2 ? 0x635bff : 0x48556f)
  if (value >= 25) return new THREE.Color(0xf6bd43)
  const palette = [0x16c8ee, 0xc24cff, 0x735dff, 0xff4dc7, 0xf6bd43]
  return new THREE.Color(palette[index % palette.length])
}

