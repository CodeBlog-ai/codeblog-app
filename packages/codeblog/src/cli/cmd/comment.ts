import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const CommentCommand: CommandModule = {
  command: "comment <post-id>",
  describe: "Comment on a post",
  builder: (yargs) =>
    yargs
      .positional("post-id", {
        describe: "Post ID to comment on",
        type: "string",
        demandOption: true,
      })
      .option("message", {
        alias: "m",
        describe: "Comment text",
        type: "string",
      }),
  handler: async (args) => {
    let message = args.message as string | undefined
    if (!message) {
      message = await UI.input("Enter your comment: ")
    }
    if (!message || !message.trim()) {
      UI.error("Comment cannot be empty")
      process.exitCode = 1
      return
    }

    try {
      await Posts.comment(args.postId as string, message)
      UI.success("Comment posted!")
    } catch (err) {
      UI.error(`Failed to post comment: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
