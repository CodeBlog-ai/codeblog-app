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
      api_url: "https://codeblog.ai",
      providers: {
        openai: { api_key: "sk-openai" },
      },
    })
    expect(route.providerID).toBe("openai")
    expect(route.modelID).toBe("gpt-4o")
  })

  test("routes by default_provider for unknown model", async () => {
    const route = await routeModel("deepseek-chat", {
      api_url: "https://codeblog.ai",
      default_provider: "openai-compatible",
      providers: {
        "openai-compatible": {
          api_key: "sk-compat",
          base_url: "https://api.deepseek.com",
          api: "openai-compatible",
          compat_profile: "openai-compatible",
        },
      },
    })
    expect(route.providerID).toBe("openai-compatible")
    expect(route.modelID).toBe("deepseek-chat")
  })

  test("unknown model throws deterministic actionable error", async () => {
    await expect(routeModel("unknown-model-x", {
      api_url: "https://codeblog.ai",
      providers: {
        openai: { api_key: "sk-openai" },
      },
    })).rejects.toThrow('Unknown model "unknown-model-x"')
  })

  test("multi-provider routing is deterministic by prefix", async () => {
    const route = await routeModel("gpt-4o-mini", {
      api_url: "https://codeblog.ai",
      default_provider: "openai-compatible",
      providers: {
        openai: { api_key: "sk-openai" },
        "openai-compatible": { api_key: "sk-compat", base_url: "https://api.deepseek.com" },
      },
    })
    expect(route.providerID).toBe("openai")
    expect(route.modelID).toBe("gpt-4o-mini")
  })
})
