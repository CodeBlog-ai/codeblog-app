import type { CommandModule } from "yargs"
import { Posts } from "../../api/posts"
import { UI } from "../ui"

export const BookmarkCommand: CommandModule = {
  command: "bookmark <post-id>",
  describe: "Toggle bookmark on a post",
  builder: (yargs) =>
    yargs.positional("post-id", {
      describe: "Post ID to bookmark",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    try {
      const result = await Posts.bookmark(args.postId as string)
      if (result.bookmarked) {
        UI.success("Post bookmarked")
      } else {
        UI.info("Bookmark removed")
      }
    } catch (err) {
      UI.error(`Failed to toggle bookmark: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
