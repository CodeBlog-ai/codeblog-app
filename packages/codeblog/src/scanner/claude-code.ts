import * as path from "path"
import * as fs from "fs"
import type { Scanner, Session, ParsedSession, ConversationTurn } from "./types"
import { getHome, getPlatform } from "./platform"
import { listFiles, listDirs, safeStats, readJsonl, extractProjectDescription } from "./fs-utils"

interface ClaudeMessage {
  type: string
  cwd?: string
  message?: {
    role?: string
    content?: string | Array<{ type: string; text?: string }>
  }
  timestamp?: string
}

export const claudeCodeScanner: Scanner = {
  name: "Claude Code",
  sourceType: "claude-code",
  description: "Claude Code CLI sessions (~/.claude/projects/)",

  getSessionDirs(): string[] {
    const home = getHome()
    const candidates = [path.join(home, ".claude", "projects")]
    return candidates.filter((d) => {
      try { return fs.existsSync(d) } catch { return false }
    })
  },

  scan(limit: number): Session[] {
    const sessions: Session[] = []
    const dirs = this.getSessionDirs()

    for (const baseDir of dirs) {
      const projectDirs = listDirs(baseDir)
      for (const projectDir of projectDirs) {
        const project = path.basename(projectDir)
        const files = listFiles(projectDir, [".jsonl"])

        for (const filePath of files) {
          const stats = safeStats(filePath)
          if (!stats) continue

          const lines = readJsonl<ClaudeMessage>(filePath)
          if (lines.length < 3) continue

          const humanMsgs = lines.filter((l) => l.type === "user")
          const aiMsgs = lines.filter((l) => l.type === "assistant")

          const cwdLine = lines.find((l) => l.cwd)
          let projectPath = cwdLine?.cwd || null

          if (!projectPath && project.startsWith("-")) {
            projectPath = decodeClaudeProjectDir(project)
          }
          const projectName = projectPath ? path.basename(projectPath) : project

          const projectDescription = projectPath ? extractProjectDescription(projectPath) : null

          let preview = ""
          for (const msg of humanMsgs.slice(0, 8)) {
            const content = extractContent(msg)
            if (!content || content.length < 10) continue
            if (content.startsWith("<local-command-caveat>")) continue
            if (content.startsWith("<environment_context>")) continue
            if (content.startsWith("<command-name>")) continue
            preview = content.slice(0, 200)
            break
          }

          sessions.push({
            id: path.basename(filePath, ".jsonl"),
            source: "claude-code",
            project: projectName,
            projectPath: projectPath || undefined,
            projectDescription: projectDescription || undefined,
            title: preview.slice(0, 80) || `Claude session in ${projectName}`,
            messageCount: humanMsgs.length + aiMsgs.length,
            humanMessages: humanMsgs.length,
            aiMessages: aiMsgs.length,
            preview: preview || "(no preview)",
            filePath,
            modifiedAt: stats.mtime,
            sizeBytes: stats.size,
          })
        }
      }
    }

    sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
    return sessions.slice(0, limit)
  },

  parse(filePath: string, maxTurns?: number): ParsedSession | null {
    const lines = readJsonl<ClaudeMessage>(filePath)
    if (lines.length === 0) return null

    const stats = safeStats(filePath)
    const turns: ConversationTurn[] = []

    const cwdLine = lines.find((l) => l.cwd)
    const projectPath = cwdLine?.cwd || undefined
    const projectName = projectPath ? path.basename(projectPath) : path.basename(path.dirname(filePath))
    const projectDescription = projectPath ? extractProjectDescription(projectPath) || undefined : undefined

    for (const line of lines) {
      if (maxTurns && turns.length >= maxTurns) break
      if (line.type !== "user" && line.type !== "assistant") continue
      const content = extractContent(line)
      if (!content) continue
      turns.push({
        role: line.type === "user" ? "human" : "assistant",
        content,
        timestamp: line.timestamp ? new Date(line.timestamp) : undefined,
      })
    }

    const humanMsgs = turns.filter((t) => t.role === "human")
    const aiMsgs = turns.filter((t) => t.role === "assistant")

    return {
      id: path.basename(filePath, ".jsonl"),
      source: "claude-code",
      project: projectName,
      projectPath,
      projectDescription,
      title: humanMsgs[0]?.content.slice(0, 80) || "Claude session",
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

function decodeClaudeProjectDir(dirName: string): string | null {
  const platform = getPlatform()
  const stripped = dirName.startsWith("-") ? dirName.slice(1) : dirName
  const parts = stripped.split("-")
  let currentPath = ""
  let i = 0

  const first = parts[0]
  if (platform === "windows" && first && /^[a-zA-Z]$/.test(first)) {
    currentPath = first.toUpperCase() + ":"
    i = 1
  }

  while (i < parts.length) {
    let bestMatch = ""
    let bestLen = 0
    for (let end = parts.length; end > i; end--) {
      const segment = parts.slice(i, end).join("-")
      const candidate = currentPath + path.sep + segment
      try {
        if (fs.existsSync(candidate)) {
          bestMatch = candidate
          bestLen = end - i
          break
        }
      } catch { /* ignore */ }
    }
    if (bestLen > 0) {
      currentPath = bestMatch
      i += bestLen
    } else {
      const segment = parts[i]
      currentPath += path.sep + (segment || "")
      i++
    }
  }

  return currentPath || null
}

function extractContent(msg: ClaudeMessage): string {
  if (!msg.message?.content) return ""
  if (typeof msg.message.content === "string") return msg.message.content
  if (Array.isArray(msg.message.content)) {
    return msg.message.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n")
  }
  return ""
}
