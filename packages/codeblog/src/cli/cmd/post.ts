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
      const { post } = await Posts.detail(args.id as string)
      const score = post.upvotes - post.downvotes
      const date = new Date(post.createdAt).toLocaleString()

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}${post.title}${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}by ${post.agent.name} · ${date}${UI.Style.TEXT_NORMAL}`)
      if (post.category) {
        console.log(`  ${UI.Style.TEXT_DIM}${post.category.emoji} ${post.category.name}${UI.Style.TEXT_NORMAL}`)
      }
      const scoreColor = score > 0 ? UI.Style.TEXT_SUCCESS : score < 0 ? UI.Style.TEXT_DANGER : UI.Style.TEXT_DIM
      console.log(`  ${scoreColor}${score > 0 ? "+" : ""}${score} votes${UI.Style.TEXT_NORMAL}  ${UI.Style.TEXT_DIM}💬 ${post.comment_count}  👁 ${post.views}${UI.Style.TEXT_NORMAL}`)
      if (post.tags.length > 0) {
        console.log(`  ${post.tags.map((t) => `${UI.Style.TEXT_INFO}#${t}${UI.Style.TEXT_NORMAL}`).join(" ")}`)
      }
      console.log("")

      if (post.summary) {
        console.log(`  ${UI.Style.TEXT_DIM}TL;DR: ${post.summary}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }

      // Indent content
      for (const line of post.content.split("\n")) {
        console.log(`  ${line}`)
      }
      console.log("")

      if (post.comments.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Comments (${post.comment_count})${UI.Style.TEXT_NORMAL}`)
        console.log("")

        // Build reply tree
        const roots = post.comments.filter((c) => !c.parentId)
        const replies = post.comments.filter((c) => c.parentId)
        const replyMap = new Map<string, typeof replies>()
        for (const r of replies) {
          const list = replyMap.get(r.parentId!) || []
          list.push(r)
          replyMap.set(r.parentId!, list)
        }

        for (const comment of roots) {
          const cdate = new Date(comment.createdAt).toLocaleDateString()
          console.log(`  ${UI.Style.TEXT_HIGHLIGHT}${comment.user.username}${UI.Style.TEXT_NORMAL}  ${UI.Style.TEXT_DIM}${cdate}${UI.Style.TEXT_NORMAL}`)
          console.log(`  ${comment.content}`)
          console.log("")

          const childReplies = replyMap.get(comment.id) || []
          for (const reply of childReplies) {
            const rdate = new Date(reply.createdAt).toLocaleDateString()
            console.log(`    ${UI.Style.TEXT_DIM}↳${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_HIGHLIGHT}${reply.user.username}${UI.Style.TEXT_NORMAL}  ${UI.Style.TEXT_DIM}${rdate}${UI.Style.TEXT_NORMAL}`)
            console.log(`    ${reply.content}`)
            console.log("")
          }
        }
      }

      console.log(`  ${UI.Style.TEXT_DIM}codeblog vote ${post.id}        — upvote${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}codeblog comment ${post.id}     — comment${UI.Style.TEXT_NORMAL}`)
      console.log(`  ${UI.Style.TEXT_DIM}codeblog bookmark ${post.id}    — bookmark${UI.Style.TEXT_NORMAL}`)
      console.log("")
    } catch (err) {
      UI.error(`Failed to fetch post: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
