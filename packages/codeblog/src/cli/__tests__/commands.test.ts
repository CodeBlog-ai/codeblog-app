import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test"

// ---------------------------------------------------------------------------
// Mock dependencies shared by all CLI commands
// ---------------------------------------------------------------------------

const mockCallTool = mock((_name: string, _args?: Record<string, unknown>) =>
  Promise.resolve('[]'),
)
const mockCallToolJSON = mock((_name: string, _args?: Record<string, unknown>) =>
  Promise.resolve([]),
)

mock.module("../../mcp/client", () => ({
  McpBridge: {
    callTool: mockCallTool,
    callToolJSON: mockCallToolJSON,
    disconnect: mock(() => Promise.resolve()),
  },
}))

// Mock UI to capture output instead of printing
const mockError = mock((_msg: string) => {})
const mockInfo = mock((_msg: string) => {})

mock.module("../ui", () => ({
  UI: {
    error: mockError,
    info: mockInfo,
    Style: {
      TEXT_NORMAL: "",
      TEXT_NORMAL_BOLD: "",
      TEXT_HIGHLIGHT: "",
      TEXT_HIGHLIGHT_BOLD: "",
      TEXT_DIM: "",
      TEXT_INFO: "",
      TEXT_SUCCESS: "",
      TEXT_WARNING: "",
      TEXT_ERROR: "",
    },
  },
}))

// Import commands after mocks
const { ScanCommand } = await import("../cmd/scan")
const { FeedCommand } = await import("../cmd/feed")
const { SearchCommand } = await import("../cmd/search")
const { PublishCommand } = await import("../cmd/publish")

describe("CLI Commands", () => {
  beforeEach(() => {
    mockCallTool.mockClear()
    mockCallToolJSON.mockClear()
    mockError.mockClear()
    mockInfo.mockClear()
    process.exitCode = 0
  })

  afterEach(() => {
    process.exitCode = 0
  })

  // ---------------------------------------------------------------------------
  // ScanCommand
  // ---------------------------------------------------------------------------
  describe("ScanCommand", () => {
    test("has correct command name and describe", () => {
      expect(ScanCommand.command).toBe("scan")
      expect(ScanCommand.describe).toBeTruthy()
    })

    test("handler calls scan_sessions MCP tool", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("[]"))
      await (ScanCommand.handler as any)({ limit: 10 })
      expect(mockCallTool).toHaveBeenCalledWith("scan_sessions", { limit: 10 })
    })

    test("handler calls codeblog_status when --status flag", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("Status: OK"))
      await (ScanCommand.handler as any)({ status: true, limit: 20 })
      expect(mockCallTool).toHaveBeenCalledWith("codeblog_status", {})
    })

    test("handler passes source when provided", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("[]"))
      await (ScanCommand.handler as any)({ limit: 5, source: "cursor" })
      expect(mockCallTool).toHaveBeenCalledWith("scan_sessions", { limit: 5, source: "cursor" })
    })

    test("handler sets exitCode on error", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.reject(new Error("fail")))
      await (ScanCommand.handler as any)({ limit: 10 })
      expect(process.exitCode).toBe(1)
      expect(mockError).toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // FeedCommand
  // ---------------------------------------------------------------------------
  describe("FeedCommand", () => {
    test("has correct command name", () => {
      expect(FeedCommand.command).toBe("feed")
    })

    test("handler calls browse_posts MCP tool", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("post1\npost2"))
      await (FeedCommand.handler as any)({ limit: 15, page: 1, sort: "new" })
      expect(mockCallTool).toHaveBeenCalledWith("browse_posts", {
        limit: 15,
        page: 1,
        sort: "new",
      })
    })

    test("handler includes tag filter when provided", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("post1"))
      await (FeedCommand.handler as any)({ limit: 10, page: 1, sort: "new", tag: "react" })
      expect(mockCallTool).toHaveBeenCalledWith("browse_posts", {
        limit: 10,
        page: 1,
        sort: "new",
        tag: "react",
      })
    })

    test("handler sets exitCode on error", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.reject(new Error("network")))
      await (FeedCommand.handler as any)({ limit: 10, page: 1, sort: "new" })
      expect(process.exitCode).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // SearchCommand
  // ---------------------------------------------------------------------------
  describe("SearchCommand", () => {
    test("has correct command format", () => {
      expect(SearchCommand.command).toBe("search <query>")
    })

    test("handler calls search_posts MCP tool", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("result1"))
      await (SearchCommand.handler as any)({ query: "typescript", limit: 20 })
      expect(mockCallTool).toHaveBeenCalledWith("search_posts", {
        query: "typescript",
        limit: 20,
      })
    })

    test("handler sets exitCode on error", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.reject(new Error("search failed")))
      await (SearchCommand.handler as any)({ query: "test", limit: 10 })
      expect(process.exitCode).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // PublishCommand
  // ---------------------------------------------------------------------------
  describe("PublishCommand", () => {
    test("has correct command name", () => {
      expect(PublishCommand.command).toBe("publish")
    })

    test("handler calls auto_post for normal publish", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("Published!"))
      await (PublishCommand.handler as any)({ dryRun: false, weekly: false })
      expect(mockCallTool).toHaveBeenCalledWith("auto_post", {
        dry_run: false,
      })
    })

    test("handler passes dry_run correctly when true", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("Preview"))
      await (PublishCommand.handler as any)({ dryRun: true, weekly: false })
      expect(mockCallTool).toHaveBeenCalledWith("auto_post", {
        dry_run: true,
      })
    })

    test("handler calls weekly_digest for --weekly", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("Digest"))
      await (PublishCommand.handler as any)({ dryRun: false, weekly: true })
      expect(mockCallTool).toHaveBeenCalledWith("weekly_digest", {
        dry_run: false,
        post: true,
      })
    })

    test("weekly with dry-run sets dry_run true", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("Digest preview"))
      await (PublishCommand.handler as any)({ dryRun: true, weekly: true })
      expect(mockCallTool).toHaveBeenCalledWith("weekly_digest", {
        dry_run: true,
      })
    })

    test("handler passes source and style options", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("OK"))
      await (PublishCommand.handler as any)({
        dryRun: false,
        weekly: false,
        source: "cursor",
        style: "bug-story",
      })
      expect(mockCallTool).toHaveBeenCalledWith("auto_post", {
        dry_run: false,
        source: "cursor",
        style: "bug-story",
      })
    })

    test("handler sets exitCode on error", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.reject(new Error("publish failed")))
      await (PublishCommand.handler as any)({ dryRun: false, weekly: false })
      expect(process.exitCode).toBe(1)
    })

    // Regression test: dry_run should NOT always be true
    test("REGRESSION: publish --weekly does NOT always set dry_run=true", async () => {
      mockCallTool.mockImplementationOnce(() => Promise.resolve("Posted"))
      await (PublishCommand.handler as any)({ dryRun: false, weekly: true })
      const callArgs = mockCallTool.mock.calls[0]
      expect(callArgs![1]).toHaveProperty("dry_run", false)
      expect(callArgs![1]).toHaveProperty("post", true)
    })
  })
})
