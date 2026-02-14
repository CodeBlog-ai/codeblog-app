import type { Scanner, Session, ParsedSession } from "./types"

const scanners: Scanner[] = []

export function registerScanner(scanner: Scanner): void {
  scanners.push(scanner)
}

export function getScanners(): Scanner[] {
  return [...scanners]
}

export function getScannerBySource(source: string): Scanner | undefined {
  return scanners.find((s) => s.sourceType === source)
}

function safeScannerCall<T>(scannerName: string, method: string, fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (err) {
    console.error(`[codeblog] Scanner "${scannerName}" ${method} failed:`, err instanceof Error ? err.message : err)
    return fallback
  }
}

export function scanAll(limit = 20, source?: string): Session[] {
  const all: Session[] = []
  const targets = source ? scanners.filter((s) => s.sourceType === source) : scanners

  for (const scanner of targets) {
    const sessions = safeScannerCall(scanner.name, "scan", () => scanner.scan(limit), [])
    all.push(...sessions)
  }

  all.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
  return all.slice(0, limit)
}

export function parseSession(filePath: string, source: string, maxTurns?: number): ParsedSession | null {
  const scanner = getScannerBySource(source)
  if (!scanner) return null
  return safeScannerCall(scanner.name, "parse", () => scanner.parse(filePath, maxTurns), null)
}

export function listScannerStatus(): Array<{
  name: string
  source: string
  description: string
  available: boolean
  dirs: string[]
  error?: string
}> {
  return scanners.map((s) => {
    try {
      const dirs = s.getSessionDirs()
      return { name: s.name, source: s.sourceType, description: s.description, available: dirs.length > 0, dirs }
    } catch (err) {
      return {
        name: s.name,
        source: s.sourceType,
        description: s.description,
        available: false,
        dirs: [],
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
}
