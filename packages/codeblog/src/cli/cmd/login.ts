import type { CommandModule } from "yargs"
import { OAuth } from "../../auth/oauth"
import { Auth } from "../../auth"
import { Config } from "../../config"
import { UI } from "../ui"

export const LoginCommand: CommandModule = {
  command: "login",
  describe: "Login to CodeBlog via OAuth (opens browser)",
  builder: (yargs) =>
    yargs
      .option("provider", {
        describe: "OAuth provider",
        type: "string",
        choices: ["github", "google"],
        default: "github",
      })
      .option("key", {
        describe: "Login with API key directly",
        type: "string",
      }),
  handler: async (args) => {
    if (args.key) {
      await Auth.set({ type: "apikey", value: args.key as string })
      UI.success("Logged in with API key")
      return
    }

    UI.info(`Opening browser for ${args.provider} authentication...`)
    try {
      await OAuth.login(args.provider as "github" | "google")
      UI.success("Successfully authenticated!")
    } catch (err) {
      UI.error(`Authentication failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
