import { describe, test, expect, mock } from "bun:test"

// Mock MCP bridge so tests don't need a running MCP server
const MOCK_MCP_TOOLS = [
  {
    name: "scan_sessions",
    description: "Scan IDE sessions for coding activity",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "my_dashboard",
    description: "Show the user dashboard with stats",
    inputSchema: {},
  },
  {
    name: "browse_posts",
    description: "Browse posts on the forum with filters",
    inputSchema: { type: "object", properties: { page: { type: "number" }, tag: { type: "string" } } },
  },
]

mock.module("../../mcp/client", () => ({
  McpBridge: {
    listTools: mock(() => Promise.resolve({ tools: MOCK_MCP_TOOLS })),
    callToolJSON: mock((name: string) => Promise.resolve({ ok: true, tool: name })),
  },
}))

mock.module("ai", () => ({
  tool: (config: any) => config,
  jsonSchema: (schema: any) => schema,
}))

const { getChatTools, TOOL_LABELS, clearChatToolsCache } = await import("../tools")

describe("AI Tools (dynamic MCP discovery)", () => {
  let chatTools: Record<string, any>

  test("getChatTools() discovers tools from MCP server", async () => {
    clearChatToolsCache()
    chatTools = await getChatTools()
    const names = Object.keys(chatTools)
    expect(names.length).toBe(MOCK_MCP_TOOLS.length)
    expect(names).toContain("scan_sessions")
    expect(names).toContain("my_dashboard")
    expect(names).toContain("browse_posts")
  })

  test("each tool has inputSchema and execute", () => {
    for (const [name, t] of Object.entries(chatTools)) {
      const tool = t as any
      expect(tool.inputSchema).toBeDefined()
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

  test("normalizeToolSchema adds type:object to empty schemas", async () => {
    // my_dashboard has empty inputSchema {} — should be normalized
    const dashboard = chatTools["my_dashboard"] as any
    expect(dashboard.inputSchema.type).toBe("object")
    expect(dashboard.inputSchema.properties).toEqual({})
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
