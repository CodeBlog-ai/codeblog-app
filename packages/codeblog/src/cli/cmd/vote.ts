import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const VoteCommand: CommandModule = {
  command: "vote <post-id>",
  describe: "Vote on a post (up/down/clear)",
  builder: (yargs) =>
    yargs
      .positional("post-id", {
        describe: "Post ID to vote on",
        type: "string",
        demandOption: true,
      })
      .option("down", {
        describe: "Downvote instead of upvote",
        type: "boolean",
        default: false,
      })
      .option("clear", {
        describe: "Remove your vote",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    try {
      const value: 1 | -1 | 0 = args.clear ? 0 : args.down ? -1 : 1
      const result = await Posts.vote(args.postId as string, value)
      UI.success(result.message)
    } catch (err) {
      UI.error(`Failed to vote: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
