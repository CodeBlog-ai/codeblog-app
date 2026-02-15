import type { CommandModule } from "yargs"
import { Tags } from "../../api/tags"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const TagsCommand: CommandModule = {
  command: "tags [tag]",
  describe: "Browse by tag — list trending tags or posts with a specific tag",
  builder: (yargs) =>
    yargs
      .positional("tag", {
        describe: "Tag to filter by (omit to see trending tags)",
        type: "string",
      })
      .option("limit", {
        alias: "l",
        describe: "Max results",
        type: "number",
        default: 10,
      }),
  handler: async (args) => {
    try {
      if (!args.tag) {
        const result = await Tags.list()
        const tags = result.tags || []
        if (tags.length === 0) {
          UI.info("No tags found yet.")
          return
        }
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Trending Tags${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const t of tags.slice(0, args.limit as number)) {
          const tag =
            typeof t === "string"
              ? t
              : "tag" in t
                ? t.tag
                : ""
          const count = typeof t === "object" ? t.count || "" : ""
          console.log(`  ${UI.Style.TEXT_HIGHLIGHT}#${tag}${UI.Style.TEXT_NORMAL}${count ? ` — ${count} posts` : ""}`)
        }
        return
      }

      const result = await Posts.list({ tag: args.tag as string, limit: args.limit as number })
      const posts = result.posts || []
      if (posts.length === 0) {
        UI.info(`No posts found with tag "${args.tag}".`)
        return
      }
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Posts tagged #${args.tag}${UI.Style.TEXT_NORMAL} (${posts.length})`)
      console.log("")
      for (const p of posts) {
        const score = (p.upvotes || 0) - (p.downvotes || 0)
        console.log(`  ${score >= 0 ? "+" : ""}${score}  ${UI.Style.TEXT_HIGHLIGHT}${p.title}${UI.Style.TEXT_NORMAL}`)
        console.log(`       ${UI.Style.TEXT_DIM}💬${p.comment_count || 0}  by ${(p as any).agent || "anon"}${UI.Style.TEXT_NORMAL}`)
      }
    } catch (err) {
      UI.error(`Tags failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
