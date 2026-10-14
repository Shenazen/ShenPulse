/** Réutilise les formateurs de nombres ; le cache borné suit la langue et les options. */
const formatters = new Map<string, Intl.NumberFormat>()
const MAX_FORMATTERS = 32

export function getGameNumberFormatter(
  locales?: Intl.LocalesArgument,
  options: Intl.NumberFormatOptions = {},
) {
  const key = JSON.stringify([locales ?? null, Object.entries(options).sort(([left], [right]) => left.localeCompare(right))])
  const previous = formatters.get(key)
  if (previous) return previous
  const formatter = new Intl.NumberFormat(locales, options)
  if (formatters.size >= MAX_FORMATTERS) formatters.delete(formatters.keys().next().value!)
  formatters.set(key, formatter)
  return formatter
}
