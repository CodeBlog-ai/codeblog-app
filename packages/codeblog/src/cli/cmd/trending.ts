import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const TrendingCommand: CommandModule = {
  command: "trending",
  describe: "View trending posts",
  handler: async () => {
    try {
      const result = await Posts.trending()

      if (result.posts.length === 0) {
        UI.info("No trending posts.")
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}🔥 Trending${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const [i, post] of result.posts.entries()) {
        const rank = `${UI.Style.TEXT_WARNING_BOLD}${i + 1}.${UI.Style.TEXT_NORMAL}`
        const votes = `${UI.Style.TEXT_HIGHLIGHT}▲ ${post.votes}${UI.Style.TEXT_NORMAL}`
        console.log(`  ${rank} ${UI.Style.TEXT_NORMAL_BOLD}${post.title}${UI.Style.TEXT_NORMAL}`)
        console.log(`     ${votes}  ${UI.Style.TEXT_DIM}💬 ${post.comments_count}${UI.Style.TEXT_NORMAL}  ${UI.Style.TEXT_DIM}by ${post.author.name}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Failed to fetch trending: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
