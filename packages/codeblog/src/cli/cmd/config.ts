import type { CommandModule } from "yargs"
import { Config } from "../../config"
import { AIProvider } from "../../ai/provider"
import { UI } from "../ui"

export const ConfigCommand: CommandModule = {
  command: "config",
  describe: "Configure AI provider, model, and server settings",
  builder: (yargs) =>
    yargs
      .option("provider", {
        describe: "AI provider: anthropic, openai, google, xai, mistral, groq, etc.",
        type: "string",
      })
      .option("api-key", {
        describe: "API key for the provider",
        type: "string",
      })
      .option("model", {
        alias: "m",
        describe: "Set default AI model (e.g. claude-sonnet-4-20250514, gpt-4o)",
        type: "string",
      })
      .option("url", {
        describe: "Set CodeBlog server URL",
        type: "string",
      })
      .option("list", {
        alias: "l",
        describe: "List available models and their status",
        type: "boolean",
        default: false,
      })
      .option("path", {
        describe: "Show config file path",
        type: "boolean",
        default: false,
      })
      .option("language", {
        describe: "Default content language for posts (e.g. English, 中文, 日本語)",
        type: "string",
      }),
  handler: async (args) => {
    try {
      if (args.path) {
        console.log(Config.filepath)
        return
      }

      if (args.list) {
        const models = await AIProvider.available()
        const providers = await AIProvider.listProviders()

        console.log("")
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Providers${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${Object.keys(providers).length} from models.dev)${UI.Style.TEXT_NORMAL}`)
        console.log("")

        const configured = Object.entries(providers).filter(([, p]) => p.hasKey)

        if (configured.length > 0) {
          console.log(`  ${UI.Style.TEXT_SUCCESS}Configured:${UI.Style.TEXT_NORMAL}`)
          for (const [, p] of configured) {
            console.log(`    ${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_NORMAL_BOLD}${p.name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${p.models.length} models)${UI.Style.TEXT_NORMAL}`)
          }
          console.log("")
        }

        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Built-in Models${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const { model, hasKey } of models) {
          const status = hasKey ? `${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL}` : `${UI.Style.TEXT_DIM}✗${UI.Style.TEXT_NORMAL}`
          console.log(`  ${status}  ${UI.Style.TEXT_NORMAL_BOLD}${model.name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${model.id})${UI.Style.TEXT_NORMAL}`)
          console.log(`       ${UI.Style.TEXT_DIM}${model.providerID} · ${(model.contextWindow / 1000).toFixed(0)}k context${UI.Style.TEXT_NORMAL}`)
        }
        console.log("")
        console.log(`  ${UI.Style.TEXT_DIM}✓ = API key configured, ✗ = needs key${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Set key: codeblog config --provider anthropic --api-key sk-...${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Any model from models.dev can be used with provider/model format${UI.Style.TEXT_NORMAL}`)
        console.log("")
        return
      }

      if (args.provider && args.apiKey) {
        const cfg = await Config.load()
        const providers = cfg.providers || {}
        providers[args.provider as string] = { ...providers[args.provider as string], api_key: args.apiKey as string }
        await Config.save({ providers })
        UI.success(`${args.provider} API key saved`)
        return
      }

      if (args.model) {
        await Config.save({ model: args.model as string })
        UI.success(`Default model set to ${args.model}`)
        return
      }

      if (args.url) {
        await Config.save({ api_url: args.url as string })
        UI.success(`Server URL set to ${args.url}`)
        return
      }

      if (args.language) {
        await Config.save({ default_language: args.language as string })
        UI.success(`Default language set to ${args.language}`)
        return
      }

      // Show current config
      const cfg = await Config.load()
      const model = cfg.model || AIProvider.DEFAULT_MODEL
      const providers = cfg.providers || {}

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Current Config${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}${Config.filepath}${UI.Style.TEXT_NORMAL}`)
      console.log("")
      console.log(`  Model:     ${UI.Style.TEXT_HIGHLIGHT}${model}${UI.Style.TEXT_NORMAL}`)
      console.log(`  API URL:   ${cfg.api_url || "https://codeblog.ai"}`)
      console.log(`  Language:  ${cfg.default_language || `${UI.Style.TEXT_DIM}(server default)${UI.Style.TEXT_NORMAL}`}`)
      console.log("")

      if (Object.keys(providers).length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}AI Providers${UI.Style.TEXT_NORMAL}`)
        for (const [id, p] of Object.entries(providers)) {
          const masked = p.api_key ? p.api_key.slice(0, 8) + "..." : "not set"
          console.log(`    ${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL} ${id}: ${UI.Style.TEXT_DIM}${masked}${UI.Style.TEXT_NORMAL}`)
        }
      } else {
        console.log(`  ${UI.Style.TEXT_DIM}No AI providers configured.${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Set one: codeblog config --provider anthropic --api-key sk-...${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Or use env: ANTHROPIC_API_KEY=sk-...${UI.Style.TEXT_NORMAL}`)
      }
      console.log("")
    } catch (err) {
      UI.error(`Config failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
