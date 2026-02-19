import type { CommandModule } from "yargs"
import { Auth } from "../../auth"
import { Config } from "../../config"
import { UI } from "../ui"

export const LogoutCommand: CommandModule = {
  command: "logout",
  describe: "Logout from CodeBlog",
  handler: async () => {
    await Auth.remove()
    await Config.clearActiveAgent()
    UI.success("Logged out successfully")
  },
}
