import * as path from "path"
import * as fs from "fs"
import type { Scanner, Session, ParsedSession, ConversationTurn } from "./types"
import { getHome } from "./platform"
import { listFiles, safeReadFile, safeStats } from "./fs-utils"

export const aiderScanner: Scanner = {
  name: "Aider",
  sourceType: "aider",
  description: "Aider AI pair programming sessions",

  getSessionDirs(): string[] {
    const home = getHome()
    const candidates = [path.join(home, ".aider", "history"), path.join(home, ".aider")]
    return candidates.filter((d) => {
      try { return fs.existsSync(d) } catch { return false }
    })
  },

  scan(limit: number): Session[] {
    const sessions: Session[] = []
    for (const dir of this.getSessionDirs()) {
      for (const filePath of listFiles(dir, [".md"], true)) {
        if (!path.basename(filePath).includes("aider")) continue
        const stats = safeStats(filePath)
        if (!stats || stats.size < 100) continue
        const content = safeReadFile(filePath)
        if (!content) continue
        const { humanCount, aiCount, preview } = parseAiderMarkdown(content)
        if (humanCount === 0) continue
        sessions.push({
          id: path.basename(filePath, ".md"), source: "aider",
          project: path.basename(path.dirname(filePath)),
          title: preview.slice(0, 80) || "Aider session",
          messageCount: humanCount + aiCount, humanMessages: humanCount, aiMessages: aiCount,
          preview, filePath, modifiedAt: stats.mtime, sizeBytes: stats.size,
        })
      }
    }
    sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
    return sessions.slice(0, limit)
  },

  parse(filePath: string, maxTurns?: number): ParsedSession | null {
    const content = safeReadFile(filePath)
    if (!content) return null
    const stats = safeStats(filePath)
    const turns = parseAiderTurns(content, maxTurns)
    if (turns.length === 0) return null
    const humanMsgs = turns.filter((t) => t.role === "human")
    const aiMsgs = turns.filter((t) => t.role === "assistant")
    return {
      id: path.basename(filePath, ".md"), source: "aider",
      project: path.basename(path.dirname(filePath)),
      title: humanMsgs[0]?.content.slice(0, 80) || "Aider session",
      messageCount: turns.length, humanMessages: humanMsgs.length, aiMessages: aiMsgs.length,
      preview: humanMsgs[0]?.content.slice(0, 200) || "",
      filePath, modifiedAt: stats?.mtime || new Date(), sizeBytes: stats?.size || 0, turns,
    }
  },
}

function parseAiderMarkdown(content: string) {
  const userBlocks = content.split(/^####\s+/m).filter(Boolean)
  let humanCount = 0
  let aiCount = 0
  let preview = ""
  for (const block of userBlocks) {
    const firstLine = block.split("\n")[0]?.trim()
    if (firstLine) {
      humanCount++
      if (!preview) preview = firstLine.slice(0, 200)
      const rest = block.split("\n").slice(1).join("\n").trim()
      if (rest) aiCount++
    }
  }
  return { humanCount, aiCount, preview }
}

function parseAiderTurns(content: string, maxTurns?: number): ConversationTurn[] {
  const turns: ConversationTurn[] = []
  for (const block of content.split(/^####\s+/m).filter(Boolean)) {
    if (maxTurns && turns.length >= maxTurns) break
    const lines = block.split("\n")
    const userMsg = lines[0]?.trim()
    if (userMsg) {
      turns.push({ role: "human", content: userMsg })
      const aiResponse = lines.slice(1).join("\n").trim()
      if (aiResponse) {
        if (maxTurns && turns.length >= maxTurns) break
        turns.push({ role: "assistant", content: aiResponse })
      }
    }
  }
  return turns
}
