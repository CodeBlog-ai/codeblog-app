import * as path from "path"
import * as fs from "fs"
import { Database as BunDatabase } from "bun:sqlite"
import type { Scanner, Session, ParsedSession, ConversationTurn } from "./types"
import { getHome, getPlatform } from "./platform"
import { listDirs, safeReadJson, safeStats, extractProjectDescription } from "./fs-utils"

interface VscdbChatIndex {
  version: number
  entries: Record<string, VscdbChatEntry>
}

interface VscdbChatEntry {
  messages?: Array<{ role?: string; content?: string; text?: string }>
  [key: string]: unknown
}

export const windsurfScanner: Scanner = {
  name: "Windsurf",
  sourceType: "windsurf",
  description: "Windsurf (Codeium) Cascade chat sessions (SQLite)",

  getSessionDirs(): string[] {
    const home = getHome()
    const platform = getPlatform()
    const candidates: string[] = []
    if (platform === "macos") {
      candidates.push(path.join(home, "Library", "Application Support", "Windsurf", "User", "workspaceStorage"))
    } else if (platform === "windows") {
      const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming")
      candidates.push(path.join(appData, "Windsurf", "User", "workspaceStorage"))
    } else {
      candidates.push(path.join(home, ".config", "Windsurf", "User", "workspaceStorage"))
    }
    return candidates.filter((d) => {
      try { return fs.existsSync(d) } catch { return false }
    })
  },

  scan(limit: number): Session[] {
    const sessions: Session[] = []
    for (const baseDir of this.getSessionDirs()) {
      for (const wsDir of listDirs(baseDir)) {
        const dbPath = path.join(wsDir, "state.vscdb")
        if (!fs.existsSync(dbPath)) continue
        const wsJson = safeReadJson<{ folder?: string }>(path.join(wsDir, "workspace.json"))
        let projectPath: string | undefined
        if (wsJson?.folder) {
          try { projectPath = decodeURIComponent(new URL(wsJson.folder).pathname) } catch { /* */ }
        }
        const project = projectPath ? path.basename(projectPath) : path.basename(wsDir)
        const projectDescription = projectPath ? extractProjectDescription(projectPath) || undefined : undefined
        const chatData = readVscdbChatSessions(dbPath)
        if (!chatData || Object.keys(chatData.entries).length === 0) continue
        for (const [sessionId, entry] of Object.entries(chatData.entries)) {
          const messages = extractVscdbMessages(entry)
          if (messages.length < 2) continue
          const humanMsgs = messages.filter((m) => m.role === "human")
          const preview = humanMsgs[0]?.content.slice(0, 200) || "(windsurf session)"
          const dbStats = safeStats(dbPath)
          sessions.push({
            id: sessionId, source: "windsurf", project, projectPath, projectDescription,
            title: preview.slice(0, 80), messageCount: messages.length,
            humanMessages: humanMsgs.length, aiMessages: messages.length - humanMsgs.length,
            preview, filePath: `${dbPath}|${sessionId}`,
            modifiedAt: dbStats?.mtime || new Date(), sizeBytes: dbStats?.size || 0,
          })
        }
      }
    }
    sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
    return sessions.slice(0, limit)
  },

  parse(filePath: string, maxTurns?: number): ParsedSession | null {
    const sepIdx = filePath.lastIndexOf("|")
    const dbPath = sepIdx > 0 ? filePath.slice(0, sepIdx) : filePath
    const targetSessionId = sepIdx > 0 ? filePath.slice(sepIdx + 1) : null
    const chatData = readVscdbChatSessions(dbPath)
    if (!chatData) return null
    const stats = safeStats(dbPath)
    const entries = Object.entries(chatData.entries)
    if (entries.length === 0) return null
    let targetEntry: VscdbChatEntry | null = null
    let targetId = path.basename(path.dirname(dbPath))
    if (targetSessionId && chatData.entries[targetSessionId]) {
      targetEntry = chatData.entries[targetSessionId]
      targetId = targetSessionId
    } else {
      for (const [id, entry] of entries) {
        const msgs = extractVscdbMessages(entry)
        if (msgs.length >= 2) { targetEntry = entry; targetId = id; break }
      }
    }
    if (!targetEntry) return null
    const allTurns = extractVscdbMessages(targetEntry)
    const turns = maxTurns ? allTurns.slice(0, maxTurns) : allTurns
    if (turns.length === 0) return null
    const humanMsgs = turns.filter((t) => t.role === "human")
    const aiMsgs = turns.filter((t) => t.role === "assistant")
    return {
      id: targetId, source: "windsurf", project: path.basename(path.dirname(filePath)),
      title: humanMsgs[0]?.content.slice(0, 80) || "Windsurf session",
      messageCount: turns.length, humanMessages: humanMsgs.length, aiMessages: aiMsgs.length,
      preview: humanMsgs[0]?.content.slice(0, 200) || "",
      filePath: dbPath, modifiedAt: stats?.mtime || new Date(), sizeBytes: stats?.size || 0, turns,
    }
  },
}

function readVscdbChatSessions(dbPath: string): VscdbChatIndex | null {
  try {
    const db = new BunDatabase(dbPath, { readonly: true })
    let row: { value: string | Buffer } | undefined
    try {
      row = db.prepare("SELECT value FROM ItemTable WHERE key = 'chat.ChatSessionStore.index'").get() as any
    } finally { db.close() }
    if (!row?.value) return null
    const valueStr = typeof row.value === "string" ? row.value : (row.value as Buffer).toString("utf-8")
    return JSON.parse(valueStr) as VscdbChatIndex
  } catch { return null }
}

function extractVscdbMessages(entry: VscdbChatEntry): ConversationTurn[] {
  const turns: ConversationTurn[] = []
  if (Array.isArray(entry.messages)) {
    for (const msg of entry.messages) {
      if (!msg || typeof msg !== "object") continue
      const content = msg.content || msg.text
      if (typeof content !== "string" || !content.trim()) continue
      turns.push({ role: msg.role === "user" || msg.role === "human" ? "human" : "assistant", content })
    }
    return turns
  }
  for (const [, value] of Object.entries(entry)) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (!item || typeof item !== "object") continue
      const m = item as Record<string, unknown>
      const content = (m.content || m.text) as string | undefined
      if (typeof content !== "string" || !content.trim()) continue
      turns.push({ role: m.role === "user" || m.role === "human" ? "human" : "assistant", content })
    }
    if (turns.length > 0) return turns
  }
  return turns
}
