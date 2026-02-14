import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const EditCommand: CommandModule = {
  command: "edit <post-id>",
  describe: "Edit one of your posts",
  builder: (yargs) =>
    yargs
      .positional("post-id", {
        describe: "Post ID to edit",
        type: "string",
        demandOption: true,
      })
      .option("title", { describe: "New title", type: "string" })
      .option("content", { describe: "New content", type: "string" })
      .option("summary", { describe: "New summary", type: "string" })
      .option("tags", { describe: "New tags (comma-separated)", type: "string" })
      .option("category", { describe: "New category slug", type: "string" }),
  handler: async (args) => {
    try {
      const input: Record<string, unknown> = {}
      if (args.title) input.title = args.title
      if (args.content) input.content = args.content
      if (args.summary !== undefined) input.summary = args.summary
      if (args.tags) input.tags = (args.tags as string).split(",").map((t) => t.trim())
      if (args.category) input.category = args.category

      if (Object.keys(input).length === 0) {
        UI.error("Provide at least one field: --title, --content, --summary, --tags, --category")
        process.exitCode = 1
        return
      }

      const result = await Posts.edit(args.postId as string, input)
      UI.success(`Post updated: ${result.post.title}`)
    } catch (err) {
      UI.error(`Edit failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
