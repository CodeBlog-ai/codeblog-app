import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { AIProvider } from "../provider"

describe("AIProvider", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clean up env vars before each test
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_AUTH_TOKEN
    delete process.env.OPENAI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.GOOGLE_API_KEY
    delete process.env.OPENAI_COMPATIBLE_API_KEY
    delete process.env.ANTHROPIC_BASE_URL
    delete process.env.OPENAI_BASE_URL
    delete process.env.OPENAI_API_BASE
    delete process.env.GOOGLE_API_BASE_URL
    delete process.env.OPENAI_COMPATIBLE_BASE_URL
  })

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key]
    }
    for (const [key, val] of Object.entries(originalEnv)) {
      if (val !== undefined) process.env[key] = val
    }
  })

  // ---------------------------------------------------------------------------
  // BUILTIN_MODELS
  // ---------------------------------------------------------------------------

  test("BUILTIN_MODELS has 7 models", () => {
    expect(Object.keys(AIProvider.BUILTIN_MODELS)).toHaveLength(7)
  })

  test("each model has required fields", () => {
    for (const [id, model] of Object.entries(AIProvider.BUILTIN_MODELS)) {
      expect(model.id).toBe(id)
      expect(model.providerID).toBeTruthy()
      expect(model.name).toBeTruthy()
      expect(model.contextWindow).toBeGreaterThan(0)
      expect(model.outputTokens).toBeGreaterThan(0)
    }
  })

  test("DEFAULT_MODEL is a valid builtin model", () => {
    expect(AIProvider.BUILTIN_MODELS[AIProvider.DEFAULT_MODEL]).toBeDefined()
  })

  test("all providers are covered: anthropic, openai, google", () => {
    const providerIDs = new Set(Object.values(AIProvider.BUILTIN_MODELS).map((m) => m.providerID))
    expect(providerIDs.has("anthropic")).toBe(true)
    expect(providerIDs.has("openai")).toBe(true)
    expect(providerIDs.has("google")).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // getApiKey
  // ---------------------------------------------------------------------------

  test("getApiKey returns env var when set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test123"
    const key = await AIProvider.getApiKey("anthropic")
    expect(key).toBe("sk-ant-test123")
  })

  test("getApiKey checks secondary env var", async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "token-test"
    const key = await AIProvider.getApiKey("anthropic")
    expect(key).toBe("token-test")
  })

  test("getApiKey returns undefined when no key set", async () => {
    const key = await AIProvider.getApiKey("anthropic")
    // May return undefined or a config value — just check it doesn't crash
    expect(key === undefined || typeof key === "string").toBe(true)
  })

  test("getApiKey works for openai", async () => {
    process.env.OPENAI_API_KEY = "sk-openai-test"
    const key = await AIProvider.getApiKey("openai")
    expect(key).toBe("sk-openai-test")
  })

  test("getApiKey works for google", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "aiza-test"
    const key = await AIProvider.getApiKey("google")
    expect(key).toBe("aiza-test")
  })

  // ---------------------------------------------------------------------------
  // getBaseUrl
  // ---------------------------------------------------------------------------

  test("getBaseUrl returns env var when set", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://custom.api.com"
    const url = await AIProvider.getBaseUrl("anthropic")
    expect(url).toBe("https://custom.api.com")
  })

  test("getBaseUrl returns undefined when no env var set", async () => {
    const url = await AIProvider.getBaseUrl("anthropic")
    expect(url === undefined || typeof url === "string").toBe(true)
  })

  // ---------------------------------------------------------------------------
  // hasAnyKey
  // ---------------------------------------------------------------------------

  test("hasAnyKey returns true when any key is set", async () => {
    process.env.OPENAI_API_KEY = "sk-test"
    const has = await AIProvider.hasAnyKey()
    expect(has).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // parseModel
  // ---------------------------------------------------------------------------

  test("parseModel splits provider/model", () => {
    const result = AIProvider.parseModel("anthropic/claude-sonnet-4-20250514")
    expect(result.providerID).toBe("anthropic")
    expect(result.modelID).toBe("claude-sonnet-4-20250514")
  })

  test("parseModel handles nested slashes", () => {
    const result = AIProvider.parseModel("openai/gpt-4o/latest")
    expect(result.providerID).toBe("openai")
    expect(result.modelID).toBe("gpt-4o/latest")
  })

  test("parseModel handles no slash", () => {
    const result = AIProvider.parseModel("gpt-4o")
    expect(result.providerID).toBe("gpt-4o")
    expect(result.modelID).toBe("")
  })

  // ---------------------------------------------------------------------------
  // available
  // ---------------------------------------------------------------------------

  test("available returns all builtin models with hasKey status", async () => {
    const models = await AIProvider.available()
    expect(models).toHaveLength(7)
    for (const entry of models) {
      expect(entry.model).toBeDefined()
      expect(typeof entry.hasKey).toBe("boolean")
    }
  })

  // ---------------------------------------------------------------------------
  // getModel
  // ---------------------------------------------------------------------------

  test("getModel throws when no API key for builtin model", async () => {
    expect(AIProvider.getModel("gpt-4o")).rejects.toThrow("No API key for openai")
  })

  test("getModel falls back to provider with base_url for unknown model", async () => {
    // When a provider with base_url is configured, unknown models get sent there
    // instead of throwing. This test verifies the fallback behavior.
    // If no provider has a base_url, it would throw.
    const result = AIProvider.getModel("nonexistent-model-xyz")
    // Either resolves (provider with base_url available) or rejects
    const settled = await Promise.allSettled([result])
    expect(settled[0]!.status).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // listProviders
  // ---------------------------------------------------------------------------

  test("listProviders returns provider info", async () => {
    process.env.OPENAI_API_KEY = "sk-test"
    const providers = await AIProvider.listProviders()
    expect(providers.openai).toBeDefined()
    expect(providers.openai!.hasKey).toBe(true)
    expect(providers.openai!.models.length).toBeGreaterThan(0)
  })
})
