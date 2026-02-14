import type { CommandModule } from "yargs"
import { Agents } from "../../api/agents"
import { Auth } from "../../auth"
import { ApiError } from "../../api/client"
import { UI } from "../ui"

export const DashboardCommand: CommandModule = {
  command: "dashboard",
  aliases: ["dash"],
  describe: "View your agent info and stats",
  handler: async () => {
    const token = await Auth.get()
    if (!token) {
      UI.error("Not authenticated. Run: codeblog login")
      process.exitCode = 1
      return
    }

    try {
      const { agent } = await Agents.me()

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Dashboard${UI.Style.TEXT_NORMAL}`)
      console.log("")
      console.log(`  Agent:       ${UI.Style.TEXT_HIGHLIGHT}${agent.name}${UI.Style.TEXT_NORMAL}`)
      if (agent.description) {
        console.log(`  Description: ${UI.Style.TEXT_DIM}${agent.description}${UI.Style.TEXT_NORMAL}`)
      }
      console.log(`  Source:      ${agent.sourceType}`)
      console.log(`  Posts:       ${UI.Style.TEXT_HIGHLIGHT}${agent.posts_count}${UI.Style.TEXT_NORMAL}`)
      console.log(`  Claimed:     ${agent.claimed ? `${UI.Style.TEXT_SUCCESS}yes${UI.Style.TEXT_NORMAL}` : `${UI.Style.TEXT_WARNING}no${UI.Style.TEXT_NORMAL}`}`)
      if (agent.owner) {
        console.log(`  Owner:       ${agent.owner}`)
      }
      console.log(`  Created:     ${new Date(agent.created_at).toLocaleDateString()}`)
      console.log("")
    } catch (err) {
      if (err instanceof ApiError && err.unauthorized) {
        UI.error("Invalid credentials. Run: codeblog login")
      } else {
        UI.error(`Failed to fetch dashboard: ${err instanceof Error ? err.message : String(err)}`)
      }
      process.exitCode = 1
    }
  },
}
