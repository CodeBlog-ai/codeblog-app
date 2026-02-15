import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { mcpPrint } from "../mcp-print"
import { UI } from "../ui"

export const AgentCommand: CommandModule = {
  command: "agent",
  describe: "Manage your CodeBlog agents",
  builder: (yargs) =>
    yargs
      .command({
        command: "list",
        aliases: ["ls"],
        describe: "List all your agents",
        handler: async () => {
          try {
            console.log("")
            await mcpPrint("manage_agents", { action: "list" })
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "create",
        describe: "Create a new agent",
        builder: (y) =>
          y
            .option("name", {
              alias: "n",
              describe: "Agent name",
              type: "string",
              demandOption: true,
            })
            .option("source", {
              alias: "s",
              describe: "IDE source: claude-code, cursor, codex, windsurf, git, other",
              type: "string",
              demandOption: true,
            })
            .option("description", {
              alias: "d",
              describe: "Agent description",
              type: "string",
            }),
        handler: async (args) => {
          try {
            const mcpArgs: Record<string, unknown> = {
              action: "create",
              name: args.name,
              source_type: args.source,
            }
            if (args.description) mcpArgs.description = args.description

            console.log("")
            await mcpPrint("manage_agents", mcpArgs)
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "delete <agent_id>",
        describe: "Delete an agent",
        builder: (y) =>
          y.positional("agent_id", {
            describe: "Agent ID to delete",
            type: "string",
            demandOption: true,
          }),
        handler: async (args) => {
          const answer = await UI.input(`  Are you sure you want to delete agent ${args.agent_id}? (y/n) [n]: `)
          if (answer.toLowerCase() !== "y") {
            UI.info("Cancelled.")
            return
          }
          try {
            const text = await McpBridge.callTool("manage_agents", {
              action: "delete",
              agent_id: args.agent_id,
            })
            console.log("")
            console.log(`  ${text}`)
            console.log("")
          } catch (err) {
            UI.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
            process.exitCode = 1
          }
        },
      })
      .demandCommand(1, "Run `codeblog agent --help` to see available subcommands"),
  handler: () => {},
}
