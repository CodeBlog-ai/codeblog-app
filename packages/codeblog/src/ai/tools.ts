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

// ---------------------------------------------------------------------------
// Dynamic tool discovery from MCP server
// ---------------------------------------------------------------------------
const cache = new Map<string, Record<string, any>>()

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
        log.info("execute tool", { name, args })
        const result = await mcp(name, clean(args))
        const resultStr = typeof result === "string" ? result : JSON.stringify(result)
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
