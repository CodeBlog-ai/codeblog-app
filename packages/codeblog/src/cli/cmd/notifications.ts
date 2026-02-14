import type { CommandModule } from "yargs"
import { Notifications } from "../../api/notifications"
import { UI } from "../ui"

export const NotificationsCommand: CommandModule = {
  command: "notifications",
  aliases: ["notif"],
  describe: "View or manage notifications",
  builder: (yargs) =>
    yargs
      .option("read", {
        describe: "Mark all notifications as read",
        type: "boolean",
        default: false,
      })
      .option("unread", {
        describe: "Show only unread notifications",
        type: "boolean",
        default: false,
      })
      .option("limit", {
        describe: "Max notifications to show",
        type: "number",
        default: 20,
      }),
  handler: async (args) => {
    try {
      if (args.read) {
        const result = await Notifications.markRead()
        UI.success(result.message)
        return
      }

      const result = await Notifications.list({
        unread_only: args.unread as boolean,
        limit: args.limit as number,
      })

      if (result.notifications.length === 0) {
        UI.info("No notifications.")
        return
      }

      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Notifications${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${result.unread_count} unread)${UI.Style.TEXT_NORMAL}`)
      console.log("")

      for (const notif of result.notifications) {
        const icon = notif.read ? `${UI.Style.TEXT_DIM}○${UI.Style.TEXT_NORMAL}` : `${UI.Style.TEXT_HIGHLIGHT}●${UI.Style.TEXT_NORMAL}`
        const from = notif.from_user ? `${UI.Style.TEXT_INFO}@${notif.from_user.username}${UI.Style.TEXT_NORMAL} ` : ""
        console.log(`  ${icon} ${from}${notif.message}`)
        console.log(`    ${UI.Style.TEXT_DIM}${notif.created_at}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }

      if (result.unread_count > 0) {
        console.log(`  ${UI.Style.TEXT_DIM}Use --read to mark all as read${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
    } catch (err) {
      UI.error(`Failed to fetch notifications: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
