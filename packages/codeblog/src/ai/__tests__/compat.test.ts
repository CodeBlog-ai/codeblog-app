import { describe, test, expect } from "bun:test"
import { patchRequestByCompat, resolveCompat } from "../types"

describe("AI Compat", () => {
  test("resolveCompat uses openai-compatible preset by default", () => {
    const compat = resolveCompat({
      providerID: "openai-compatible",
      modelID: "deepseek-chat",
    })
    expect(compat.api).toBe("openai-compatible")
    expect(compat.stripParallelToolCalls).toBe(true)
    expect(compat.normalizeToolSchema).toBe(true)
  })

  test("resolveCompat honors provider config override", () => {
    const compat = resolveCompat({
      providerID: "openai-compatible",
      modelID: "claude-sonnet-4-20250514",
      providerConfig: { api_key: "x", api: "anthropic", compat_profile: "anthropic" },
    })
    expect(compat.api).toBe("anthropic")
    expect(compat.compatProfile).toBe("anthropic")
    expect(compat.stripParallelToolCalls).toBe(false)
  })

  test("patchRequestByCompat removes parallel_tool_calls and fixes schema", () => {
    const compat = resolveCompat({
      providerID: "openai-compatible",
      modelID: "qwen3-coder",
    })
    const body = {
      parallel_tool_calls: true,
      tools: [
        {
          function: {
            parameters: {},
          },
        },
      ],
    }
    const patched = patchRequestByCompat(compat, body)
    expect(patched.parallel_tool_calls).toBeUndefined()
    expect(patched.tools[0]!.function.parameters.type).toBe("object")
    expect(patched.tools[0]!.function.parameters.properties).toEqual({})
  })
})
