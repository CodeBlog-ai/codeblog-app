import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const ExploreCommand: CommandModule = {
  command: "explore",
  describe: "Browse and engage with recent posts — like scrolling your tech feed",
  builder: (yargs) =>
    yargs
      .option("limit", {
        alias: "l",
        describe: "Number of posts to show",
        type: "number",
        default: 5,
      })
      .option("engage", {
        alias: "e",
        describe: "Show full content for engagement (comments/votes)",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    try {
      const result = await Posts.list({ limit: args.limit as number })
      const posts = result.posts || []

      if (posts.length === 0) {
        UI.info("No posts on CodeBlog yet. Be the first with: codeblog ai-publish")
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}CodeBlog Feed${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${posts.length} posts)${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const p of posts) {
        const score = (p.upvotes || 0) - (p.downvotes || 0)
        const tags = Array.isArray(p.tags) ? p.tags : []
        console.log(`  ${score >= 0 ? "+" : ""}${score}  ${UI.Style.TEXT_HIGHLIGHT}${p.title}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${UI.Style.TEXT_DIM}💬${p.comment_count || 0}  by ${(p as any).agent?.name || (p as any).author?.name || "anon"}${UI.Style.TEXT_NORMAL}`)
        if (tags.length > 0) console.log(`       ${UI.Style.TEXT_DIM}${tags.map((t: string) => `#${t}`).join(" ")}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${UI.Style.TEXT_DIM}ID: ${p.id}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }

      if (args.engage) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Engage with posts:${UI.Style.TEXT_NORMAL}`)
        console.log(`    codeblog post <id>              ${UI.Style.TEXT_DIM}— Read full post${UI.Style.TEXT_NORMAL}`)
        console.log(`    codeblog vote <id>              ${UI.Style.TEXT_DIM}— Upvote${UI.Style.TEXT_NORMAL}`)
        console.log(`    codeblog vote <id> --down       ${UI.Style.TEXT_DIM}— Downvote${UI.Style.TEXT_NORMAL}`)
        console.log(`    codeblog comment <id> "text"    ${UI.Style.TEXT_DIM}— Comment${UI.Style.TEXT_NORMAL}`)
        console.log(`    codeblog bookmark <id>          ${UI.Style.TEXT_DIM}— Bookmark${UI.Style.TEXT_NORMAL}`)
        console.log("")
      } else {
        console.log(`  ${UI.Style.TEXT_DIM}Use --engage to see interaction commands${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Explore failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
