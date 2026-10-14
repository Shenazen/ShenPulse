/** Textures Canvas des décors et objets spéciaux, indépendantes de WebGL. */
import * as THREE from 'three'
import { createCanvasTexture } from './resources'

export function createMachineTitleTexture(title: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 144
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    const edgeGradient = context.createLinearGradient(112, 0, canvas.width - 112, 0)
    edgeGradient.addColorStop(0, 'rgba(67,232,255,0)')
    edgeGradient.addColorStop(0.22, '#43e8ff')
    edgeGradient.addColorStop(0.5, '#f7c85d')
    edgeGradient.addColorStop(0.78, '#fb4b4f')
    edgeGradient.addColorStop(1, 'rgba(251,75,79,0)')
    context.fillStyle = edgeGradient
    context.fillRect(112, 119, canvas.width - 224, 3)

    const titleGradient = context.createLinearGradient(0, 28, 0, 112)
    titleGradient.addColorStop(0, '#fff3c9')
    titleGradient.addColorStop(0.48, '#f7c85d')
    titleGradient.addColorStop(1, '#b9761e')
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '900 82px Inter, Arial Black, Arial, sans-serif'
    context.lineWidth = 8
    context.strokeStyle = 'rgba(2,6,15,.96)'
    context.strokeText(title, canvas.width / 2, 71)
    context.shadowColor = 'rgba(247,200,93,.5)'
    context.shadowBlur = 6
    context.fillStyle = titleGradient
    context.fillText(title, canvas.width / 2, 71)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

export function createMysteryDieTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    const background = context.createRadialGradient(174, 132, 18, 256, 256, 360)
    background.addColorStop(0, '#a85cff')
    background.addColorStop(0.42, '#4b1a91')
    background.addColorStop(1, '#10051f')
    context.fillStyle = background
    context.fillRect(0, 0, canvas.width, canvas.height)

    const edge = context.createLinearGradient(20, 20, 492, 492)
    edge.addColorStop(0, '#fff2af')
    edge.addColorStop(0.28, '#f6bc47')
    edge.addColorStop(0.56, '#fff4c8')
    edge.addColorStop(1, '#9b5b16')
    context.lineJoin = 'round'
    context.lineWidth = 28
    context.strokeStyle = edge
    context.strokeRect(28, 28, 456, 456)
    context.lineWidth = 5
    context.strokeStyle = 'rgba(255,255,255,.68)'
    context.strokeRect(51, 51, 410, 410)

    for (let corner = 0; corner < 4; corner += 1) {
      const x = corner % 2 ? 438 : 74
      const y = corner > 1 ? 438 : 74
      context.save()
      context.translate(x, y)
      context.rotate(Math.PI / 4)
      context.fillStyle = corner % 2 ? '#58e9ff' : '#ffbd48'
      context.fillRect(-12, -12, 24, 24)
      context.restore()
    }

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '900 330px Inter, Arial Black, Arial, sans-serif'
    context.lineJoin = 'round'
    context.lineWidth = 36
    context.strokeStyle = '#160523'
    context.strokeText('?', 256, 273)
    context.shadowColor = '#fff2a8'
    context.shadowBlur = 24
    context.fillStyle = edge
    context.fillText('?', 256, 273)
    context.shadowBlur = 0
    context.fillStyle = 'rgba(255,255,255,.72)'
    context.beginPath()
    context.ellipse(204, 129, 38, 16, -0.55, 0, Math.PI * 2)
    context.fill()
  }
  const texture = createCanvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

