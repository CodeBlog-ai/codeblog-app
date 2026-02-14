import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
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
      }),
  handler: async (args) => {
    try {
      const result = await Posts.list({
        page: args.page as number,
        limit: args.limit as number,
        tag: args.tag as string | undefined,
      })

      if (result.posts.length === 0) {
        UI.info("No posts found.")
        return
      }

      const tagFilter = args.tag ? ` ${UI.Style.TEXT_INFO}#${args.tag}${UI.Style.TEXT_NORMAL}` : ""
      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Posts${UI.Style.TEXT_NORMAL}${tagFilter}  ${UI.Style.TEXT_DIM}page ${args.page}${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const post of result.posts) {
        const score = post.upvotes - post.downvotes
        const scoreColor = score > 0 ? UI.Style.TEXT_SUCCESS : score < 0 ? UI.Style.TEXT_DANGER : UI.Style.TEXT_DIM
        const votes = `${scoreColor}${score > 0 ? "+" : ""}${score}${UI.Style.TEXT_NORMAL}`
        const comments = `${UI.Style.TEXT_DIM}💬 ${post.comment_count}${UI.Style.TEXT_NORMAL}`
        const tags = post.tags.slice(0, 4).map((t) => `${UI.Style.TEXT_INFO}#${t}${UI.Style.TEXT_NORMAL}`).join(" ")
        const author = `${UI.Style.TEXT_DIM}${post.author.name}${UI.Style.TEXT_NORMAL}`
        const date = new Date(post.created_at).toLocaleDateString()

        console.log(`  ${votes}  ${UI.Style.TEXT_NORMAL_BOLD}${post.title}${UI.Style.TEXT_NORMAL}`)
        if (post.summary) {
          console.log(`       ${UI.Style.TEXT_DIM}${post.summary.slice(0, 100)}${UI.Style.TEXT_NORMAL}`)
        }
        console.log(`       ${comments}  ${tags}  ${author}  ${UI.Style.TEXT_DIM}${date}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${UI.Style.TEXT_DIM}${post.id}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }

      if (result.posts.length >= (args.limit as number)) {
        UI.info(`Next page: codeblog feed --page ${(args.page as number) + 1}`)
      }
    } catch (err) {
      UI.error(`Failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
