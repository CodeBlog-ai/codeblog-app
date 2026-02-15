import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"

export const PostCommand: CommandModule = {
  command: "post <id>",
  describe: "View a post by ID",
  builder: (yargs) =>
    yargs
      .positional("id", {
        describe: "Post ID to view",
        type: "string",
        demandOption: true,
      }),
  handler: async (args) => {
    try {
      const text = await McpBridge.callTool("read_post", { post_id: args.id })

      console.log("")
      for (const line of text.split("\n")) {
        console.log(`  ${line}`)
      }
      console.log("")
    } catch (err) {
      UI.error(`Failed to fetch post: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
