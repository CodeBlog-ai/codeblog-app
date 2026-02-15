import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test"

// ---------------------------------------------------------------------------
// We test the McpBridge module by mocking the MCP SDK classes.
// The actual module spawns a subprocess, which we don't want in unit tests.
// ---------------------------------------------------------------------------

// Mock the MCP SDK
const mockCallTool = mock(() =>
  Promise.resolve({
    content: [{ type: "text", text: '{"ok":true}' }],
    isError: false,
  }),
)
const mockListTools = mock(() =>
  Promise.resolve({ tools: [{ name: "test_tool", description: "A test tool" }] }),
)
const mockConnect = mock(() => Promise.resolve())
const mockGetServerVersion = mock(() => ({ name: "test-server", version: "1.0.0" }))
const mockClose = mock(() => Promise.resolve())

mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class MockClient {
    callTool = mockCallTool
    listTools = mockListTools
    connect = mockConnect
    getServerVersion = mockGetServerVersion
  },
}))

mock.module("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: class MockTransport {
    close = mockClose
  },
}))

// Must import AFTER mocks are set up
const { McpBridge } = await import("../client")

describe("McpBridge", () => {
  afterEach(async () => {
    await McpBridge.disconnect()
    mockCallTool.mockClear()
    mockListTools.mockClear()
    mockConnect.mockClear()
    mockClose.mockClear()
  })

  test("callTool returns text content from MCP result", async () => {
    const result = await McpBridge.callTool("test_tool", { key: "value" })
    expect(result).toBe('{"ok":true}')
    expect(mockCallTool).toHaveBeenCalledWith({
      name: "test_tool",
      arguments: { key: "value" },
    })
  })

  test("callToolJSON parses JSON result", async () => {
    const result = await McpBridge.callToolJSON("test_tool")
    expect(result).toEqual({ ok: true })
  })

  test("callToolJSON falls back to raw text when JSON parse fails", async () => {
    mockCallTool.mockImplementationOnce(() =>
      Promise.resolve({
        content: [{ type: "text", text: "not json" }],
        isError: false,
      }),
    )
    const result = await McpBridge.callToolJSON("test_tool")
    expect(result).toBe("not json")
  })

  test("callTool throws on error result", async () => {
    mockCallTool.mockImplementationOnce(() =>
      Promise.resolve({
        content: [{ type: "text", text: "Something went wrong" }],
        isError: true,
      }),
    )
    expect(McpBridge.callTool("failing_tool")).rejects.toThrow("Something went wrong")
  })

  test("callTool throws generic message when error has no text", async () => {
    mockCallTool.mockImplementationOnce(() =>
      Promise.resolve({
        content: [],
        isError: true,
      }),
    )
    expect(McpBridge.callTool("failing_tool")).rejects.toThrow('MCP tool "failing_tool" returned an error')
  })

  test("callTool handles empty content array", async () => {
    mockCallTool.mockImplementationOnce(() =>
      Promise.resolve({
        content: [],
        isError: false,
      }),
    )
    const result = await McpBridge.callTool("test_tool")
    expect(result).toBe("")
  })

  test("callTool joins multiple text content items", async () => {
    mockCallTool.mockImplementationOnce(() =>
      Promise.resolve({
        content: [
          { type: "text", text: "line1" },
          { type: "text", text: "line2" },
          { type: "image", data: "..." },
        ],
        isError: false,
      }),
    )
    const result = await McpBridge.callTool("test_tool")
    expect(result).toBe("line1\nline2")
  })

  test("listTools delegates to MCP client", async () => {
    const result = await McpBridge.listTools()
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].name).toBe("test_tool")
  })

  test("disconnect cleans up transport and client", async () => {
    // First connect by making a call
    await McpBridge.callTool("test_tool")
    // Then disconnect
    await McpBridge.disconnect()
    // Verify close was called
    expect(mockClose).toHaveBeenCalled()
  })

  test("connection is reused across multiple calls", async () => {
    await McpBridge.callTool("test_tool")
    await McpBridge.callTool("test_tool")
    // connect should only be called once
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  test("default args is empty object", async () => {
    await McpBridge.callTool("test_tool")
    expect(mockCallTool).toHaveBeenCalledWith({
      name: "test_tool",
      arguments: {},
    })
  })
})
