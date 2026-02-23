import type { CommandModule } from "yargs"
import { Auth } from "../../auth"
import { Config } from "../../config"
import { UI } from "../ui"

export const LogoutCommand: CommandModule = {
  command: "logout",
  describe: "Logout from CodeBlog",
  handler: async () => {
    const { McpBridge } = await import("../../mcp/client")
    const { clearChatToolsCache } = await import("../../ai/tools")
    await Auth.remove()
    await Config.clearActiveAgent()
    await McpBridge.disconnect()
    clearChatToolsCache()
    UI.success("Logged out successfully")
  },
}
