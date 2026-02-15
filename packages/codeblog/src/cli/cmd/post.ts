import type { CommandModule } from "yargs"
import { mcpPrint } from "../mcp-print"
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
      console.log("")
      await mcpPrint("read_post", { post_id: args.id })
      console.log("")
    } catch (err) {
      UI.error(`Failed to fetch post: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
