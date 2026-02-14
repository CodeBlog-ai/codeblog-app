import { Database as BunDatabase } from "bun:sqlite"
import { Global } from "../global"
import path from "path"

function db() {
  const dbpath = path.join(Global.Path.data, "codeblog.db")
  const sqlite = new BunDatabase(dbpath, { create: true })
  sqlite.run("PRAGMA journal_mode = WAL")
  sqlite.run("PRAGMA foreign_keys = ON")

  sqlite.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    time_created INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    time_updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`)

  sqlite.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_name TEXT,
    tool_status TEXT,
    time_created INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`)

  return sqlite
}

export interface ChatMsg {
  role: "user" | "assistant" | "tool"
  content: string
  toolName?: string
  toolStatus?: "running" | "done" | "error"
}

export namespace ChatHistory {
  export function create(id: string, title?: string) {
    const d = db()
    d.run("INSERT OR REPLACE INTO chat_sessions (id, title, time_created, time_updated) VALUES (?, ?, ?, ?)", [id, title || null, Date.now(), Date.now()])
    d.close()
  }

  export function save(sessionId: string, messages: ChatMsg[]) {
    const d = db()
    d.run("DELETE FROM chat_messages WHERE session_id = ?", [sessionId])
    const stmt = d.prepare("INSERT INTO chat_messages (session_id, role, content, tool_name, tool_status, time_created) VALUES (?, ?, ?, ?, ?, ?)")
    for (const m of messages) {
      stmt.run(sessionId, m.role, m.content, m.toolName || null, m.toolStatus || null, Date.now())
    }
    // Update session title from first user message
    const first = messages.find((m) => m.role === "user")
    if (first) {
      const title = first.content.slice(0, 80)
      d.run("UPDATE chat_sessions SET title = ?, time_updated = ? WHERE id = ?", [title, Date.now(), sessionId])
    }
    d.close()
  }

  export function load(sessionId: string): ChatMsg[] {
    const d = db()
    const rows = d.query("SELECT role, content, tool_name, tool_status FROM chat_messages WHERE session_id = ? ORDER BY id ASC").all(sessionId) as any[]
    d.close()
    return rows.map((r) => ({
      role: r.role,
      content: r.content,
      ...(r.tool_name ? { toolName: r.tool_name } : {}),
      ...(r.tool_status ? { toolStatus: r.tool_status } : {}),
    }))
  }

  export function list(limit = 20): Array<{ id: string; title: string | null; time: number; count: number }> {
    const d = db()
    const rows = d.query(`
      SELECT s.id, s.title, s.time_updated as time,
        (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as count
      FROM chat_sessions s
      ORDER BY s.time_updated DESC
      LIMIT ?
    `).all(limit) as any[]
    d.close()
    return rows.map((r) => ({ id: r.id, title: r.title, time: r.time, count: r.count }))
  }

  export function remove(sessionId: string) {
    const d = db()
    d.run("DELETE FROM chat_messages WHERE session_id = ?", [sessionId])
    d.run("DELETE FROM chat_sessions WHERE id = ?", [sessionId])
    d.close()
  }
}
