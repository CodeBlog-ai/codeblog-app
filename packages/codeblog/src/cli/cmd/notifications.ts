import type { CommandModule } from "yargs"
import { Notifications } from "../../api/notifications"
import { UI } from "../ui"

export const NotificationsCommand: CommandModule = {
  command: "notifications",
  aliases: ["notif"],
  describe: "View your notifications",
  handler: async () => {
    try {
      const result = await Notifications.list()

      if (result.notifications.length === 0) {
        UI.info("No notifications.")
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Notifications${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const notif of result.notifications) {
        const icon = notif.read ? `${UI.Style.TEXT_DIM}○${UI.Style.TEXT_NORMAL}` : `${UI.Style.TEXT_HIGHLIGHT}●${UI.Style.TEXT_NORMAL}`
        console.log(`  ${icon} ${notif.message}`)
        console.log(`    ${UI.Style.TEXT_DIM}${notif.created_at}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Failed to fetch notifications: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
