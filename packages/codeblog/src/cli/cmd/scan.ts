import type { CommandModule } from "yargs"
import { registerAllScanners, scanAll, listScannerStatus } from "../../scanner"
import { UI } from "../ui"

export const ScanCommand: CommandModule = {
  command: "scan",
  describe: "Scan local IDE sessions",
  builder: (yargs) =>
    yargs
      .option("limit", {
        describe: "Max sessions to show",
        type: "number",
        default: 20,
      })
      .option("source", {
        describe: "Filter by IDE source",
        type: "string",
      })
      .option("status", {
        describe: "Show scanner status",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    registerAllScanners()

    if (args.status) {
      const statuses = listScannerStatus()
      console.log("")
      console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}IDE Scanner Status${UI.Style.TEXT_NORMAL}`)
      console.log("")
      for (const s of statuses) {
        const icon = s.available ? `${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL}` : `${UI.Style.TEXT_DIM}✗${UI.Style.TEXT_NORMAL}`
        console.log(`  ${icon} ${UI.Style.TEXT_NORMAL_BOLD}${s.name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${s.source})${UI.Style.TEXT_NORMAL}`)
        console.log(`    ${s.description}`)
        if (s.dirs.length > 0) {
          for (const dir of s.dirs) {
            console.log(`    ${UI.Style.TEXT_DIM}${dir}${UI.Style.TEXT_NORMAL}`)
          }
        }
        if (s.error) console.log(`    ${UI.Style.TEXT_DANGER}${s.error}${UI.Style.TEXT_NORMAL}`)
        console.log("")
      }
      return
    }

    const sessions = scanAll(args.limit as number, args.source as string | undefined)

    if (sessions.length === 0) {
      UI.info("No IDE sessions found. Try running with --status to check scanner availability.")
      return
    }

    console.log("")
    console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Found ${sessions.length} sessions${UI.Style.TEXT_NORMAL}`)
    console.log("")

    for (const session of sessions) {
      const source = `${UI.Style.TEXT_INFO}[${session.source}]${UI.Style.TEXT_NORMAL}`
      const date = session.modifiedAt.toLocaleDateString()
      const msgs = `${UI.Style.TEXT_DIM}${session.humanMessages}h/${session.aiMessages}a msgs${UI.Style.TEXT_NORMAL}`

      console.log(`  ${source} ${UI.Style.TEXT_NORMAL_BOLD}${session.project}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}${date}${UI.Style.TEXT_NORMAL}`)
      console.log(`    ${session.title}`)
      console.log(`    ${msgs}  ${UI.Style.TEXT_DIM}${session.id}${UI.Style.TEXT_NORMAL}`)
      console.log("")
    }
  },
}
