import { Database } from "./db"

export interface ChatMsg {
  role: "user" | "assistant" | "tool" | "system"
  content: string
  modelContent?: string
  tone?: "info" | "success" | "warning" | "error"
  toolName?: string
  toolStatus?: "running" | "done" | "error"
}

function raw() {
  // Access the underlying bun:sqlite instance from Drizzle
  // Tables are already created in db.ts via CREATE TABLE IF NOT EXISTS
  return (Database.Client() as any).$client as import("bun:sqlite").Database
}

export namespace ChatHistory {
  export function create(id: string, title?: string) {
    raw().run(
      "INSERT OR REPLACE INTO chat_sessions (id, title, time_created, time_updated) VALUES (?, ?, ?, ?)",
      [id, title || null, Date.now(), Date.now()],
    )
  }

  export function save(sessionId: string, messages: ChatMsg[]) {
    const d = raw()
    d.run("DELETE FROM chat_messages WHERE session_id = ?", [sessionId])
    const stmt = d.prepare(
      "INSERT INTO chat_messages (session_id, role, content, tool_name, tool_status, time_created) VALUES (?, ?, ?, ?, ?, ?)",
    )
    for (const m of messages) {
      stmt.run(sessionId, m.role, m.content, m.toolName || null, m.toolStatus || null, Date.now())
    }
    // Update session title from first user message
    const first = messages.find((m) => m.role === "user")
    if (first) {
      const title = first.content.slice(0, 80)
      d.run("UPDATE chat_sessions SET title = ?, time_updated = ? WHERE id = ?", [title, Date.now(), sessionId])
    }
  }

  export function load(sessionId: string): ChatMsg[] {
    const rows = raw()
      .query("SELECT role, content, tool_name, tool_status FROM chat_messages WHERE session_id = ? ORDER BY id ASC")
      .all(sessionId) as any[]
    return rows.map((r) => ({
      role: r.role,
      content: r.content,
      ...(r.tool_name ? { toolName: r.tool_name } : {}),
      ...(r.tool_status ? { toolStatus: r.tool_status } : {}),
    }))
  }

  export function list(limit = 20): Array<{ id: string; title: string | null; time: number; count: number }> {
    const rows = raw()
      .query(
        `SELECT s.id, s.title, s.time_updated as time,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as count
        FROM chat_sessions s
        ORDER BY s.time_updated DESC
        LIMIT ?`,
      )
      .all(limit) as any[]
    return rows.map((r) => ({ id: r.id, title: r.title, time: r.time, count: r.count }))
  }

  export function remove(sessionId: string) {
    const d = raw()
    d.run("DELETE FROM chat_messages WHERE session_id = ?", [sessionId])
    d.run("DELETE FROM chat_sessions WHERE id = ?", [sessionId])
  }
}
