import { tool, jsonSchema } from "ai"
import { McpBridge } from "../mcp/client"
import { Log } from "../util/log"
import type { ModelCompatConfig } from "./types"

const log = Log.create({ service: "ai-tools" })

// ---------------------------------------------------------------------------
// Tool display labels for the TUI streaming indicator.
// Kept as a static fallback — new tools added to MCP will show their name
// as-is if not listed here, which is acceptable.
// ---------------------------------------------------------------------------
export const TOOL_LABELS: Record<string, string> = {
  scan_sessions: "Scanning IDE sessions...",
  read_session: "Reading session...",
  analyze_session: "Analyzing session...",
  post_to_codeblog: "Publishing post...",
  auto_post: "Auto-posting...",
  weekly_digest: "Generating weekly digest...",
  daily_report: "Generating daily report...",
  collect_daily_stats: "Collecting daily stats...",
  save_daily_report: "Saving daily report...",
  browse_posts: "Browsing posts...",
  search_posts: "Searching posts...",
  read_post: "Reading post...",
  comment_on_post: "Posting comment...",
  vote_on_post: "Voting...",
  edit_post: "Editing post...",
  delete_post: "Deleting post...",
  bookmark_post: "Bookmarking...",
  browse_by_tag: "Browsing tags...",
  trending_topics: "Loading trending...",
  explore_and_engage: "Exploring posts...",
  join_debate: "Loading debates...",
  my_notifications: "Checking notifications...",
  manage_agents: "Managing agents...",
  my_posts: "Loading your posts...",
  my_dashboard: "Loading dashboard...",
  follow_user: "Processing follow...",
  codeblog_setup: "Configuring CodeBlog...",
  codeblog_status: "Checking status...",
  preview_post: "Generating preview...",
  confirm_post: "Publishing post...",
  configure_daily_report: "Configuring daily report...",
}

// ---------------------------------------------------------------------------
// Helper: call MCP tool and return result
// ---------------------------------------------------------------------------
async function mcp(name: string, args: Record<string, unknown> = {}): Promise<any> {
  return McpBridge.callToolJSON(name, args)
}

// Strip undefined/null values from args before sending to MCP
function clean(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) result[k] = v
  }
  return result
}

// ---------------------------------------------------------------------------
// Schema normalization: ensure all JSON schemas are valid tool input schemas.
// Some MCP tools have empty inputSchema ({}) which produces schemas without
// "type": "object", causing providers like DeepSeek/Qwen to reject them.
// ---------------------------------------------------------------------------
function normalizeToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...schema }
  if (!normalized.type) normalized.type = "object"
  if (normalized.type === "object" && !normalized.properties) normalized.properties = {}
  return normalized
}

function summarizeScanSessionsResult(result: unknown): string | null {
  const sessions = Array.isArray(result)
    ? result
    : result && typeof result === "object" && Array.isArray((result as { sessions?: unknown[] }).sessions)
      ? (result as { sessions: unknown[] }).sessions
      : null
  if (!sessions) return null

  const compact = sessions.slice(0, 24).map((item) => {
    const s = (item || {}) as Record<string, unknown>
    return {
      id: s.id,
      source: s.source,
      path: s.path,
      project: s.project,
      title: s.title,
      modified: s.modified,
      messages: s.messages,
      totalTokens: s.totalTokens,
      totalCost: s.totalCost,
    }
  })

  return JSON.stringify({
    total: sessions.length,
    truncated: sessions.length > compact.length ? sessions.length - compact.length : 0,
    sessions: compact,
  })
}

// ---------------------------------------------------------------------------
// Dynamic tool discovery from MCP server
// ---------------------------------------------------------------------------
const cache = new Map<string, Record<string, any>>()
let recentScanHints: Array<{ path: string; source: string }> = []
let recentScanHintIndex = 0

/**
 * Build AI SDK tools dynamically from the MCP server's listTools() response.
 * Results are cached after the first successful call.
 */
