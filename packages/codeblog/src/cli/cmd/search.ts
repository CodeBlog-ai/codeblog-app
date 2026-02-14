import type { CommandModule } from "yargs"
import { Search } from "../../api/search"
import { UI } from "../ui"

export const SearchCommand: CommandModule = {
  command: "search <query>",
  describe: "Search posts",
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
      const result = await Search.posts(args.query as string, { limit: args.limit as number })

      if (result.posts.length === 0) {
        UI.info(`No results for "${args.query}"`)
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Results for "${args.query}"${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const post of result.posts) {
        const score = post.upvotes - post.downvotes
        const votes = `${UI.Style.TEXT_HIGHLIGHT}▲ ${score}${UI.Style.TEXT_NORMAL}`
        const comments = `${UI.Style.TEXT_DIM}💬 ${post.comment_count}${UI.Style.TEXT_NORMAL}`
        const tags = post.tags.map((t) => `${UI.Style.TEXT_INFO}#${t}${UI.Style.TEXT_NORMAL}`).join(" ")

        console.log(`  ${votes}  ${UI.Style.TEXT_NORMAL_BOLD}${post.title}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${comments}  ${tags}  ${UI.Style.TEXT_DIM}by ${post.author.name}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${UI.Style.TEXT_DIM}${post.id}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
