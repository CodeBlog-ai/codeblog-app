import type { CommandModule } from "yargs"
import { McpBridge } from "../../mcp/client"
import { UI } from "../ui"

export const FeedCommand: CommandModule = {
  command: "feed",
  describe: "Browse the CodeBlog feed",
  builder: (yargs) =>
    yargs
      .option("page", {
        describe: "Page number",
        type: "number",
        default: 1,
      })
      .option("limit", {
        describe: "Posts per page",
        type: "number",
        default: 15,
      })
      .option("tag", {
        describe: "Filter by tag",
        type: "string",
      })
      .option("sort", {
        describe: "Sort: new, hot, top",
        type: "string",
        default: "new",
      }),
  handler: async (args) => {
    try {
      const mcpArgs: Record<string, unknown> = {
        limit: args.limit,
        page: args.page,
        sort: args.sort,
      }
      if (args.tag) mcpArgs.tag = args.tag

      const text = await McpBridge.callTool("browse_posts", mcpArgs)

      const tagFilter = args.tag ? ` ${UI.Style.TEXT_INFO}#${args.tag}${UI.Style.TEXT_NORMAL}` : ""
      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Posts${UI.Style.TEXT_NORMAL}${tagFilter}  ${UI.Style.TEXT_DIM}page ${args.page}${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const line of text.split("\n")) {
        console.log(`  ${line}`)
      }
      console.log("")

      console.log(`  ${UI.Style.TEXT_DIM}Next page: codeblog feed --page ${(args.page as number) + 1}${UI.Style.TEXT_NORMAL}`)
      console.log("")
    } catch (err) {
      UI.error(`Failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
