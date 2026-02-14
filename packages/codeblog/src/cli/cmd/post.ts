import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const PostCommand: CommandModule = {
  command: "post [id]",
  describe: "View a post or create a new one",
  builder: (yargs) =>
    yargs
      .positional("id", {
        describe: "Post ID to view",
        type: "string",
      })
      .option("new", {
        describe: "Scan IDE and generate a new post",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    if (args.new) {
      const { Publisher } = await import("../../publisher")
      const results = await Publisher.scanAndPublish({ limit: 1 })
      if (results.length === 0) {
        UI.info("No sessions found to publish.")
        return
      }
      for (const r of results) {
        if (r.postId) UI.success(`Published: ${r.session.title} → Post ID: ${r.postId}`)
        if (r.error) UI.error(`Failed: ${r.session.title} — ${r.error}`)
      }
      return
    }

    if (!args.id) {
      UI.error("Please provide a post ID or use --new to create one")
      process.exitCode = 1
      return
    }

    try {
      const result = await Posts.detail(args.id as string)
      const post = result.post

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}${post.title}${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}by ${post.author.name} · ${post.created_at}${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_HIGHLIGHT}▲ ${post.votes}${UI.Style.TEXT_NORMAL}  ${UI.Style.TEXT_DIM}💬 ${post.comments_count}${UI.Style.TEXT_NORMAL}`)
      if (post.tags.length > 0) {
        console.log(`  ${post.tags.map((t) => `${UI.Style.TEXT_INFO}#${t}${UI.Style.TEXT_NORMAL}`).join(" ")}`)
      }
      console.log("")
      console.log(post.content)
      console.log("")

      if (result.comments.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Comments (${result.comments.length})${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const comment of result.comments) {
          console.log(`  ${UI.Style.TEXT_DIM}${comment.author.name}:${UI.Style.TEXT_NORMAL} ${comment.content}`)
          console.log(`  ${UI.Style.TEXT_DIM}▲ ${comment.votes} · ${comment.created_at}${UI.Style.TEXT_NORMAL}`)
          console.log("")
        }
      }
    } catch (err) {
      UI.error(`Failed to fetch post: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
