import { describe, test, expect, beforeEach, mock } from "bun:test"

const mockListTools = mock(async () => ({ tools: [] }))

mock.module("../../mcp/client", () => ({
  McpBridge: {
    listTools: mockListTools,
    callToolJSON: mock(async () => ({})),
  },
}))

let streamFactory: () => { fullStream: AsyncGenerator<any, void, unknown> } = () => ({
  fullStream: (async function* () {
    yield { type: "text-delta", textDelta: "hello" }
  })(),
})

mock.module("ai", () => ({
  streamText: () => streamFactory(),
  stepCountIs: (n: number) => ({ type: "step-count", count: n }),
  tool: (config: any) => config,
  jsonSchema: (schema: any) => schema,
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

describe("stream events", () => {
  beforeEach(() => {
    mockListTools.mockClear()
  })

  test("emits ordered run-start -> deltas -> run-finish sequence", async () => {
    streamFactory = () => ({
      fullStream: (async function* () {
        yield { type: "text-delta", textDelta: "Hello " }
        yield { type: "text-delta", textDelta: "World" }
      })(),
    })

    const events: any[] = []
    for await (const event of AIChat.streamEvents([{ role: "user", content: "hi" }])) {
      events.push(event)
    }

    expect(events.map((e: any) => e.type)).toEqual(["run-start", "text-delta", "text-delta", "run-finish"])
    expect(events.every((e: any) => e.runId === events[0]!.runId)).toBe(true)
    expect(events.map((e: any) => e.seq)).toEqual([1, 2, 3, 4])
  })

  test("tool-start and tool-result are paired", async () => {
    streamFactory = () => ({
      fullStream: (async function* () {
        yield { type: "tool-call", toolName: "scan_sessions", args: { limit: 5 } }
        yield { type: "tool-result", toolName: "scan_sessions", result: { sessions: [] } }
        yield { type: "text-delta", textDelta: "done" }
      })(),
    })

    const starts: string[] = []
    const results: string[] = []
    const ids: Array<{ start?: string; result?: string }> = []
    for await (const event of AIChat.streamEvents([{ role: "user", content: "scan" }])) {
      if (event.type === "tool-start") {
        starts.push(event.name)
        ids.push({ start: event.callID })
      }
      if (event.type === "tool-result") {
        results.push(event.name)
        ids[0] = { ...ids[0], result: event.callID }
      }
    }

    expect(starts).toEqual(["scan_sessions"])
    expect(results).toEqual(["scan_sessions"])
    expect(ids[0]?.start).toBe(ids[0]?.result)
  })

  test("abort keeps lifecycle consistent and marks run-finish.aborted", async () => {
    streamFactory = () => ({
      fullStream: (async function* () {
        yield { type: "text-delta", textDelta: "partial" }
        await Bun.sleep(40)
        yield { type: "text-delta", textDelta: " late" }
      })(),
    })

    const ctrl = new AbortController()
    let seenFinish = false
    for await (const event of AIChat.streamEvents([{ role: "user", content: "stop test" }], undefined, ctrl.signal)) {
      if (event.type === "text-delta") ctrl.abort()
      if (event.type === "run-finish") {
        seenFinish = true
        expect(event.aborted).toBe(true)
      }
    }

    expect(seenFinish).toBe(true)
  })

  test("error part is surfaced and lifecycle still finishes", async () => {
    streamFactory = () => ({
      fullStream: (async function* () {
        yield { type: "error", error: new Error("boom") }
      })(),
    })

    const types: string[] = []
    for await (const event of AIChat.streamEvents([{ role: "user", content: "error path" }])) {
      types.push(event.type)
      if (event.type === "error") expect(event.error.message).toBe("boom")
    }

    expect(types).toContain("error")
    expect(types[types.length - 1]).toBe("run-finish")
  })

  test("tool timeout emits error and still reaches run-finish", async () => {
    streamFactory = () => ({
      fullStream: (async function* () {
        yield { type: "tool-call", toolName: "scan_sessions", args: { limit: 1 } }
        await Bun.sleep(40)
      })(),
    })

    const seen: string[] = []
    for await (const event of AIChat.streamEvents([{ role: "user", content: "scan" }], undefined, undefined, {
      toolTimeoutMs: 15,
      idleTimeoutMs: 1000,
    })) {
      seen.push(event.type)
    }

    expect(seen).toContain("error")
    expect(seen[seen.length - 1]).toBe("run-finish")
  })
})
