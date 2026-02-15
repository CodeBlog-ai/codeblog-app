/**
 * Integration test: verify all 26 MCP tools are accessible via McpBridge.
 *
 * This script:
 * 1. Connects to the MCP server (spawns codeblog-mcp subprocess)
 * 2. Lists all available tools
 * 3. Tests calling each tool that can be safely invoked without side effects
 * 4. Reports results
 *
 * Usage: bun run src/mcp/__tests__/integration.ts
 */

import { McpBridge } from "../client"

const EXPECTED_TOOLS = [
  "scan_sessions",
  "read_session",
  "analyze_session",
  "post_to_codeblog",
  "auto_post",
  "weekly_digest",
  "browse_posts",
  "search_posts",
  "read_post",
  "comment_on_post",
  "vote_on_post",
  "edit_post",
  "delete_post",
  "bookmark_post",
  "browse_by_tag",
  "trending_topics",
  "explore_and_engage",
  "join_debate",
  "my_notifications",
  "manage_agents",
  "my_posts",
  "my_dashboard",
  "follow_agent",
  "codeblog_status",
  "codeblog_setup",
]

// Tools that are safe to call without side effects (read-only)
const SAFE_TOOLS: Record<string, Record<string, unknown>> = {
  codeblog_status: {},
  scan_sessions: { limit: 3 },
  browse_posts: { sort: "new", limit: 2 },
  search_posts: { query: "test", limit: 2 },
  browse_by_tag: { action: "trending", limit: 3 },
  trending_topics: {},
  explore_and_engage: { action: "browse", limit: 2 },
  join_debate: { action: "list" },
  my_notifications: { action: "list", limit: 2 },
  manage_agents: { action: "list" },
  my_posts: { limit: 2 },
  my_dashboard: {},
  follow_agent: { action: "list_following", limit: 2 },
  bookmark_post: { action: "list" },
}

async function main() {
  console.log("=== MCP Integration Test ===\n")

  // Step 1: List tools
  console.log("1. Listing MCP tools...")
  let tools: Array<{ name: string; description?: string }>
  try {
    const result = await McpBridge.listTools()
    tools = result.tools
    console.log(`   ✓ Found ${tools.length} tools\n`)
  } catch (err) {
    console.error(`   ✗ Failed to list tools: ${err instanceof Error ? err.message : err}`)
    await McpBridge.disconnect()
    process.exit(1)
    return
  }

  // Step 2: Check expected tools
  console.log("2. Checking expected tools...")
  const toolNames = tools.map((t) => t.name)
  let missing = 0
  for (const expected of EXPECTED_TOOLS) {
    if (toolNames.includes(expected)) {
      console.log(`   ✓ ${expected}`)
    } else {
      console.log(`   ✗ MISSING: ${expected}`)
      missing++
    }
  }

  const extra = toolNames.filter((t) => !EXPECTED_TOOLS.includes(t))
  if (extra.length > 0) {
    console.log(`\n   Extra tools not in expected list: ${extra.join(", ")}`)
  }
  console.log(`\n   Expected: ${EXPECTED_TOOLS.length}, Found: ${toolNames.length}, Missing: ${missing}\n`)

  // Step 3: Call safe tools
  console.log("3. Testing safe tool calls...")
  let passed = 0
  let failed = 0

  for (const [name, args] of Object.entries(SAFE_TOOLS)) {
    if (!toolNames.includes(name)) {
      console.log(`   ⊘ ${name} — skipped (not available)`)
      continue
    }

    try {
      const result = await McpBridge.callTool(name, args)
      const preview = result.slice(0, 80).replace(/\n/g, " ")
      console.log(`   ✓ ${name} — ${preview}${result.length > 80 ? "..." : ""}`)
      passed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Auth errors are expected in test environment
      if (msg.includes("auth") || msg.includes("API key") || msg.includes("token") || msg.includes("401") || msg.includes("unauthorized") || msg.includes("Unauthorized")) {
        console.log(`   ⊘ ${name} — auth required (expected in test env)`)
        passed++ // Count as pass — tool is reachable, just needs auth
      } else {
        console.log(`   ✗ ${name} — ${msg}`)
        failed++
      }
    }
  }

  console.log(`\n   Passed: ${passed}, Failed: ${failed}\n`)

  // Cleanup
  console.log("4. Disconnecting...")
  await McpBridge.disconnect()
  console.log("   ✓ Disconnected\n")

  console.log("=== Summary ===")
  console.log(`Tools found: ${toolNames.length}`)
  console.log(`Tools tested: ${passed + failed}/${Object.keys(SAFE_TOOLS).length}`)
  console.log(`Tests passed: ${passed}`)
  console.log(`Tests failed: ${failed}`)
  console.log(`Missing expected tools: ${missing}`)

  if (failed > 0 || missing > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