export function createPointTicketTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    const background = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    background.addColorStop(0, '#063f67')
    background.addColorStop(0.42, '#0ab6d7')
    background.addColorStop(0.58, '#7425bb')
    background.addColorStop(1, '#26063c')
    context.beginPath()
    context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 62)
    context.fillStyle = background
    context.fill()

    const border = context.createLinearGradient(30, 0, canvas.width - 30, 0)
    border.addColorStop(0, '#66f4ff')
    border.addColorStop(0.48, '#fff5c6')
    border.addColorStop(1, '#f1a3ff')
    context.lineWidth = 22
    context.strokeStyle = border
    context.stroke()
    context.beginPath()
    context.roundRect(49, 49, canvas.width - 98, canvas.height - 98, 42)
    context.setLineDash([18, 13])
    context.lineWidth = 5
    context.strokeStyle = 'rgba(255,255,255,.68)'
    context.stroke()
    context.setLineDash([])

    for (let side = 0; side < 2; side += 1) {
      const x = side ? 878 : 146
      context.save()
      context.translate(x, 255)
      context.rotate(Math.PI / 4)
      context.fillStyle = '#ffd66d'
      context.fillRect(-38, -38, 76, 76)
      context.fillStyle = '#5a20a2'
      context.fillRect(-20, -20, 40, 40)
      context.restore()
    }

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '900 94px Inter, Arial Black, Arial, sans-serif'
    context.lineJoin = 'round'
    context.lineWidth = 18
    context.strokeStyle = '#07101f'
    context.strokeText('TICKET BONUS', canvas.width / 2, 205)
    context.fillStyle = '#ffffff'
    context.shadowColor = '#73eeff'
    context.shadowBlur = 18
    context.fillText('TICKET BONUS', canvas.width / 2, 205)
    context.shadowBlur = 0
    context.font = '900 122px Inter, Arial Black, Arial, sans-serif'
    context.strokeText('+ POINTS', canvas.width / 2, 329)
    context.fillStyle = '#ffe184'
    context.fillText('+ POINTS', canvas.width / 2, 329)
  }
  const texture = createCanvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

export function createGalacticCasinoBackdropTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const context = canvas.getContext('2d')
  if (context) {
    const size = canvas.width
    const center = size / 2

    const room = context.createLinearGradient(0, 0, 0, size)
    room.addColorStop(0, '#09091b')
    room.addColorStop(0.42, '#100b24')
    room.addColorStop(0.7, '#070817')
    room.addColorStop(1, '#02040d')
    context.fillStyle = room
    context.fillRect(0, 0, size, size)

    const cyanGlow = context.createRadialGradient(105, 420, 10, 105, 420, 390)
    cyanGlow.addColorStop(0, 'rgba(31,199,255,.22)')
    cyanGlow.addColorStop(0.42, 'rgba(23,101,180,.095)')
    cyanGlow.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = cyanGlow
    context.fillRect(0, 0, size, size)
    const violetGlow = context.createRadialGradient(919, 400, 10, 919, 400, 390)
    violetGlow.addColorStop(0, 'rgba(168,75,255,.22)')
    violetGlow.addColorStop(0.42, 'rgba(91,34,167,.1)')
    violetGlow.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = violetGlow
    context.fillRect(0, 0, size, size)
    const crownGlow = context.createRadialGradient(center, 80, 0, center, 80, 430)
    crownGlow.addColorStop(0, 'rgba(255,204,103,.13)')
    crownGlow.addColorStop(0.45, 'rgba(118,71,175,.055)')
    crownGlow.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = crownGlow
    context.fillRect(0, 0, size, 660)

    // Monumental stepped arches continue the physical torus moulding and make
    // the narrow areas beside the machine read as one coherent casino hall.
    const archGradient = context.createLinearGradient(70, 0, size - 70, 0)
    archGradient.addColorStop(0, 'rgba(56,216,255,.72)')
    archGradient.addColorStop(0.22, 'rgba(224,174,78,.76)')
    archGradient.addColorStop(0.5, 'rgba(255,224,150,.86)')
    archGradient.addColorStop(0.78, 'rgba(224,174,78,.76)')
    archGradient.addColorStop(1, 'rgba(173,79,255,.74)')
    for (let arch = 0; arch < 4; arch += 1) {
      context.beginPath()
      context.ellipse(
        center,
        612 + arch * 10,
        470 - arch * 27,
        548 - arch * 30,
        0,
        Math.PI,
        Math.PI * 2,
      )
      context.lineWidth = arch === 0 ? 10 : arch === 1 ? 4 : 2
      context.strokeStyle = arch === 0
        ? 'rgba(76,50,93,.88)'
        : arch === 1
          ? archGradient
          : `rgba(230,190,102,${0.32 - arch * 0.045})`
      context.stroke()
    }

    // Painted architectural bays remain visible between the real columns and
    // the cabinet. Their small bevels survive downsampling better than noise.
    for (const side of [-1, 1]) {
      const bayCenter = center + side * 395
      const bayGradient = context.createLinearGradient(
        bayCenter - 82,
        0,
        bayCenter + 82,
        0,
      )
      bayGradient.addColorStop(0, 'rgba(3,5,15,.96)')
      bayGradient.addColorStop(0.28, 'rgba(31,27,56,.94)')
      bayGradient.addColorStop(0.5, 'rgba(63,52,83,.78)')
      bayGradient.addColorStop(0.72, 'rgba(25,22,49,.94)')
      bayGradient.addColorStop(1, 'rgba(2,4,13,.96)')
      context.beginPath()
      context.moveTo(bayCenter - 88, 116)
      context.lineTo(bayCenter + 88, 116)
      context.lineTo(bayCenter + 104, 178)
      context.lineTo(bayCenter + 92, 770)
      context.lineTo(bayCenter + 64, 824)
      context.lineTo(bayCenter - 64, 824)
      context.lineTo(bayCenter - 92, 770)
      context.lineTo(bayCenter - 104, 178)
      context.closePath()
      context.fillStyle = bayGradient
      context.fill()
      context.lineWidth = 8
      context.strokeStyle = 'rgba(205,150,61,.55)'
      context.stroke()

      for (let flute = -2; flute <= 2; flute += 1) {
        const x = bayCenter + flute * 25
        const fluteGradient = context.createLinearGradient(x - 4, 0, x + 4, 0)
        fluteGradient.addColorStop(0, 'rgba(0,0,0,0)')
        fluteGradient.addColorStop(
          0.5,
          side < 0 ? 'rgba(63,213,255,.27)' : 'rgba(179,85,255,.27)',
        )
        fluteGradient.addColorStop(1, 'rgba(0,0,0,0)')
        context.fillStyle = fluteGradient
        context.fillRect(x - 5, 190, 10, 548)
      }

      for (const y of [166, 258, 445, 632, 748]) {
        context.beginPath()
        context.roundRect(bayCenter - 74, y, 148, 11, 5)
        context.fillStyle = 'rgba(225,178,80,.35)'
        context.fill()
        context.fillStyle = side < 0
          ? 'rgba(57,210,255,.34)'
          : 'rgba(175,77,255,.34)'
        context.fillRect(bayCenter - 54, y + 3, 108, 3)
      }
    }

    // A polished perspective floor extends beyond the cabinet's base. It adds
    // depth in the side gutters while staying deliberately dark under the game.
    const floor = context.createLinearGradient(0, 620, 0, size)
    floor.addColorStop(0, 'rgba(35,25,55,.08)')
    floor.addColorStop(0.34, 'rgba(15,13,31,.72)')
    floor.addColorStop(1, 'rgba(2,4,12,.98)')
    context.fillStyle = floor
    context.fillRect(0, 620, size, size - 620)
    context.save()
    context.beginPath()
    context.rect(0, 620, size, size - 620)
    context.clip()
    for (let line = -7; line <= 7; line += 1) {
      context.beginPath()
      context.moveTo(center + line * 18, 620)
      context.lineTo(center + line * 92, size)
      context.lineWidth = line % 2 === 0 ? 2 : 1
      context.strokeStyle = line < 0
        ? 'rgba(58,197,255,.16)'
        : line > 0
          ? 'rgba(167,77,255,.16)'
          : 'rgba(236,187,88,.24)'
      context.stroke()
    }
    for (let row = 0; row < 9; row += 1) {
      const progress = row / 8
      const y = 635 + Math.pow(progress, 1.72) * 369
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.lineWidth = row % 3 === 0 ? 2 : 1
      context.strokeStyle = `rgba(220,177,87,${0.08 + progress * 0.08})`
      context.stroke()
    }
    context.restore()

    // Deterministic jewel lamps and dust motes supply the controlled detail of
    // a premium casino without shimmering temporal noise.
    let seed = 0x4f13b9
    const random = () => {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)
      return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296
    }
    for (let index = 0; index < 76; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      const x = center + side * (300 + random() * 205)
      const y = 72 + random() * 795
      const radius = 0.8 + random() * 2.3
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fillStyle = index % 5 === 0
        ? `rgba(255,212,122,${0.26 + random() * 0.42})`
        : side < 0
          ? `rgba(86,221,255,${0.16 + random() * 0.32})`
          : `rgba(193,112,255,${0.16 + random() * 0.32})`
      context.fill()
    }
    for (const side of [-1, 1]) {
      for (let lamp = 0; lamp < 5; lamp += 1) {
        const x = center + side * (438 + (lamp % 2) * 18)
        const y = 230 + lamp * 112
        const halo = context.createRadialGradient(x, y, 0, x, y, 31)
        halo.addColorStop(
          0,
          side < 0 ? 'rgba(176,244,255,.78)' : 'rgba(226,185,255,.78)',
        )
        halo.addColorStop(
          0.18,
          side < 0 ? 'rgba(46,203,255,.36)' : 'rgba(164,63,255,.36)',
        )
        halo.addColorStop(1, 'rgba(0,0,0,0)')
        context.fillStyle = halo
        context.fillRect(x - 34, y - 34, 68, 68)
        context.save()
        context.translate(x, y)
        context.rotate(Math.PI / 4)
        context.fillStyle = 'rgba(244,198,95,.74)'
        context.fillRect(-6, -6, 12, 12)
        context.fillStyle = side < 0 ? '#63dcff' : '#b86cff'
        context.fillRect(-3, -3, 6, 6)
        context.restore()
      }
    }

    const vignette = context.createRadialGradient(center, 490, 300, center, 490, 760)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(0.72, 'rgba(0,0,0,.06)')
    vignette.addColorStop(1, 'rgba(0,0,0,.52)')
    context.fillStyle = vignette
    context.fillRect(0, 0, size, size)
  }
  const texture = createCanvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

