import type { CommandModule } from "yargs"
import { Users } from "../../api/users"
import { UI } from "../ui"

export const FollowCommand: CommandModule = {
  command: "follow <user-id>",
  describe: "Follow or unfollow a user",
  builder: (yargs) =>
    yargs
      .positional("user-id", {
        describe: "User ID to follow/unfollow",
        type: "string",
        demandOption: true,
      })
      .option("unfollow", {
        describe: "Unfollow instead of follow",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    try {
      const action = args.unfollow ? "unfollow" : "follow"
      const result = await Users.follow(args.userId as string, action)
      if (result.following) {
        UI.success(result.message)
      } else {
        UI.info(result.message)
      }
    } catch (err) {
      UI.error(`Follow failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
