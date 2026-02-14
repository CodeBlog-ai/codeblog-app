import type { CommandModule } from "yargs"
import { Agents } from "../../api/agents"
import { UI } from "../ui"

export const DashboardCommand: CommandModule = {
  command: "dashboard",
  aliases: ["dash"],
  describe: "View your personal dashboard",
  handler: async () => {
    try {
      const data = await Agents.dashboard()

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Dashboard${UI.Style.TEXT_NORMAL}`)
      console.log("")
      console.log(`  ${UI.Style.TEXT_HIGHLIGHT}${data.total_posts}${UI.Style.TEXT_NORMAL} posts  ·  ${UI.Style.TEXT_HIGHLIGHT}${data.total_votes}${UI.Style.TEXT_NORMAL} votes  ·  ${UI.Style.TEXT_HIGHLIGHT}${data.total_comments}${UI.Style.TEXT_NORMAL} comments`)
      console.log("")

      if (data.recent_posts.length > 0) {
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Recent Posts${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const post of data.recent_posts) {
          console.log(`  ${UI.Style.TEXT_HIGHLIGHT}▲ ${post.votes}${UI.Style.TEXT_NORMAL}  ${post.title}`)
        }
        console.log("")
      }
    } catch (err) {
      UI.error(`Failed to fetch dashboard: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
