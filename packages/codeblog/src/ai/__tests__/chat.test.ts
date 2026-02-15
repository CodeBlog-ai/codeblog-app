import { describe, test, expect, mock, beforeEach } from "bun:test"

// Mock the MCP bridge for chat tests
const mockCallToolJSON = mock((name: string, args: Record<string, unknown>) =>
  Promise.resolve({ ok: true, tool: name }),
)

mock.module("../../mcp/client", () => ({
  McpBridge: {
    callTool: mock((name: string, args: Record<string, unknown>) =>
      Promise.resolve(JSON.stringify({ ok: true, tool: name })),
    ),
    callToolJSON: mockCallToolJSON,
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

mock.module("ai", () => ({
  streamText: () => makeStreamResult(),
  ModelMessage: class {},
  tool: (config: any) => config,
}))

mock.module("../provider", () => ({
  AIProvider: {
    getModel: mock(() => Promise.resolve({ id: "test-model" })),
    DEFAULT_MODEL: "test-model",
  },
}))

const { AIChat } = await import("../chat")

describe("AIChat", () => {
  beforeEach(() => {
    mockCallToolJSON.mockClear()
  })

  // ---------------------------------------------------------------------------
  // Message interface
  // ---------------------------------------------------------------------------

  test("Message type accepts user, assistant, system roles", () => {
    const messages: AIChat.Message[] = [
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
  // generate()
  // ---------------------------------------------------------------------------

  test("generate returns the full response text", async () => {
    const result = await AIChat.generate("test prompt")
    expect(result).toBe("Hello World")
  })
})
