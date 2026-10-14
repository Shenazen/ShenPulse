import { asRecord } from './records'

export function imageUrlFromUnknown(value: unknown, seen = new WeakSet<object>()): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || seen.has(value)) return ''

  seen.add(value)

  if (Array.isArray(value)) {
    for (const candidate of value) {
      const url = imageUrlFromUnknown(candidate, seen)
      if (url) return url
    }
    return ''
  }

  const payload = asRecord(value)
  for (const candidate of [
    payload.url,
    payload.imageUrl,
    payload.urlList,
    payload.url_list,
  ]) {
    const url = imageUrlFromUnknown(candidate, seen)
    if (url) return url
  }

  return ''
}

export function firstImageUrl(...values: unknown[]) {
  for (const value of values) {
    const url = imageUrlFromUnknown(value)
    if (url) return url
  }
  return ''
}

