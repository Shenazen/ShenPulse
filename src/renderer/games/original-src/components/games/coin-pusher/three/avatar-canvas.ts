/** Tuiles de portraits et UV de l’atlas partagé des spectateurs. */
import { AVATAR_ATLAS_VIEWERS_PER_PAGE, AVATAR_ATLAS_COLUMNS, AVATAR_ATLAS_TILE_SIZE, AVATAR_ATLAS_TILE_PADDING, AVATAR_ATLAS_TEXTURE_SIZE } from './constants'
import { hashText, initials } from './resources'

export function avatarAtlasTilePosition(slot: number) {
  const safeSlot = Math.max(0, Math.min(
    AVATAR_ATLAS_VIEWERS_PER_PAGE - 1,
    Math.floor(slot),
  ))
  return {
    x: (safeSlot % AVATAR_ATLAS_COLUMNS) * AVATAR_ATLAS_TILE_SIZE,
    y: Math.floor(safeSlot / AVATAR_ATLAS_COLUMNS) * AVATAR_ATLAS_TILE_SIZE,
  }
}

export function avatarAtlasUvRect(slot: number): readonly [number, number, number, number] {
  const { x, y } = avatarAtlasTilePosition(slot)
  const contentSize = AVATAR_ATLAS_TILE_SIZE - AVATAR_ATLAS_TILE_PADDING * 2
  return [
    (x + AVATAR_ATLAS_TILE_PADDING) / AVATAR_ATLAS_TEXTURE_SIZE,
    (
      AVATAR_ATLAS_TEXTURE_SIZE
      - y
      - AVATAR_ATLAS_TILE_SIZE
      + AVATAR_ATLAS_TILE_PADDING
    ) / AVATAR_ATLAS_TEXTURE_SIZE,
    contentSize / AVATAR_ATLAS_TEXTURE_SIZE,
    contentSize / AVATAR_ATLAS_TEXTURE_SIZE,
  ]
}

export function prepareAvatarAtlasTile(
  context: CanvasRenderingContext2D | null,
  slot: number,
) {
  if (!context) return null
  const { x, y } = avatarAtlasTilePosition(slot)
  const padding = AVATAR_ATLAS_TILE_PADDING
  const size = AVATAR_ATLAS_TILE_SIZE
  const contentX = x + padding
  const contentY = y + padding
  const contentSize = size - padding * 2
  context.save()
  context.clearRect(x, y, size, size)
  context.fillStyle = '#040914'
  context.fillRect(x, y, size, size)
  context.beginPath()
  context.arc(
    contentX + contentSize / 2,
    contentY + contentSize / 2,
    contentSize / 2,
    0,
    Math.PI * 2,
  )
  context.clip()
  return { contentSize, contentX, contentY }
}

export function finishAvatarAtlasTile(
  context: CanvasRenderingContext2D | null,
  tile: { contentSize: number; contentX: number; contentY: number } | null,
) {
  if (!context || !tile) return
  context.restore()
  const centerX = tile.contentX + tile.contentSize / 2
  const centerY = tile.contentY + tile.contentSize / 2
  context.save()
  context.strokeStyle = 'rgba(255,255,255,.9)'
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(centerX, centerY, tile.contentSize * 0.43, 0, Math.PI * 2)
  context.stroke()
  context.strokeStyle = 'rgba(251,191,36,.96)'
  context.lineWidth = 2
  context.beginPath()
  context.arc(centerX, centerY, tile.contentSize * 0.475, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

export function drawAvatarAtlasFallback(
  context: CanvasRenderingContext2D | null,
  slot: number,
  seed: string,
  name: string,
) {
  const tile = prepareAvatarAtlasTile(context, slot)
  if (!context || !tile) return
  const hue = hashText(seed) % 360
  const centerX = tile.contentX + tile.contentSize / 2
  const centerY = tile.contentY + tile.contentSize / 2
  const gradient = context.createRadialGradient(
    tile.contentX + tile.contentSize * 0.31,
    tile.contentY + tile.contentSize * 0.22,
    tile.contentSize * 0.05,
    centerX,
    centerY,
    tile.contentSize * 0.74,
  )
  gradient.addColorStop(0, `hsl(${(hue + 42) % 360} 95% 72%)`)
  gradient.addColorStop(0.52, `hsl(${hue} 78% 48%)`)
  gradient.addColorStop(1, '#07101f')
  context.fillStyle = gradient
  context.fillRect(tile.contentX, tile.contentY, tile.contentSize, tile.contentSize)
  context.fillStyle = '#ffffff'
  context.shadowColor = '#000000'
  context.shadowBlur = 4
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `900 ${Math.round(tile.contentSize * 0.31)}px Inter, Arial, sans-serif`
  context.fillText(initials(name), centerX, centerY + 1)
  finishAvatarAtlasTile(context, tile)
}

export function drawAvatarAtlasImage(
  context: CanvasRenderingContext2D | null,
  slot: number,
  image: HTMLImageElement,
) {
  const tile = prepareAvatarAtlasTile(context, slot)
  if (!context || !tile) return
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1)
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1)
  const sourceSize = Math.min(sourceWidth, sourceHeight)
  const sourceX = (sourceWidth - sourceSize) / 2
  const sourceY = (sourceHeight - sourceSize) / 2
  try {
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      tile.contentX,
      tile.contentY,
      tile.contentSize,
      tile.contentSize,
    )
  } finally {
    finishAvatarAtlasTile(context, tile)
  }
}

