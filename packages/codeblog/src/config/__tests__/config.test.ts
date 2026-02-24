import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, test, expect, beforeAll, beforeEach, afterAll } from "bun:test"

describe("Config unified read/write", () => {
  const testHome = path.join(os.tmpdir(), `codeblog-config-test-${process.pid}-${Date.now()}`)
  const configDir = path.join(testHome, ".codeblog")
  const configFile = path.join(configDir, "config.json")

  let Config: (typeof import("../../config"))["Config"]
  let Auth: (typeof import("../../auth"))["Auth"]

  beforeAll(async () => {
    process.env.CODEBLOG_TEST_HOME = testHome
    await fs.mkdir(configDir, { recursive: true })
    await fs.writeFile(configFile, "{}\n")
    ;({ Config } = await import("../../config"))
    ;({ Auth } = await import("../../auth"))
  })

  beforeEach(async () => {
    await fs.writeFile(configFile, "{}\n")
  })

  afterAll(async () => {
    await fs.rm(testHome, { recursive: true, force: true })
    delete process.env.CODEBLOG_TEST_HOME
  })

  // --- Config.save / Config.load ---

  test("save and load serverUrl at top level", async () => {
    await Config.save({ serverUrl: "https://test.codeblog.ai" })
    const cfg = await Config.load()
    expect(cfg.serverUrl).toBe("https://test.codeblog.ai")
  })

  test("save and load dailyReportHour at top level", async () => {
    await Config.save({ dailyReportHour: 18 })
    const cfg = await Config.load()
    expect(cfg.dailyReportHour).toBe(18)
  })

  test("save auth nested fields", async () => {
    await Config.save({ auth: { apiKey: "cbk_test123", activeAgent: "my-agent", userId: "user123" } })
    const cfg = await Config.load()
    expect(cfg.auth?.apiKey).toBe("cbk_test123")
    expect(cfg.auth?.activeAgent).toBe("my-agent")
    expect(cfg.auth?.userId).toBe("user123")
  })

  test("save cli nested fields", async () => {
    await Config.save({
      cli: {
        model: "anthropic/claude-sonnet-4",
        defaultProvider: "anthropic",
        providers: {
          anthropic: { apiKey: "sk-ant-test", apiType: "anthropic", compatProfile: "anthropic" },
        },
      },
    })
    const cfg = await Config.load()
    expect(cfg.cli?.model).toBe("anthropic/claude-sonnet-4")
    expect(cfg.cli?.defaultProvider).toBe("anthropic")
    expect(cfg.cli?.providers?.anthropic?.apiKey).toBe("sk-ant-test")
  })

  // --- Deep merge ---

  test("deep merge preserves other sections when saving one", async () => {
    await Config.save({ auth: { apiKey: "cbk_first" } })
    await Config.save({ cli: { model: "gpt-5.2" } })
    const cfg = await Config.load()
    expect(cfg.auth?.apiKey).toBe("cbk_first")
    expect(cfg.cli?.model).toBe("gpt-5.2")
  })

  test("deep merge preserves nested fields within same section", async () => {
    await Config.save({ auth: { apiKey: "cbk_key", userId: "u1" } })
    await Config.save({ auth: { activeAgent: "agent1" } })
    const cfg = await Config.load()
    expect(cfg.auth?.apiKey).toBe("cbk_key")
    expect(cfg.auth?.userId).toBe("u1")
    expect(cfg.auth?.activeAgent).toBe("agent1")
  })

  test("undefined deletes fields (for Auth.remove)", async () => {
    await Config.save({ auth: { apiKey: "cbk_key", userId: "u1", activeAgent: "a1" } })
    await Config.save({ auth: { apiKey: undefined, userId: undefined, activeAgent: undefined } })
    const cfg = await Config.load()
    expect(cfg.auth?.apiKey).toBeUndefined()
    expect(cfg.auth?.userId).toBeUndefined()
    expect(cfg.auth?.activeAgent).toBeUndefined()
  })

  test("undefined in auth does not affect cli", async () => {
    await Config.save({ auth: { apiKey: "cbk_key" }, cli: { model: "gpt-5.2" } })
    await Config.save({ auth: { apiKey: undefined } })
    const cfg = await Config.load()
    expect(cfg.auth?.apiKey).toBeUndefined()
    expect(cfg.cli?.model).toBe("gpt-5.2")
  })

  // --- Auth proxy ---

  test("Auth.set writes to config.auth", async () => {
    await Auth.set({ type: "apikey", value: "cbk_authtest", username: "testuser" })
    const cfg = await Config.load()
    expect(cfg.auth?.apiKey).toBe("cbk_authtest")
    expect(cfg.auth?.username).toBe("testuser")
  })

  test("Auth.get reads from config.auth", async () => {
    await Config.save({ auth: { apiKey: "cbk_gettest", username: "user2" } })
    const token = await Auth.get()
    expect(token).not.toBeNull()
    expect(token!.type).toBe("apikey")
    expect(token!.value).toBe("cbk_gettest")
    expect(token!.username).toBe("user2")
  })

  test("Auth.get returns null when no apiKey", async () => {
    const token = await Auth.get()
    expect(token).toBeNull()
  })

  test("Auth.remove clears auth but preserves cli", async () => {
    await Config.save({ auth: { apiKey: "cbk_rm", userId: "u1" }, cli: { model: "gpt-5.2" } })
    await Auth.remove()
    const cfg = await Config.load()
    expect(cfg.auth?.apiKey).toBeUndefined()
    expect(cfg.auth?.userId).toBeUndefined()
    expect(cfg.cli?.model).toBe("gpt-5.2")
  })

  test("Auth.authenticated returns true/false correctly", async () => {
    expect(await Auth.authenticated()).toBe(false)
    await Auth.set({ type: "apikey", value: "cbk_auth" })
    expect(await Auth.authenticated()).toBe(true)
    await Auth.remove()
    expect(await Auth.authenticated()).toBe(false)
  })

  test("Auth.header returns correct Authorization header", async () => {
    await Auth.set({ type: "apikey", value: "cbk_hdr" })
    const header = await Auth.header()
    expect(header).toEqual({ Authorization: "Bearer cbk_hdr" })
  })

  test("Auth.header returns empty object when not authenticated", async () => {
    const header = await Auth.header()
    expect(header).toEqual({})
  })

  // --- Config helper functions ---

  test("Config.url reads serverUrl", async () => {
    await Config.save({ serverUrl: "https://custom.codeblog.ai" })
    const url = await Config.url()
    expect(url).toBe("https://custom.codeblog.ai")
  })

  test("Config.url returns default when not set", async () => {
    const url = await Config.url()
    expect(url).toBe("https://codeblog.ai")
  })

  test("Config.key reads auth.apiKey", async () => {
    await Config.save({ auth: { apiKey: "cbk_keytest" } })
    const key = await Config.key()
    expect(key).toBe("cbk_keytest")
  })

  test("Config.getActiveAgent reads auth.activeAgent", async () => {
    await Config.save({ auth: { activeAgent: "my-bot" } })
    const agent = await Config.getActiveAgent()
    expect(agent).toBe("my-bot")
  })

  test("Config.saveActiveAgent writes auth.activeAgent", async () => {
    await Config.saveActiveAgent("new-bot")
    const cfg = await Config.load()
    expect(cfg.auth?.activeAgent).toBe("new-bot")
  })

  test("Config.clearActiveAgent removes auth.activeAgent", async () => {
    await Config.save({ auth: { activeAgent: "old-bot", apiKey: "cbk_keep" } })
    await Config.clearActiveAgent()
    const cfg = await Config.load()
    expect(cfg.auth?.activeAgent).toBeUndefined()
    expect(cfg.auth?.apiKey).toBe("cbk_keep")
  })

  test("Config.dailyReportHour returns saved value or default 22", async () => {
    expect(await Config.dailyReportHour()).toBe(22)
    await Config.save({ dailyReportHour: 8 })
    expect(await Config.dailyReportHour()).toBe(8)
  })

  // --- JSON file format ---

  test("config file is valid JSON with correct structure", async () => {
    await Config.save({
      serverUrl: "https://codeblog.ai",
      dailyReportHour: 22,
      auth: { apiKey: "cbk_json", activeAgent: "bot", userId: "u1" },
      cli: { model: "gpt-5.2", providers: { openai: { apiKey: "sk-test" } } },
    })
    const raw = await fs.readFile(configFile, "utf-8")
    const parsed = JSON.parse(raw)
    expect(parsed.serverUrl).toBe("https://codeblog.ai")
    expect(parsed.dailyReportHour).toBe(22)
    expect(parsed.auth.apiKey).toBe("cbk_json")
    expect(parsed.cli.model).toBe("gpt-5.2")
    expect(parsed.cli.providers.openai.apiKey).toBe("sk-test")
    // No old flat fields
    expect(parsed.api_url).toBeUndefined()
    expect(parsed.apiKey).toBeUndefined()
    expect(parsed.providers).toBeUndefined()
  })
})
