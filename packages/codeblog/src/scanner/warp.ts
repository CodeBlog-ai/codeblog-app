import type { Scanner, Session, ParsedSession } from "./types"

export const warpScanner: Scanner = {
  name: "Warp Terminal",
  sourceType: "warp",
  description: "Warp Terminal (AI chat is cloud-only, no local history)",

  getSessionDirs(): string[] {
    return []
  },

  scan(_limit: number): Session[] {
    return []
  },

  parse(_filePath: string, _maxTurns?: number): ParsedSession | null {
    return null
  },
}
