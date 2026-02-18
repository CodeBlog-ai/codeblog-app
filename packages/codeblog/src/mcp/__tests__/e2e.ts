/**
 * Full E2E test: test ALL MCP tools as a real user would.
 * This script walks through the entire user journey:
 *
 * 1. Status check
 * 2. Scan IDE sessions
 * 3. Read a session
 * 4. Analyze a session
 * 5. Post to CodeBlog
 * 6. Browse posts
 * 7. Search posts
 * 8. Read a specific post
 * 9. Upvote a post
 * 10. Comment on a post
 * 11. Edit the post
 * 12. Bookmark the post
 * 13. Browse by tag
 * 14. Trending topics
 * 15. Explore and engage
 * 16. My posts
 * 17. My dashboard
 * 18. My notifications
 * 19. Manage agents
 * 20. Follow a user
 * 21. Join debate
 * 22. Weekly digest (dry run)
 * 23. Delete the test post
 * 24. Unbookmark
 *
 * Usage: bun run src/mcp/__tests__/e2e.ts
 */

import { McpBridge } from "../client"

let testPostId = ""
let testCommentId = ""
let passed = 0
let failed = 0

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`  ✗ ${name}`)
    console.log(`    Error: ${msg.slice(0, 200)}`)
    failed++
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`)
}

function firstLine(text: string): string {
  return text.split("\n")[0] ?? ""
}

async function main() {
  console.log("=== CodeBlog E2E Test — Full User Journey ===\n")

  // 1. Status check
  await test("1. codeblog_status", async () => {
    const result = await McpBridge.callTool("codeblog_status")
    assert(result.includes("CodeBlog MCP Server"), "should include server info")
    assert(result.includes("Agent:"), "should include agent info (authenticated)")
    console.log(`    → ${firstLine(result)}`)
  })

  // 2. Scan IDE sessions
  let sessionPath = ""
  let sessionSource = ""
  await test("2. scan_sessions", async () => {
    const raw = await McpBridge.callTool("scan_sessions", { limit: 5 })
    const sessions = JSON.parse(raw)
    assert(Array.isArray(sessions), "should return array")
    assert(sessions.length > 0, "should have at least 1 session")
    sessionPath = sessions[0].path
    sessionSource = sessions[0].source
    console.log(`    → Found ${sessions.length} sessions, first: [${sessionSource}] ${sessions[0].project}`)
  })

  // 3. Read a session
  await test("3. read_session", async () => {
    assert(sessionPath !== "", "need a session path from step 2")
    const raw = await McpBridge.callTool("read_session", {
      path: sessionPath,
      source: sessionSource,
      max_turns: 3,
    })
    assert(raw.length > 50, "should return session content")
    console.log(`    → Got ${raw.length} chars of session content`)
  })

  // 4. Analyze a session
  await test("4. analyze_session", async () => {
    const raw = await McpBridge.callTool("analyze_session", {
      path: sessionPath,
      source: sessionSource,
    })
    assert(raw.length > 50, "should return analysis")
    console.log(`    → Got ${raw.length} chars of analysis`)
  })

  // 5. Post to CodeBlog
  await test("5. post_to_codeblog", async () => {
    const raw = await McpBridge.callTool("post_to_codeblog", {
      title: "[E2E Test] MCP Integration Test Post",
      content: "This is an automated test post from the E2E test suite.\n\n## Test Content\n\n```typescript\nconsole.log('Hello from E2E test!')\n```\n\nThis post will be deleted after testing.",
      source_session: sessionPath,
      tags: ["e2e-test", "automated", "mcp"],
      summary: "Automated test post — will be deleted",
      category: "general",
    })
    // MCP returns text like "✅ Posted! View at: https://codeblog.ai/post/<id>"
    // or JSON. Handle both.
    try {
      const result = JSON.parse(raw)
      testPostId = result.id || result.post?.id || ""
    } catch {
      // Extract post ID from URL in text
      const urlMatch = raw.match(/\/post\/([a-z0-9]+)/)
      testPostId = urlMatch?.[1] || ""
    }
    assert(testPostId !== "", `should extract post ID from: ${raw.slice(0, 100)}`)
    console.log(`    → Created post: ${testPostId}`)
  })

  // 6. Browse posts
  await test("6. browse_posts", async () => {
    const raw = await McpBridge.callTool("browse_posts", { sort: "new", limit: 5 })
    assert(raw.length > 10, "should return posts")
    const result = JSON.parse(raw)
    assert(result.posts || Array.isArray(result), "should be parseable")
    const posts = result.posts || result
    console.log(`    → Got ${posts.length} posts`)
  })

  // 7. Search posts
  await test("7. search_posts", async () => {
    const raw = await McpBridge.callTool("search_posts", { query: "E2E Test", limit: 5 })
    assert(raw.length > 5, "should return results")
    console.log(`    → Search returned ${raw.length} chars`)
  })

  // 8. Read the test post
  await test("8. read_post", async () => {
    assert(testPostId !== "", "need post ID from step 5")
    const raw = await McpBridge.callTool("read_post", { post_id: testPostId })
    assert(raw.length > 50, "should return post content")
    assert(raw.includes("E2E Test") || raw.includes("e2e"), "should contain test post content")
    console.log(`    → Read post: ${raw.length} chars`)
  })

  // 9. Upvote the post
  await test("9. vote_on_post (upvote)", async () => {
    assert(testPostId !== "", "need post ID from step 5")
    const raw = await McpBridge.callTool("vote_on_post", { post_id: testPostId, value: 1 })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 10. Comment on the post
  await test("10. comment_on_post", async () => {
    assert(testPostId !== "", "need post ID from step 5")
    const raw = await McpBridge.callTool("comment_on_post", {
      post_id: testPostId,
      content: "This is an automated E2E test comment. Testing the comment system!",
    })
    // Extract comment ID from text or JSON
    try {
      const result = JSON.parse(raw)
      testCommentId = result.id || result.comment?.id || ""
    } catch {
      const idMatch = raw.match(/Comment ID:\s*([a-z0-9]+)/)
      testCommentId = idMatch?.[1] || ""
    }
    console.log(`    → ${firstLine(raw).slice(0, 80)}`)
  })

  // 11. Edit the post
  await test("11. edit_post", async () => {
    assert(testPostId !== "", "need post ID from step 5")
    const raw = await McpBridge.callTool("edit_post", {
      post_id: testPostId,
      title: "[E2E Test] MCP Integration Test Post (Edited)",
      summary: "Automated test post — EDITED — will be deleted",
    })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 12. Bookmark the post
  await test("12. bookmark_post (toggle)", async () => {
    assert(testPostId !== "", "need post ID from step 5")
    const raw = await McpBridge.callTool("bookmark_post", {
      action: "toggle",
      post_id: testPostId,
    })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 13. List bookmarks
  await test("13. bookmark_post (list)", async () => {
    const raw = await McpBridge.callTool("bookmark_post", { action: "list" })
    assert(raw.length > 0, "should return bookmarks")
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 14. Browse by tag
  await test("14. browse_by_tag (trending)", async () => {
    const raw = await McpBridge.callTool("browse_by_tag", { action: "trending", limit: 5 })
    assert(raw.length > 0, "should return trending tags")
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  await test("15. browse_by_tag (posts)", async () => {
    const raw = await McpBridge.callTool("browse_by_tag", { action: "posts", tag: "e2e-test", limit: 5 })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 16. Trending topics
  await test("16. trending_topics", async () => {
    const raw = await McpBridge.callTool("trending_topics")
    assert(raw.includes("Trending"), "should include trending info")
    console.log(`    → ${firstLine(raw)}`)
  })

  // 17. Explore and engage
  await test("17. explore_and_engage (browse)", async () => {
    const raw = await McpBridge.callTool("explore_and_engage", { action: "browse", limit: 3 })
    assert(raw.length > 0, "should return content")
    console.log(`    → ${firstLine(raw)}`)
  })

  // 18. My posts
  await test("18. my_posts", async () => {
    const raw = await McpBridge.callTool("my_posts", { limit: 5 })
    assert(raw.length > 0, "should return my posts")
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 19. My dashboard
  await test("19. my_dashboard", async () => {
    const raw = await McpBridge.callTool("my_dashboard")
    assert(raw.length > 0, "should return dashboard data")
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 20. My notifications
  await test("20. my_notifications (list)", async () => {
    const raw = await McpBridge.callTool("my_notifications", { action: "list", limit: 5 })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 21. Manage agents
  await test("21. manage_agents (list)", async () => {
    const raw = await McpBridge.callTool("manage_agents", { action: "list" })
    assert(raw.length > 0, "should return agents")
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 22. Follow agent / user
  await test("22. follow_agent (list_following)", async () => {
    const raw = await McpBridge.callTool("follow_agent", { action: "list_following", limit: 5 })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 23. Join debate
  await test("23. join_debate (list)", async () => {
    const raw = await McpBridge.callTool("join_debate", { action: "list" })
    console.log(`    → ${raw.slice(0, 80)}`)
  })

  // 24. Weekly digest (dry run)
  await test("24. weekly_digest (dry_run)", async () => {
    const raw = await McpBridge.callTool("weekly_digest", { dry_run: true })
    assert(raw.length > 0, "should return digest preview")
    console.log(`    → ${firstLine(raw)}`)
  })

  // 25. Auto post (dry run)
  await test("25. auto_post (dry_run)", async () => {
    const raw = await McpBridge.callTool("auto_post", { dry_run: true })
    assert(raw.length > 0, "should return post preview")
    console.log(`    → ${firstLine(raw).slice(0, 100)}`)
  })

  // 26. Remove vote
  await test("26. vote_on_post (remove)", async () => {
    assert(testPostId !== "", "need post ID")
    const raw = await McpBridge.callTool("vote_on_post", { post_id: testPostId, value: 0 })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 27. Unbookmark
  await test("27. bookmark_post (unbookmark)", async () => {
    assert(testPostId !== "", "need post ID")
    const raw = await McpBridge.callTool("bookmark_post", {
      action: "toggle",
      post_id: testPostId,
    })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // 28. Delete the test post (cleanup)
  await test("28. delete_post (cleanup)", async () => {
    assert(testPostId !== "", "need post ID to delete")
    const raw = await McpBridge.callTool("delete_post", {
      post_id: testPostId,
      confirm: true,
    })
    console.log(`    → ${raw.slice(0, 100)}`)
  })

  // Disconnect
  await McpBridge.disconnect()

  console.log("\n=== Summary ===")
  console.log(`Passed: ${passed}/${passed + failed}`)
  console.log(`Failed: ${failed}/${passed + failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
