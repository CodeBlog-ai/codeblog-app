import { describe, test, expect, beforeEach } from "bun:test"
import { routeModel } from "../provider-registry"

describe("provider-registry", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.OPENAI_COMPATIBLE_API_KEY
  })

  test("routes explicit provider/model first", async () => {
    const route = await routeModel("openai/gpt-4o", {
      serverUrl: "https://codeblog.ai",
      cli: {
        providers: {
          openai: { apiKey: "sk-openai" },
        },
      },
    })
    expect(route.providerID).toBe("openai")
    expect(route.modelID).toBe("gpt-4o")
  })

  test("routes by defaultProvider for unknown model", async () => {
    const route = await routeModel("deepseek-chat", {
      serverUrl: "https://codeblog.ai",
      cli: {
        defaultProvider: "openai-compatible",
        providers: {
          "openai-compatible": {
            apiKey: "sk-compat",
            baseUrl: "https://api.deepseek.com",
            apiType: "openai-compatible",
            compatProfile: "openai-compatible",
          },
        },
      },
    })
    expect(route.providerID).toBe("openai-compatible")
    expect(route.modelID).toBe("deepseek-chat")
  })

  test("unknown model throws deterministic actionable error", async () => {
    await expect(routeModel("unknown-model-x", {
      serverUrl: "https://codeblog.ai",
      cli: {
        providers: {
          openai: { apiKey: "sk-openai" },
        },
      },
    })).rejects.toThrow('Unknown model "unknown-model-x"')
  })

  test("multi-provider routing is deterministic by prefix", async () => {
    const route = await routeModel("gpt-4o-mini", {
      serverUrl: "https://codeblog.ai",
      cli: {
        defaultProvider: "openai-compatible",
        providers: {
          openai: { apiKey: "sk-openai" },
          "openai-compatible": { apiKey: "sk-compat", baseUrl: "https://api.deepseek.com" },
        },
      },
    })
    expect(route.providerID).toBe("openai")
    expect(route.modelID).toBe("gpt-4o-mini")
  })

  test("legacy model id is normalized to stable default", async () => {
    const route = await routeModel(undefined, {
      serverUrl: "https://codeblog.ai",
      cli: {
        defaultProvider: "openai",
        model: "4.0Ultra",
        providers: {
          openai: { apiKey: "sk-openai" },
        },
      },
    })
    expect(route.providerID).toBe("openai")
    expect(route.modelID).toBe("gpt-5.2")
  })

  test("missing model uses provider-specific default", async () => {
    const route = await routeModel(undefined, {
      serverUrl: "https://codeblog.ai",
      cli: {
        defaultProvider: "openai",
        providers: {
          openai: { apiKey: "sk-openai" },
        },
      },
    })
    expect(route.providerID).toBe("openai")
    expect(route.modelID).toBe("gpt-5.2")
  })

  test("missing model on openai-compatible keeps provider prefix", async () => {
    const route = await routeModel(undefined, {
      serverUrl: "https://codeblog.ai",
      cli: {
        defaultProvider: "openai-compatible",
        providers: {
          "openai-compatible": { apiKey: "sk-compat", baseUrl: "https://example.com/v1", apiType: "openai-compatible" },
        },
      },
    })
    expect(route.providerID).toBe("openai-compatible")
    expect(route.modelID).toBe("gpt-5.2")
  })
})
