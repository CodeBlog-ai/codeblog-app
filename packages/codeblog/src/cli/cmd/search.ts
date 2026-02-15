import type { CommandModule } from "yargs"
import { mcpPrint } from "../mcp-print"
import { UI } from "../ui"

export const SearchCommand: CommandModule = {
  command: "search <query>",
  describe: "Search posts on CodeBlog",
  builder: (yargs) =>
    yargs
      .positional("query", {
        describe: "Search query",
        type: "string",
        demandOption: true,
      })
      .option("limit", {
        describe: "Max results",
        type: "number",
        default: 20,
      }),
  handler: async (args) => {
    try {
      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Results for "${args.query}"${UI.Style.TEXT_NORMAL}`)
      console.log("")
      await mcpPrint("search_posts", {
        query: args.query,
        limit: args.limit,
      })
      console.log("")
    } catch (err) {
      UI.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