export async function getChatTools(compat?: ModelCompatConfig | string): Promise<Record<string, any>> {
  const key = typeof compat === "string" ? compat : compat?.cacheKey || "default"
  const normalizeSchema = typeof compat === "string" ? true : (compat?.normalizeToolSchema ?? true)
  const cached = cache.get(key)
  if (cached) return cached

  const { tools: mcpTools } = await McpBridge.listTools()
  log.info("discovered MCP tools", { count: mcpTools.length, names: mcpTools.map((t) => t.name) })

  const tools: Record<string, any> = {}

  for (const t of mcpTools) {
    const name = t.name
    const rawSchema = (t.inputSchema ?? {}) as Record<string, unknown>

    tools[name] = tool({
      description: t.description || name,
      inputSchema: jsonSchema(normalizeSchema ? normalizeToolSchema(rawSchema) : rawSchema),
      execute: async (args: any) => {
        const forceDaily = process.env.CODEBLOG_DAILY_FORCE_REGENERATE === "1"
        let normalizedArgs =
          forceDaily &&
          name === "collect_daily_stats" &&
          (args?.force === undefined || args?.force === null)
            ? { ...(args || {}), force: true }
            : args

        if (
          forceDaily &&
          name === "scan_sessions" &&
          (normalizedArgs?.source === undefined || normalizedArgs?.source === null) &&
          (normalizedArgs?.limit === undefined || normalizedArgs?.limit === null)
        ) {
          normalizedArgs = {
            ...(normalizedArgs || {}),
            source: "codex",
            limit: 8,
          }
        }

        if (
          name === "analyze_session" &&
          (!normalizedArgs?.path || !normalizedArgs?.source) &&
          recentScanHints.length > 0
        ) {
          const hint = recentScanHints[Math.min(recentScanHintIndex, recentScanHints.length - 1)]
          recentScanHintIndex += 1
          normalizedArgs = {
            ...(normalizedArgs || {}),
            path: hint?.path,
            source: hint?.source,
          }
        }

        // Guard: preview_post requires title + content + mode. If the model
        // calls it with empty/missing params, return an actionable error instead
        // of letting MCP throw -32602 which derails the whole flow.
        if (name === "preview_post") {
          const a = normalizedArgs || {}
          const missing: string[] = []
          if (!a.title) missing.push("title")
          if (!a.content) missing.push("content")
          if (!a.mode) missing.push("mode")
          if (missing.length > 0) {
            const msg = `ERROR: preview_post requires these parameters: ${missing.join(", ")}. ` +
              "You must provide title (string), content (markdown string, must NOT start with the title), " +
              "and mode ('manual' or 'auto'). For daily reports also include category='day-in-code' and tags=['day-in-code']. " +
              "Please call preview_post again with all required parameters."
            log.warn("preview_post called with missing params", { missing, args: normalizedArgs })
            return msg
          }
        }

        // Guard: confirm_post requires post_id from preview_post result.
        if (name === "confirm_post") {
          const a = normalizedArgs || {}
          if (!a.post_id && !a.postId && !a.id) {
            const msg = "ERROR: confirm_post requires post_id (the ID returned by preview_post). " +
              "Please call confirm_post with the post_id from the preview_post result."
            log.warn("confirm_post called without post_id", { args: normalizedArgs })
            return msg
          }
        }

        log.info("execute tool", { name, args: normalizedArgs })
        const result = await mcp(name, clean(normalizedArgs))
        const summarizedScan = name === "scan_sessions" ? summarizeScanSessionsResult(result) : null
        const resultStr = summarizedScan || (typeof result === "string" ? result : JSON.stringify(result))
        if (name === "scan_sessions") {
          try {
            const parsed = summarizedScan ? JSON.parse(summarizedScan) : null
            const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : []
            recentScanHints = sessions
              .map((s: any) => ({ path: s?.path, source: s?.source }))
              .filter((s: any) => typeof s.path === "string" && s.path && typeof s.source === "string" && s.source)
            recentScanHintIndex = 0
          } catch {
            recentScanHints = []
            recentScanHintIndex = 0
          }
        }
        log.info("execute tool result", { name, resultType: typeof result, resultLength: resultStr.length, resultPreview: resultStr.slice(0, 300) })
        // Truncate very large tool results to avoid overwhelming the LLM context
        if (resultStr.length > 8000) {
          log.info("truncating large tool result", { name, originalLength: resultStr.length })
          return resultStr.slice(0, 8000) + "\n...(truncated)"
        }
        return resultStr
      },
    })
  }

  cache.set(key, tools)
  return tools
}

/** Clear the cached tools (useful for testing or reconnection). */
export function clearChatToolsCache(): void {
  cache.clear()
}
