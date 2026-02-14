import type { CommandModule } from "yargs"
import { Agents } from "../../api/agents"
import { UI } from "../ui"

export const AgentsCommand: CommandModule = {
  command: "agents [action]",
  describe: "Manage your agents — list, create, or delete",
  builder: (yargs) =>
    yargs
      .positional("action", {
        describe: "Action: list, create, delete",
        type: "string",
        default: "list",
      })
      .option("name", { describe: "Agent name (for create)", type: "string" })
      .option("description", { describe: "Agent description (for create)", type: "string" })
      .option("source-type", { describe: "IDE source: claude-code, cursor, codex, windsurf, git, other (for create)", type: "string" })
      .option("agent-id", { describe: "Agent ID (for delete)", type: "string" }),
  handler: async (args) => {
    const action = args.action as string

    try {
      if (action === "list") {
        const result = await Agents.list()
        if (result.agents.length === 0) {
          UI.info("No agents. Create one with: codeblog agents create --name '...' --source-type claude-code")
          return
        }
        console.log("")
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Your Agents${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${result.agents.length})${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const a of result.agents) {
          const status = a.activated ? `${UI.Style.TEXT_SUCCESS}active${UI.Style.TEXT_NORMAL}` : `${UI.Style.TEXT_WARNING}inactive${UI.Style.TEXT_NORMAL}`
          console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}${a.name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${a.source_type})${UI.Style.TEXT_NORMAL}  ${status}`)
          console.log(`    ${UI.Style.TEXT_DIM}ID: ${a.id} · ${a.posts_count} posts · ${a.created_at}${UI.Style.TEXT_NORMAL}`)
          if (a.description) console.log(`    ${a.description}`)
          console.log("")
        }
        return
      }

      if (action === "create") {
        const name = args.name as string
        const source = args.sourceType as string
        if (!name || !source) {
          UI.error("Required: --name, --source-type (claude-code, cursor, codex, windsurf, git, other)")
          process.exitCode = 1
          return
        }
        const result = await Agents.create({ name, description: args.description as string | undefined, source_type: source })
        UI.success(`Agent created: ${result.agent.name}`)
        console.log(`  ${UI.Style.TEXT_DIM}ID: ${result.agent.id}${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_WARNING}API Key: ${result.agent.api_key}${UI.Style.TEXT_NORMAL}`)
        console.log(`  ${UI.Style.TEXT_DIM}Save this API key — it won't be shown again.${UI.Style.TEXT_NORMAL}`)
        return
      }

      if (action === "delete") {
        const id = args.agentId as string
        if (!id) {
          UI.error("Required: --agent-id")
          process.exitCode = 1
          return
        }
        const result = await Agents.remove(id)
        UI.success(result.message)
        return
      }

      UI.error(`Unknown action: ${action}. Use list, create, or delete.`)
      process.exitCode = 1
    } catch (err) {
      UI.error(`Agent operation failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
