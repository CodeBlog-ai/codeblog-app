import * as path from "path"
import * as fs from "fs"
import { Database as BunDatabase, type SQLQueryBindings } from "bun:sqlite"
import type { Scanner, Session, ParsedSession, ConversationTurn } from "./types"
import { getHome, getPlatform } from "./platform"
import { listFiles, listDirs, safeReadFile, safeReadJson, safeStats, extractProjectDescription } from "./fs-utils"

const VSCDB_SEP = "|"

function makeVscdbPath(dbPath: string, composerId: string): string {
  return `vscdb:${dbPath}${VSCDB_SEP}${composerId}`
}

function parseVscdbVirtualPath(virtualPath: string): { dbPath: string; composerId: string } | null {
  const prefix = "vscdb:"
  if (!virtualPath.startsWith(prefix)) return null
  const rest = virtualPath.slice(prefix.length)
  const sepIdx = rest.lastIndexOf(VSCDB_SEP)
  if (sepIdx <= 0) return null
  return { dbPath: rest.slice(0, sepIdx), composerId: rest.slice(sepIdx + 1) }
}

function withDb<T>(dbPath: string, fn: (db: BunDatabase) => T, fallback: T): T {
  // Try immutable mode first (works when Cursor has the DB locked)
  try {
    const uri = "file:" + encodeURI(dbPath) + "?immutable=1"
    const db = new BunDatabase(uri)
    try { return fn(db) } finally { db.close() }
  } catch { /* fall through */ }
  // Fallback to readonly
  try {
    const db = new BunDatabase(dbPath, { readonly: true })
    try { return fn(db) } finally { db.close() }
  } catch {
    return fallback
  }
}

function safeQueryDb<T>(db: BunDatabase, sql: string, params: SQLQueryBindings[] = []): T[] {
  try {
    return db.prepare(sql).all(...params) as T[]
  } catch (err) {
    console.error(`[codeblog] Cursor query error:`, err instanceof Error ? err.message : err)
    return []
  }
}

function getGlobalStoragePath(): string | null {
  const home = getHome()
  const platform = getPlatform()
  let p: string
  if (platform === "macos") {
    p = path.join(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb")
  } else if (platform === "windows") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming")
    p = path.join(appData, "Cursor", "User", "globalStorage", "state.vscdb")
  } else {
    p = path.join(home, ".config", "Cursor", "User", "globalStorage", "state.vscdb")
  }
  try { return fs.existsSync(p) ? p : null } catch { return null }
}

interface CursorChatSession {
  version?: number
  requests: Array<{ message: string; response?: string | unknown[] }>
  sessionId?: string
}

interface CursorComposerData {
  composerId?: string
  name?: string
  createdAt?: number
  lastUpdatedAt?: number
  fullConversationHeadersOnly?: Array<{ bubbleId: string; type: number }>
}

