export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

export function unique<T>(arr: T[], key?: (item: T) => unknown): T[] {
  if (!key) return [...new Set(arr)]
  const seen = new Set()
  return arr.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function groupBy<T, K extends string | number>(arr: T[], key: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>
  for (const item of arr) {
    const k = key(item)
    if (!result[k]) result[k] = []
    result[k].push(item)
  }
  return result
}

export function sortBy<T>(arr: T[], key: (item: T) => number, desc = false): T[] {
  return [...arr].sort((a, b) => (desc ? key(b) - key(a) : key(a) - key(b)))
}

export function compact<T>(arr: (T | null | undefined | false | 0 | "")[]): T[] {
  return arr.filter(Boolean) as T[]
}