export function createGalacticPanelTexture() {
  const canvas = document.createElement('canvas')
  const logicalSize = 1024
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    context.scale(canvas.width / logicalSize, canvas.height / logicalSize)
    context.clearRect(0, 0, logicalSize, logicalSize)
    const space = context.createLinearGradient(0, 0, logicalSize, logicalSize)
    space.addColorStop(0, 'rgba(2,7,18,.22)')
    space.addColorStop(0.45, 'rgba(20,5,46,.4)')
    space.addColorStop(1, 'rgba(2,12,29,.24)')
    context.fillStyle = space
    context.fillRect(0, 0, logicalSize, logicalSize)

    const cyanNebula = context.createRadialGradient(180, 720, 0, 180, 720, 520)
    cyanNebula.addColorStop(0, 'rgba(21,183,255,.18)')
    cyanNebula.addColorStop(0.45, 'rgba(18,102,220,.075)')
    cyanNebula.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = cyanNebula
    context.fillRect(0, 0, logicalSize, logicalSize)

    const violetNebula = context.createRadialGradient(820, 250, 0, 820, 250, 480)
    violetNebula.addColorStop(0, 'rgba(183,69,255,.18)')
    violetNebula.addColorStop(0.5, 'rgba(90,33,190,.07)')
    violetNebula.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = violetNebula
    context.fillRect(0, 0, logicalSize, logicalSize)

    let seed = 0x5a17c9
    const random = () => {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)
      return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296
    }
    for (let index = 0; index < 230; index += 1) {
      const x = 28 + random() * (logicalSize - 56)
      const y = 28 + random() * (logicalSize - 56)
      const radius = 0.55 + random() * 1.65
      const alpha = 0.18 + random() * 0.62
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fillStyle = index % 7 === 0
        ? `rgba(123,226,255,${alpha})`
        : index % 9 === 0
          ? `rgba(220,154,255,${alpha})`
          : `rgba(255,239,198,${alpha})`
      context.fill()
    }

    context.lineWidth = 1.5
    context.strokeStyle = 'rgba(240,197,105,.11)'
    for (let line = 0; line < 7; line += 1) {
      const startX = 90 + random() * 840
      const startY = 80 + random() * 850
      context.beginPath()
      context.moveTo(startX, startY)
      for (let point = 1; point < 5; point += 1) {
        context.lineTo(
          Math.max(45, Math.min(979, startX + (random() - 0.5) * 370)),
          Math.max(45, Math.min(979, startY + point * 58 + (random() - 0.5) * 70)),
        )
      }
      context.stroke()
    }

    const border = context.createLinearGradient(0, 0, logicalSize, logicalSize)
    border.addColorStop(0, 'rgba(74,224,255,.38)')
    border.addColorStop(0.5, 'rgba(255,198,90,.2)')
    border.addColorStop(1, 'rgba(176,65,255,.38)')
    context.strokeStyle = border
    context.lineWidth = 9
    context.strokeRect(10, 10, logicalSize - 20, logicalSize - 20)
    context.lineWidth = 2
    context.strokeStyle = 'rgba(255,231,170,.32)'
    context.strokeRect(24, 24, logicalSize - 48, logicalSize - 48)
  }
  return createCanvasTexture(canvas)
}

