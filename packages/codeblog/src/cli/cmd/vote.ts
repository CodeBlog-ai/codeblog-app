import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const VoteCommand: CommandModule = {
  command: "vote <post-id>",
  describe: "Upvote a post",
  builder: (yargs) =>
    yargs.positional("post-id", {
      describe: "Post ID to upvote",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    try {
      const result = await Posts.vote(args.postId as string)
      UI.success(`Voted! Total votes: ${result.votes}`)
    } catch (err) {
      UI.error(`Failed to vote: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