export const cursorScanner: Scanner = {
  name: "Cursor",
  sourceType: "cursor",
  description: "Cursor AI IDE sessions (agent transcripts + chat sessions + composer)",

  getSessionDirs(): string[] {
    const home = getHome()
    const platform = getPlatform()
    const candidates: string[] = [path.join(home, ".cursor", "projects")]

    if (platform === "macos") {
      candidates.push(path.join(home, "Library", "Application Support", "Cursor", "User", "workspaceStorage"))
    } else if (platform === "windows") {
      const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming")
      candidates.push(path.join(appData, "Cursor", "User", "workspaceStorage"))
    } else {
      candidates.push(path.join(home, ".config", "Cursor", "User", "workspaceStorage"))
    }

    const globalDb = getGlobalStoragePath()
    if (globalDb) candidates.push(path.dirname(globalDb))

    return candidates.filter((d) => {
      try { return fs.existsSync(d) } catch { return false }
    })
  },

  scan(limit: number): Session[] {
    const sessions: Session[] = []
    const dirs = this.getSessionDirs()
    const seenIds = new Set<string>()

    for (const baseDir of dirs) {
      if (baseDir.endsWith("globalStorage")) continue
      const projectDirs = listDirs(baseDir)
      for (const projectDir of projectDirs) {
        const dirName = path.basename(projectDir)
        let projectPath: string | undefined
        const workspaceJson = safeReadJson<{ folder?: string }>(path.join(projectDir, "workspace.json"))
        if (workspaceJson?.folder) {
          try { projectPath = decodeURIComponent(new URL(workspaceJson.folder).pathname) } catch { /* */ }
        }
        const project = projectPath ? path.basename(projectPath) : dirName
        const projectDescription = projectPath ? extractProjectDescription(projectPath) || undefined : undefined

        // FORMAT 1: agent-transcripts
        for (const filePath of listFiles(path.join(projectDir, "agent-transcripts"), [".txt"])) {
          const stats = safeStats(filePath)
          if (!stats) continue
          const content = safeReadFile(filePath)
          if (!content || content.length < 100) continue
          const userQueries = content.match(/<user_query>\n?([\s\S]*?)\n?<\/user_query>/g) || []
          if (userQueries.length === 0) continue
          const firstQuery = content.match(/<user_query>\n?([\s\S]*?)\n?<\/user_query>/)
          const queryText = firstQuery?.[1] || ""
          const preview = queryText ? queryText.trim().slice(0, 200) : content.slice(0, 200)
          const id = path.basename(filePath, ".txt")
          seenIds.add(id)
          sessions.push({
            id, source: "cursor", project, projectPath, projectDescription,
            title: preview.slice(0, 80) || `Cursor session in ${project}`,
            messageCount: userQueries.length * 2, humanMessages: userQueries.length, aiMessages: userQueries.length,
            preview, filePath, modifiedAt: stats.mtime, sizeBytes: stats.size,
          })
        }

        // FORMAT 2: chatSessions
        for (const filePath of listFiles(path.join(projectDir, "chatSessions"), [".json"])) {
          const stats = safeStats(filePath)
          if (!stats || stats.size < 100) continue
          const data = safeReadJson<CursorChatSession>(filePath)
          if (!data || !Array.isArray(data.requests) || data.requests.length === 0) continue
          const humanCount = data.requests.length
          const firstMsg = data.requests[0]?.message || ""
          const preview = (typeof firstMsg === "string" ? firstMsg : "").slice(0, 200)
          const id = data.sessionId || path.basename(filePath, ".json")
          seenIds.add(id)
          sessions.push({
            id, source: "cursor", project, projectPath, projectDescription,
            title: preview.slice(0, 80) || `Cursor chat in ${project}`,
            messageCount: humanCount * 2, humanMessages: humanCount, aiMessages: humanCount,
            preview: preview || "(cursor chat session)", filePath, modifiedAt: stats.mtime, sizeBytes: stats.size,
          })
        }
      }
    }

    // FORMAT 3: globalStorage state.vscdb
    const globalDb = getGlobalStoragePath()
    if (globalDb) {
      withDb(globalDb, (db) => {
        const rows = safeQueryDb<{ key: string; value: string }>(
          db, "SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'",
        )
        for (const row of rows) {
          try {
            const data = JSON.parse(row.value) as CursorComposerData
            const composerId = data.composerId || row.key.replace("composerData:", "")
            if (seenIds.has(composerId)) continue
            const bubbleHeaders = data.fullConversationHeadersOnly || []
            if (bubbleHeaders.length === 0) continue
            const humanCount = bubbleHeaders.filter((b) => b.type === 1).length
            const aiCount = bubbleHeaders.filter((b) => b.type === 2).length
            let preview = data.name || ""
            if (!preview) {
              const firstUserBubble = bubbleHeaders.find((b) => b.type === 1)
              if (firstUserBubble) {
                const bubbleRow = safeQueryDb<{ value: string }>(
                  db, "SELECT value FROM cursorDiskKV WHERE key = ?",
                  [`bubbleId:${composerId}:${firstUserBubble.bubbleId}`],
                )
                if (bubbleRow.length > 0) {
                  const firstBubble = bubbleRow[0]
                  if (!firstBubble) continue
                  try {
                    const bubble = JSON.parse(firstBubble.value)
                    preview = (bubble.text || bubble.message || "").slice(0, 200)
                  } catch { /* */ }
                }
              }
            }
            const createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
            const updatedAt = data.lastUpdatedAt ? new Date(data.lastUpdatedAt) : createdAt
            sessions.push({
              id: composerId, source: "cursor", project: "Cursor Composer",
              title: (data.name || preview || "Cursor composer session").slice(0, 80),
              messageCount: humanCount + aiCount, humanMessages: humanCount, aiMessages: aiCount,
              preview: preview || "(composer session)",
              filePath: makeVscdbPath(globalDb, composerId), modifiedAt: updatedAt, sizeBytes: row.value.length,
            })
          } catch { /* skip */ }
        }
      }, undefined)
    }

    sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
    return sessions.slice(0, limit)
  },

  parse(filePath: string, maxTurns?: number): ParsedSession | null {
    if (filePath.startsWith("vscdb:")) return parseVscdbSession(filePath, maxTurns)
    const stats = safeStats(filePath)
    const turns: ConversationTurn[] = []

    if (filePath.endsWith(".txt")) {
      const content = safeReadFile(filePath)
      if (!content) return null
      const blocks = content.split(/^user:\s*$/m)
      for (const block of blocks) {
        if (!block.trim()) continue
        if (maxTurns && turns.length >= maxTurns) break
        const queryMatch = block.match(/<user_query>\n?([\s\S]*?)\n?<\/user_query>/)
        const query = queryMatch?.[1]
        if (query) turns.push({ role: "human", content: query.trim() })
        const afterQuery = block.split(/<\/user_query>/)[1]
        if (afterQuery) {
          const aiContent = afterQuery.replace(/^\s*\n\s*A:\s*\n?/, "").trim()
          if (aiContent && (!maxTurns || turns.length < maxTurns)) turns.push({ role: "assistant", content: aiContent })
        }
      }
    } else {
      const data = safeReadJson<CursorChatSession>(filePath)
      if (!data || !Array.isArray(data.requests)) return null
      for (const req of data.requests) {
        if (maxTurns && turns.length >= maxTurns) break
        if (req.message) turns.push({ role: "human", content: typeof req.message === "string" ? req.message : JSON.stringify(req.message) })
        if (maxTurns && turns.length >= maxTurns) break
        if (req.response) {
          let respText = ""
          if (typeof req.response === "string") respText = req.response
          else if (Array.isArray(req.response)) {
            respText = req.response.map((r: unknown) => (typeof r === "string" ? r : (r as Record<string, unknown>)?.text || "")).join("")
          }
          if (respText.trim()) turns.push({ role: "assistant", content: respText.trim() })
        }
      }
    }

    if (turns.length === 0) return null
    const humanMsgs = turns.filter((t) => t.role === "human")
    const aiMsgs = turns.filter((t) => t.role === "assistant")
    return {
      id: path.basename(filePath).replace(/\.\w+$/, ""), source: "cursor",
      project: path.basename(path.dirname(filePath)),
      title: humanMsgs[0]?.content.slice(0, 80) || "Cursor session",
      messageCount: turns.length, humanMessages: humanMsgs.length, aiMessages: aiMsgs.length,
      preview: humanMsgs[0]?.content.slice(0, 200) || "",
      filePath, modifiedAt: stats?.mtime || new Date(), sizeBytes: stats?.size || 0, turns,
    }
  },
}

