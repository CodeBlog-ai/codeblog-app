import type { CommandModule } from "yargs"
import { Config } from "../../config"
import { AIProvider } from "../../ai/provider"
import { UI } from "../ui"

function validUrl(input: string): boolean {
  try {
    const url = new URL(input)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function argError(message: string, hint?: string) {
  UI.error(message)
  if (hint) UI.info(hint)
  process.exitCode = 2
}

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
      .option("base-url", {
        describe: "Custom base URL for the provider (for third-party API proxies)",
        type: "string",
      })
      .option("language", {
        describe: "Default content language for posts (e.g. English, 中文, 日本語)",
        type: "string",
      }),
  handler: async (args) => {
    try {
      const provider = typeof args.provider === "string" ? args.provider.trim() : ""
      const apiKey = typeof args.apiKey === "string" ? args.apiKey.trim() : ""
      const model = typeof args.model === "string" ? args.model.trim() : ""
      const url = typeof args.url === "string" ? args.url.trim() : ""
      const baseUrl = typeof args.baseUrl === "string" ? args.baseUrl.trim() : ""
      const language = typeof args.language === "string" ? args.language.trim() : ""

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

      if (!provider && (apiKey || baseUrl)) {
        argError("--api-key/--base-url requires --provider", "Example: codeblog config --provider openai --api-key sk-...")
        return
      }

      if (provider && !apiKey && !baseUrl) {
        argError("--provider requires --api-key or --base-url", "Example: codeblog config --provider anthropic --api-key sk-ant-...")
        return
      }

      if (url && !validUrl(url)) {
        argError("Invalid --url. Use an absolute http/https URL", "Example: codeblog config --url https://codeblog.ai")
        return
      }

      if (baseUrl && !validUrl(baseUrl)) {
        argError("Invalid --base-url. Use an absolute http/https URL", "Example: codeblog config --provider openai-compatible --base-url https://proxy.example.com")
        return
      }

      if (provider && (apiKey || baseUrl)) {
        const cfg = await Config.load()
        const providers = cfg.providers || {}
        const existing = providers[provider] || {} as Config.ProviderConfig
        if (apiKey) existing.api_key = apiKey
        if (baseUrl) existing.base_url = baseUrl
        providers[provider] = existing
        await Config.save({ providers })
        const parts: string[] = []
        if (apiKey) parts.push("API key")
        if (baseUrl) parts.push(`base URL (${baseUrl})`)
        UI.success(`${provider} ${parts.join(" + ")} saved`)
        return
      }

      if (model) {
        await Config.save({ model })
        UI.success(`Default model set to ${model}`)
        return
      }

      if (url) {
        await Config.save({ api_url: url })
        UI.success(`Server URL set to ${url}`)
        return
      }

      if (language) {
        await Config.save({ default_language: language })
        UI.success(`Default language set to ${language}`)
        return
      }

      // Show current config
      const cfg = await Config.load()
      const currentModel = cfg.model || AIProvider.DEFAULT_MODEL
      const providers = cfg.providers || {}

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Current Config${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}${Config.filepath}${UI.Style.TEXT_NORMAL}`)
      console.log("")
      console.log(`  Model:     ${UI.Style.TEXT_HIGHLIGHT}${currentModel}${UI.Style.TEXT_NORMAL}`)
      console.log(`  API URL:   ${cfg.api_url || "https://codeblog.ai"}`)
      console.log(`  Language:  ${cfg.default_language || `${UI.Style.TEXT_DIM}(server default)${UI.Style.TEXT_NORMAL}`}`)
      console.log("")

      if (Object.keys(providers).length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}AI Providers${UI.Style.TEXT_NORMAL}`)
        for (const [id, p] of Object.entries(providers)) {
          const masked = p.api_key ? p.api_key.slice(0, 8) + "..." : "not set"
          const url = p.base_url ? ` → ${p.base_url}` : ""
          console.log(`    ${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL} ${id}: ${UI.Style.TEXT_DIM}${masked}${url}${UI.Style.TEXT_NORMAL}`)
        }
      } else {
        console.log(`  ${UI.Style.TEXT_DIM}No AI providers configured.${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Set one: codeblog config --provider anthropic --api-key sk-...${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Third-party proxy: codeblog config --provider anthropic --api-key sk-... --base-url https://proxy.example.com${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Or use env: ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL${UI.Style.TEXT_NORMAL}`)
      }
      console.log("")
    } catch (err) {
      UI.error(`Config failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
