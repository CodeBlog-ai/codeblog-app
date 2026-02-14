import * as path from "path"
import * as fs from "fs"
import type { Scanner, Session, ParsedSession, ConversationTurn } from "./types"
import { getHome } from "./platform"
import { listFiles, safeStats, readJsonl, extractProjectDescription } from "./fs-utils"

interface CodexLine {
  timestamp?: string
  type?: string
  payload?: {
    type?: string
    role?: string
    content?: Array<{ type?: string; text?: string }>
    cwd?: string
  }
}

export const codexScanner: Scanner = {
  name: "Codex (OpenAI CLI)",
  sourceType: "codex",
  description: "OpenAI Codex CLI sessions (~/.codex/)",

  getSessionDirs(): string[] {
    const home = getHome()
    const candidates = [path.join(home, ".codex", "sessions"), path.join(home, ".codex", "archived_sessions")]
    return candidates.filter((d) => {
      try { return fs.existsSync(d) } catch { return false }
    })
  },

  scan(limit: number): Session[] {
    const sessions: Session[] = []
    for (const dir of this.getSessionDirs()) {
      const files = listFiles(dir, [".jsonl"], true)
      for (const filePath of files) {
        const stats = safeStats(filePath)
        if (!stats) continue
        const lines = readJsonl<CodexLine>(filePath)
        if (lines.length < 3) continue
        const messageTurns = extractCodexTurns(lines)
        const humanMsgs = messageTurns.filter((t) => t.role === "human")
        const aiMsgs = messageTurns.filter((t) => t.role === "assistant")
        const startLine = lines.find((l) => l.payload?.cwd)
        const projectPath = startLine?.payload?.cwd || null
        const project = projectPath ? path.basename(projectPath) : path.basename(dir)
        const projectDescription = projectPath ? extractProjectDescription(projectPath) : null
        const preview = humanMsgs[0]?.content.slice(0, 200) || "(codex session)"

        sessions.push({
          id: path.basename(filePath, ".jsonl"),
          source: "codex",
          project,
          projectPath: projectPath || undefined,
          projectDescription: projectDescription || undefined,
          title: preview.slice(0, 80) || "Codex session",
          messageCount: messageTurns.length,
          humanMessages: humanMsgs.length,
          aiMessages: aiMsgs.length,
          preview,
          filePath,
          modifiedAt: stats.mtime,
          sizeBytes: stats.size,
        })
      }
    }
    sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
    return sessions.slice(0, limit)
  },

  parse(filePath: string, maxTurns?: number): ParsedSession | null {
    const lines = readJsonl<CodexLine>(filePath)
    if (lines.length === 0) return null
    const stats = safeStats(filePath)
    const allTurns = extractCodexTurns(lines)
    const turns = maxTurns ? allTurns.slice(0, maxTurns) : allTurns
    if (turns.length === 0) return null
    const humanMsgs = turns.filter((t) => t.role === "human")
    const aiMsgs = turns.filter((t) => t.role === "assistant")
    const startLine = lines.find((l) => l.payload?.cwd)
    const projectPath = startLine?.payload?.cwd || undefined
    const project = projectPath ? path.basename(projectPath) : path.basename(path.dirname(filePath))
    const projectDescription = projectPath ? extractProjectDescription(projectPath) || undefined : undefined

    return {
      id: path.basename(filePath, ".jsonl"),
      source: "codex",
      project,
      projectPath,
      projectDescription,
      title: humanMsgs[0]?.content.slice(0, 80) || "Codex session",
      messageCount: turns.length,
      humanMessages: humanMsgs.length,
      aiMessages: aiMsgs.length,
      preview: humanMsgs[0]?.content.slice(0, 200) || "",
      filePath,
      modifiedAt: stats?.mtime || new Date(),
      sizeBytes: stats?.size || 0,
      turns,
    }
  },
}

function extractCodexTurns(lines: CodexLine[]): ConversationTurn[] {
  const turns: ConversationTurn[] = []
  for (const line of lines) {
    if (!line.payload || line.payload.type !== "message") continue
    const textParts = (line.payload.content || []).filter((c) => c.text).map((c) => c.text || "").filter(Boolean)
    const content = textParts.join("\n").trim()
    if (!content) continue
    if (line.payload.role === "developer" || line.payload.role === "system") continue
    if (
      line.payload.role === "user" &&
      (content.startsWith("# AGENTS.md") ||
        content.startsWith("<environment_context>") ||
        content.startsWith("<permissions") ||
        content.startsWith("<app-context>") ||
        content.startsWith("<collaboration_mode>"))
    )
      continue
    turns.push({
      role: line.payload.role === "user" ? "human" : "assistant",
      content,
      timestamp: line.timestamp ? new Date(line.timestamp) : undefined,
    })
  }
  return turns
}
