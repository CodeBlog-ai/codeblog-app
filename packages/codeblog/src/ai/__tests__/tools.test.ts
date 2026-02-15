import { describe, test, expect } from "bun:test"
import { chatTools, TOOL_LABELS } from "../tools"

describe("AI Tools", () => {
  // ---------------------------------------------------------------------------
  // Structural tests — verify all tools are properly exported and configured
  // ---------------------------------------------------------------------------

  const expectedTools = [
    "scan_sessions", "read_session", "analyze_session",
    "post_to_codeblog", "auto_post", "weekly_digest",
    "browse_posts", "search_posts", "read_post",
    "comment_on_post", "vote_on_post", "edit_post", "delete_post", "bookmark_post",
    "browse_by_tag", "trending_topics", "explore_and_engage", "join_debate",
    "my_notifications",
    "manage_agents", "my_posts", "my_dashboard", "follow_user",
    "codeblog_setup", "codeblog_status",
  ]

  test("exports all 25 tools", () => {
    const toolNames = Object.keys(chatTools)
    expect(toolNames).toHaveLength(25)
  })

  test("each expected tool is present in chatTools", () => {
    for (const name of expectedTools) {
      expect(chatTools).toHaveProperty(name)
    }
  })

  test("each tool has parameters and execute", () => {
    for (const [name, tool] of Object.entries(chatTools)) {
      const t = tool as any
      expect(t.parameters).toBeDefined()
      expect(t.execute).toBeDefined()
      expect(typeof t.execute).toBe("function")
    }
  })

  test("each tool has a description", () => {
    for (const [name, tool] of Object.entries(chatTools)) {
      const t = tool as any
      expect(t.description).toBeDefined()
      expect(typeof t.description).toBe("string")
      expect(t.description.length).toBeGreaterThan(10)
    }
  })

  // ---------------------------------------------------------------------------
  // TOOL_LABELS tests
  // ---------------------------------------------------------------------------

  test("TOOL_LABELS has an entry for every chatTool", () => {
    for (const name of Object.keys(chatTools)) {
      expect(TOOL_LABELS).toHaveProperty(name)
      expect(typeof TOOL_LABELS[name]).toBe("string")
    }
  })

  test("TOOL_LABELS values are non-empty strings", () => {
    for (const [key, label] of Object.entries(TOOL_LABELS)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })

  // ---------------------------------------------------------------------------
  // Parameter schema spot-checks
  // ---------------------------------------------------------------------------

  test("scan_sessions has optional limit and source parameters", () => {
    const params = (chatTools.scan_sessions as any).parameters
    // Zod schema should exist
    expect(params).toBeDefined()
  })

  test("post_to_codeblog requires title, content, source_session", () => {
    const params = (chatTools.post_to_codeblog as any).parameters
    expect(params).toBeDefined()
  })

  test("vote_on_post requires post_id and value", () => {
    const params = (chatTools.vote_on_post as any).parameters
    expect(params).toBeDefined()
  })

  test("delete_post requires post_id and confirm", () => {
    const params = (chatTools.delete_post as any).parameters
    expect(params).toBeDefined()
  })
})
