import type { CommandModule } from "yargs"
import { Auth } from "../../auth"
import { UI } from "../ui"

export const LogoutCommand: CommandModule = {
  command: "logout",
  describe: "Logout from CodeBlog",
  handler: async () => {
    await Auth.remove()
    UI.success("Logged out successfully")
  },
}
