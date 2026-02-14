import type { CommandModule } from "yargs"
import { Config } from "../../config"
import { AIProvider } from "../../ai/provider"
import { UI } from "../ui"

export const ConfigCommand: CommandModule = {
  command: "config",
  describe: "Configure AI provider and model settings",
  builder: (yargs) =>
    yargs
      .option("provider", {
        describe: "AI provider: anthropic, openai, google",
        type: "string",
      })
      .option("api-key", {
        describe: "API key for the provider",
        type: "string",
      })
      .option("model", {
        describe: "Default model ID",
        type: "string",
      })
      .option("list", {
        describe: "List available models and their status",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    try {
      if (args.list) {
        const models = await AIProvider.available()
        console.log("")
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Available Models${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const { model, hasKey } of models) {
          const status = hasKey ? `${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL}` : `${UI.Style.TEXT_DIM}✗${UI.Style.TEXT_NORMAL}`
          console.log(`  ${status}  ${UI.Style.TEXT_NORMAL_BOLD}${model.name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${model.id})${UI.Style.TEXT_NORMAL}`)
          console.log(`       ${UI.Style.TEXT_DIM}${model.providerID} · ${(model.contextWindow / 1000).toFixed(0)}k context${UI.Style.TEXT_NORMAL}`)
        }
        console.log("")
        console.log(`  ${UI.Style.TEXT_DIM}✓ = API key configured, ✗ = needs key${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Set key: codeblog config --provider anthropic --api-key sk-...${UI.Style.TEXT_NORMAL}`)
        console.log("")
        return
      }

      if (args.provider && args.apiKey) {
        const provider = args.provider as string
        if (!["anthropic", "openai", "google"].includes(provider)) {
          UI.error("Provider must be: anthropic, openai, or google")
          process.exitCode = 1
          return
        }
        const cfg = await Config.load() as Record<string, unknown>
        const providers = (cfg.providers || {}) as Record<string, Record<string, string>>
        providers[provider] = { ...providers[provider], api_key: args.apiKey as string }
        await Config.save({ ...cfg, providers } as unknown as Config.CodeblogConfig)
        UI.success(`${provider} API key saved`)
        return
      }

      if (args.model) {
        const model = args.model as string
        if (!AIProvider.MODELS[model]) {
          UI.error(`Unknown model: ${model}. Run: codeblog config --list`)
          process.exitCode = 1
          return
        }
        const cfg = await Config.load() as Record<string, unknown>
        await Config.save({ ...cfg, model } as unknown as Config.CodeblogConfig)
        UI.success(`Default model set to ${model}`)
        return
      }

      // Show current config
      const cfg = await Config.load() as Record<string, unknown>
      const model = (cfg.model as string) || AIProvider.DEFAULT_MODEL
      const providers = (cfg.providers || {}) as Record<string, Record<string, string>>

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Current Config${UI.Style.TEXT_NORMAL}`)
      console.log("")
      console.log(`  Model:     ${UI.Style.TEXT_HIGHLIGHT}${model}${UI.Style.TEXT_NORMAL}`)
      console.log(`  API URL:   ${cfg.api_url || "https://codeblog.ai"}`)
      console.log("")
      for (const [id, p] of Object.entries(providers)) {
        const masked = p.api_key ? p.api_key.slice(0, 8) + "..." : "not set"
        console.log(`  ${id}: ${UI.Style.TEXT_DIM}${masked}${UI.Style.TEXT_NORMAL}`)
      }
      console.log("")
    } catch (err) {
      UI.error(`Config failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
