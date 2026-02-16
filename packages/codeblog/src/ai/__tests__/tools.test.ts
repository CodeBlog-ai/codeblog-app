import { describe, test, expect } from "bun:test"
import { getChatTools, TOOL_LABELS, clearChatToolsCache } from "../tools"

describe("AI Tools (dynamic MCP discovery)", () => {
  // These tests require a running MCP server subprocess.
  // getChatTools() connects to codeblog-mcp via stdio and calls listTools().

  let chatTools: Record<string, any>

  test("getChatTools() discovers tools from MCP server", async () => {
    clearChatToolsCache()
    chatTools = await getChatTools()
    const names = Object.keys(chatTools)
    expect(names.length).toBeGreaterThanOrEqual(20)
  })

  test("each tool has parameters and execute", () => {
    for (const [name, t] of Object.entries(chatTools)) {
      const tool = t as any
      expect(tool.parameters).toBeDefined()
      expect(tool.execute).toBeDefined()
      expect(typeof tool.execute).toBe("function")
    }
  })

  test("each tool has a description", () => {
    for (const [name, t] of Object.entries(chatTools)) {
      const tool = t as any
      expect(tool.description).toBeDefined()
      expect(typeof tool.description).toBe("string")
      expect(tool.description.length).toBeGreaterThan(10)
    }
  })

  // ---------------------------------------------------------------------------
  // TOOL_LABELS tests (static fallback map)
  // ---------------------------------------------------------------------------

  test("TOOL_LABELS values are non-empty strings", () => {
    for (const [key, label] of Object.entries(TOOL_LABELS)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })

  // ---------------------------------------------------------------------------
  // Caching
  // ---------------------------------------------------------------------------

  test("getChatTools() returns cached result on second call", async () => {
    const tools1 = await getChatTools()
    const tools2 = await getChatTools()
    expect(tools1).toBe(tools2) // same reference
  })
})
