import { describe, test, expect, mock } from "bun:test"
import { resolveAssistantContent } from "../../tui/ai-stream"

const streamTextMock = mock(() => ({
  fullStream: (async function* () {
    yield { type: "tool-call", toolName: "scan_sessions", args: { limit: 1 } }
    yield { type: "tool-result", toolName: "scan_sessions", result: { sessions: [{ id: "s1" }] } }
  })(),
}))

mock.module("ai", () => ({
  streamText: streamTextMock,
  stepCountIs: (n: number) => ({ type: "step-count", count: n }),
  tool: (config: any) => config,
  jsonSchema: (schema: any) => schema,
}))

mock.module("../../mcp/client", () => ({
  McpBridge: {
    listTools: mock(async () => ({ tools: [] })),
    callToolJSON: mock(async () => ({})),
  },
}))

mock.module("../provider", () => ({
  AIProvider: {
    getModel: mock(async () => ({ id: "test-model" })),
    resolveModelCompat: mock(async () => ({
      providerID: "openai-compatible",
      modelID: "test-model",
      api: "openai-compatible",
      compatProfile: "openai-compatible",
      cacheKey: "openai-compatible:openai-compatible",
      stripParallelToolCalls: true,
      normalizeToolSchema: true,
    })),
    DEFAULT_MODEL: "test-model",
  },
}))

const { AIChat } = await import("../chat")

describe("home ai stream integration (equivalent)", () => {
  test("tool-only run stays single-stream and produces structured fallback content", async () => {
    let finishText = ""
    await AIChat.stream(
      [{ role: "user", content: "scan now" }],
      {
        onFinish: (text) => { finishText = text },
      },
    )

    expect(streamTextMock).toHaveBeenCalledTimes(1)
    expect(finishText).toBe("(No response)")

    const content = resolveAssistantContent({
      finalText: "",
      aborted: false,
      abortByUser: false,
      hasToolCalls: true,
      toolResults: [{ name: "scan_sessions", result: "{\"sessions\":[{\"id\":\"s1\"}]}" }],
    })
    expect(content).toContain("Tool execution completed:")
    expect(content).toContain("scan_sessions")
  })

  test("abort state is rendered consistently", () => {
    const content = resolveAssistantContent({
      finalText: "partial answer",
      aborted: true,
      abortByUser: true,
      hasToolCalls: false,
      toolResults: [],
    })
    expect(content).toContain("(interrupted)")
  })
})
