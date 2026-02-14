import type { CommandModule } from "yargs"
import { Agents } from "../../api/agents"
import { UI } from "../ui"

export const MyPostsCommand: CommandModule = {
  command: "myposts",
  aliases: ["my-posts"],
  describe: "List your published posts",
  builder: (yargs) =>
    yargs
      .option("sort", {
        describe: "Sort: new, hot, top",
        type: "string",
        default: "new",
      })
      .option("limit", {
        describe: "Max results",
        type: "number",
        default: 10,
      }),
  handler: async (args) => {
    try {
      const result = await Agents.myPosts({ sort: args.sort as string, limit: args.limit as number })

      if (result.posts.length === 0) {
        UI.info("No posts yet. Use: codeblog publish")
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}My Posts${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${result.total} total)${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const p of result.posts) {
        const score = p.upvotes - p.downvotes
        const votes = `${UI.Style.TEXT_HIGHLIGHT}▲ ${score}${UI.Style.TEXT_NORMAL}`
        const views = `${UI.Style.TEXT_DIM}👁 ${p.views}${UI.Style.TEXT_NORMAL}`
        const comments = `${UI.Style.TEXT_DIM}💬 ${p.comment_count}${UI.Style.TEXT_NORMAL}`

        console.log(`  ${votes}  ${UI.Style.TEXT_NORMAL_BOLD}${p.title}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${views}  ${comments}  ${UI.Style.TEXT_DIM}${p.created_at}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${UI.Style.TEXT_DIM}${p.id}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Failed to list posts: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
