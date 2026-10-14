import { nextTick } from 'vue'

/** Ajuste les montants au conteneur et possède l'unique animation différée. */
export function createDealPriceFitter(context) {
  const { entryAmountRef, entryAmountScale, premiumBasePriceRef, premiumBasePriceScale, premiumEntryPriceRef, premiumEntryPriceScale } = context
  let entryAmountFitFrame = 0

  function scheduleEntryAmountFit() {
    if (typeof window === 'undefined') return
  
    window.cancelAnimationFrame(entryAmountFitFrame)
    entryAmountFitFrame = window.requestAnimationFrame(() => {
      fitEntryAmounts()
    })
  }

  function entryAmountFitTargets() {
    return [
      { element: entryAmountRef.value, scale: entryAmountScale },
      { element: premiumBasePriceRef.value, scale: premiumBasePriceScale },
      { element: premiumEntryPriceRef.value, scale: premiumEntryPriceScale },
    ].filter(({ element }) => element)
  }

  function fitEntryAmounts() {
    const targets = entryAmountFitTargets()
    if (!targets.length) return
  
    targets.forEach(({ scale }) => {
      scale.value = 1
    })
    nextTick(() => {
      targets.forEach((target) => {
        refineEntryAmountFit(target)
      })
    })
  }

  function refineEntryAmountFit({ element, scale }, attempt = 0) {
    if (!element) return
  
    const availableWidth = element.clientWidth
    const availableHeight = element.clientHeight
    const requiredWidth = element.scrollWidth
    const requiredHeight = element.scrollHeight
    if (!availableWidth || !availableHeight || !requiredWidth || !requiredHeight) return
  
    const widthScale = requiredWidth > availableWidth ? availableWidth / requiredWidth : 1
    const heightScale = requiredHeight > availableHeight ? availableHeight / requiredHeight : 1
    const nextRatio = Math.min(1, widthScale, heightScale) * 0.96
    const nextScale = Math.max(0.28, Number((scale.value * nextRatio).toFixed(3)))
  
    if (nextScale < scale.value) {
      scale.value = nextScale
    }
  
    if (attempt < 5 && (requiredWidth > availableWidth || requiredHeight > availableHeight)) {
      nextTick(() => refineEntryAmountFit({ element, scale }, attempt + 1))
    }
  }
  function dispose() { window.cancelAnimationFrame(entryAmountFitFrame); entryAmountFitFrame = 0 }

  return { scheduleEntryAmountFit, entryAmountFitTargets, fitEntryAmounts, refineEntryAmountFit, dispose }
}

