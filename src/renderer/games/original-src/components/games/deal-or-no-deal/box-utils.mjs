export function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)]
}

export function swapBoxValues(leftBox, rightBox) {
  if (!leftBox || !rightBox || leftBox.id === rightBox.id) return
  ;[leftBox.value, rightBox.value] = [rightBox.value, leftBox.value]
}