function parseVscdbSession(virtualPath: string, maxTurns?: number): ParsedSession | null {
  const parsed = parseVscdbVirtualPath(virtualPath)
  if (!parsed) return null
  return withDb(parsed.dbPath, (db) => {
    const metaRows = safeQueryDb<{ value: string }>(db, "SELECT value FROM cursorDiskKV WHERE key = ?", [`composerData:${parsed.composerId}`])
    if (metaRows.length === 0) return null
    const firstMeta = metaRows[0]
    if (!firstMeta) return null
    let composerData: CursorComposerData
    try { composerData = JSON.parse(firstMeta.value) } catch { return null }
    const bubbleHeaders = composerData.fullConversationHeadersOnly || []
    if (bubbleHeaders.length === 0) return null
    const turns: ConversationTurn[] = []
    for (const header of bubbleHeaders) {
      if (maxTurns && turns.length >= maxTurns) break
      const bubbleRows = safeQueryDb<{ value: string }>(db, "SELECT value FROM cursorDiskKV WHERE key = ?", [`bubbleId:${parsed.composerId}:${header.bubbleId}`])
      if (bubbleRows.length === 0) continue
      const firstBubble = bubbleRows[0]
      if (!firstBubble) continue
      try {
        const bubble = JSON.parse(firstBubble.value)
        const text = bubble.text || bubble.message || bubble.rawText || ""
        if (!text && header.type === 2) { turns.push({ role: "assistant", content: "(AI response)" }); continue }
        turns.push({ role: header.type === 1 ? "human" : "assistant", content: text || "(empty)" })
      } catch { /* skip */ }
    }
    if (turns.length === 0) return null
    const humanMsgs = turns.filter((t) => t.role === "human")
    const aiMsgs = turns.filter((t) => t.role === "assistant")
    return {
      id: parsed.composerId, source: "cursor" as const, project: "Cursor Composer",
      title: composerData.name || humanMsgs[0]?.content.slice(0, 80) || "Cursor session",
      messageCount: turns.length, humanMessages: humanMsgs.length, aiMessages: aiMsgs.length,
      preview: humanMsgs[0]?.content.slice(0, 200) || "",
      filePath: virtualPath, modifiedAt: composerData.lastUpdatedAt ? new Date(composerData.lastUpdatedAt) : new Date(),
      sizeBytes: 0, turns,
    } as ParsedSession
  }, null)
}
