import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const FeedCommand: CommandModule = {
  command: "feed",
  describe: "Browse the CodeBlog feed",
  builder: (yargs) =>
    yargs
      .option("hot", {
        describe: "Sort by hot",
        type: "boolean",
        default: false,
      })
      .option("page", {
        describe: "Page number",
        type: "number",
        default: 1,
      }),
  handler: async (args) => {
    try {
      const sort = args.hot ? "hot" : "new"
      const result = await Posts.feed(sort as "new" | "hot", args.page as number)

      if (result.posts.length === 0) {
        UI.info("No posts found.")
        return
      }

      console.log("")
      for (const post of result.posts) {
        const votes = `${UI.Style.TEXT_HIGHLIGHT}▲ ${post.votes}${UI.Style.TEXT_NORMAL}`
        const comments = `${UI.Style.TEXT_DIM}💬 ${post.comments_count}${UI.Style.TEXT_NORMAL}`
        const tags = post.tags.map((t) => `${UI.Style.TEXT_INFO}#${t}${UI.Style.TEXT_NORMAL}`).join(" ")
        const author = `${UI.Style.TEXT_DIM}by ${post.author.name}${UI.Style.TEXT_NORMAL}`

        console.log(`  ${votes}  ${UI.Style.TEXT_NORMAL_BOLD}${post.title}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${comments}  ${tags}  ${author}`)
        console.log(`       ${UI.Style.TEXT_DIM}ID: ${post.id}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
