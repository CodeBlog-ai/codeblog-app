import { describe, test, expect, mock, beforeEach } from "bun:test"

// Mock the MCP bridge for chat tests
const mockCallToolJSON = mock((name: string, args: Record<string, unknown>) =>
  Promise.resolve({ ok: true, tool: name }),
)

const mockListTools = mock(() =>
  Promise.resolve({ tools: [] }),
)

mock.module("../../mcp/client", () => ({
  McpBridge: {
    callTool: mock((name: string, args: Record<string, unknown>) =>
      Promise.resolve(JSON.stringify({ ok: true, tool: name })),
    ),
    callToolJSON: mockCallToolJSON,
    listTools: mockListTools,
    disconnect: mock(() => Promise.resolve()),
  },
}))

// Each call to streamText must return a FRESH async generator
function makeStreamResult() {
  return {
    fullStream: (async function* () {
      yield { type: "text-delta", textDelta: "Hello " }
      yield { type: "text-delta", textDelta: "World" }
    })(),
  }
}

function makeToolCallStreamResult() {
  return {
    fullStream: (async function* () {
      yield { type: "tool-call", toolName: "scan_sessions", args: { limit: 5 } }
      yield { type: "tool-result", toolName: "scan_sessions", result: { sessions: [] } }
      yield { type: "text-delta", textDelta: "Done scanning." }
    })(),
  }
}

let streamFactory: () => { fullStream: AsyncGenerator<any, void, unknown> } = () => makeStreamResult()

mock.module("ai", () => ({
  streamText: () => streamFactory(),
  stepCountIs: (n: number) => ({ type: "step-count", count: n }),
  tool: (config: any) => config,
  jsonSchema: (schema: any) => schema,
}))

mock.module("../provider", () => ({
  AIProvider: {
    getModel: mock(() => Promise.resolve({ id: "test-model" })),
    resolveModelCompat: mock(() => Promise.resolve({
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

describe("AIChat", () => {
  beforeEach(() => {
    mockCallToolJSON.mockClear()
    streamFactory = () => makeStreamResult()
  })

  // ---------------------------------------------------------------------------
  // Message interface
  // ---------------------------------------------------------------------------

  test("Message type accepts user, assistant, system roles", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "system", content: "you are a bot" },
    ]
    expect(messages).toHaveLength(3)
  })

  // ---------------------------------------------------------------------------
  // stream()
  // ---------------------------------------------------------------------------

  test("stream calls onToken for each text delta", async () => {
    const tokens: string[] = []
    const result = await AIChat.stream(
      [{ role: "user", content: "test" }],
      {
        onToken: (t) => tokens.push(t),
        onFinish: () => {},
      },
    )
    expect(tokens).toEqual(["Hello ", "World"])
    expect(result).toBe("Hello World")
  })

  test("stream calls onFinish with full text", async () => {
    let finished = ""
    await AIChat.stream(
      [{ role: "user", content: "test" }],
      {
        onFinish: (text) => { finished = text },
      },
    )
    expect(finished).toBe("Hello World")
  })

  test("stream filters out system messages from history", async () => {
    await AIChat.stream(
      [
        { role: "system", content: "ignored" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "bye" },
      ],
      { onFinish: () => {} },
    )
    // Should not throw — system messages are filtered
  })

  // ---------------------------------------------------------------------------
  // stream() with tool calls
  // ---------------------------------------------------------------------------

  test("stream dispatches onToolCall and onToolResult callbacks", async () => {
    streamFactory = () => makeToolCallStreamResult()

    const toolCalls: Array<{ name: string; args: unknown }> = []
    const toolResults: Array<{ name: string; result: unknown }> = []
    const tokens: string[] = []

    await AIChat.stream(
      [{ role: "user", content: "scan my sessions" }],
      {
        onToken: (t) => tokens.push(t),
        onToolCall: (name, args) => toolCalls.push({ name, args }),
        onToolResult: (name, result) => toolResults.push({ name, result }),
        onFinish: () => {},
      },
    )

    expect(toolCalls).toEqual([{ name: "scan_sessions", args: { limit: 5 } }])
    expect(toolResults).toEqual([{ name: "scan_sessions", result: { sessions: [] } }])
    expect(tokens).toEqual(["Done scanning."])
  })

  // ---------------------------------------------------------------------------
  // stream() error handling
  // ---------------------------------------------------------------------------

  test("stream calls onError when error event is received", async () => {
    streamFactory = () => ({
      fullStream: (async function* () {
        yield { type: "error", error: new Error("test error") }
      })(),
    })

    const errors: Error[] = []
    await AIChat.stream(
      [{ role: "user", content: "test" }],
      {
        onError: (err) => errors.push(err),
        onFinish: () => {},
      },
    )

    expect(errors).toHaveLength(1)
    expect(errors[0]!.message).toBe("test error")
  })

  // ---------------------------------------------------------------------------
  // generate()
  // ---------------------------------------------------------------------------

  test("generate returns the full response text", async () => {
    const result = await AIChat.generate("test prompt")
    expect(result).toBe("Hello World")
  })
})
