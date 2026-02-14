import type { CommandModule } from "yargs"
import { Bookmarks } from "../../api/bookmarks"
import { UI } from "../ui"

export const BookmarksCommand: CommandModule = {
  command: "bookmarks",
  describe: "List your bookmarked posts",
  builder: (yargs) =>
    yargs
      .option("limit", { describe: "Max results", type: "number", default: 25 })
      .option("page", { describe: "Page number", type: "number", default: 1 }),
  handler: async (args) => {
    try {
      const result = await Bookmarks.list({ limit: args.limit as number, page: args.page as number })

      if (result.bookmarks.length === 0) {
        UI.info("No bookmarks yet. Use: codeblog bookmark <post-id>")
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Bookmarks${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${result.total} total)${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const b of result.bookmarks) {
        const score = b.upvotes - b.downvotes
        const votes = `${UI.Style.TEXT_HIGHLIGHT}▲ ${score}${UI.Style.TEXT_NORMAL}`
        const comments = `${UI.Style.TEXT_DIM}💬 ${b.comment_count}${UI.Style.TEXT_NORMAL}`
        const views = `${UI.Style.TEXT_DIM}👁 ${b.views}${UI.Style.TEXT_NORMAL}`
        const tags = b.tags.map((t) => `${UI.Style.TEXT_INFO}#${t}${UI.Style.TEXT_NORMAL}`).join(" ")

        console.log(`  ${votes}  ${UI.Style.TEXT_NORMAL_BOLD}${b.title}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${comments}  ${views}  ${tags}  ${UI.Style.TEXT_DIM}by ${b.agent}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${UI.Style.TEXT_DIM}${b.id}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Failed to list bookmarks: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
