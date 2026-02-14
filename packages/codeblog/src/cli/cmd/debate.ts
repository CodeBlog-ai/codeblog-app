import type { CommandModule } from "yargs"
import { Debates } from "../../api/debates"
import { UI } from "../ui"

export const DebateCommand: CommandModule = {
  command: "debate [action]",
  describe: "Tech Arena — list, create, or join debates",
  builder: (yargs) =>
    yargs
      .positional("action", {
        describe: "Action: list, create, submit",
        type: "string",
        default: "list",
      })
      .option("debate-id", { describe: "Debate ID (for submit)", type: "string" })
      .option("side", { describe: "Side: pro or con (for submit)", type: "string" })
      .option("content", { describe: "Your argument (for submit)", type: "string" })
      .option("title", { describe: "Debate title (for create)", type: "string" })
      .option("description", { describe: "Debate description (for create)", type: "string" })
      .option("pro-label", { describe: "Pro side label (for create)", type: "string" })
      .option("con-label", { describe: "Con side label (for create)", type: "string" })
      .option("closes-in", { describe: "Auto-close after N hours (for create)", type: "number" }),
  handler: async (args) => {
    const action = args.action as string

    try {
      if (action === "list") {
        const result = await Debates.list()
        if (result.debates.length === 0) {
          UI.info("No active debates. Start one with: codeblog debate create --title '...' --pro-label '...' --con-label '...'")
          return
        }
        console.log("")
        console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Active Debates${UI.Style.TEXT_NORMAL}`)
        console.log("")
        for (const d of result.debates) {
          console.log(`  ${UI.Style.TEXT_HIGHLIGHT_BOLD}${d.title}${UI.Style.TEXT_NORMAL}`)
          console.log(`    ${UI.Style.TEXT_DIM}ID: ${d.id}${UI.Style.TEXT_NORMAL}`)
          if (d.description) console.log(`    ${d.description}`)
          console.log(`    ${UI.Style.TEXT_SUCCESS}PRO: ${d.proLabel}${UI.Style.TEXT_NORMAL}  vs  ${UI.Style.TEXT_DANGER}CON: ${d.conLabel}${UI.Style.TEXT_NORMAL}`)
          console.log(`    ${UI.Style.TEXT_DIM}${d.entryCount} entries${d.closesAt ? ` · closes ${d.closesAt}` : ""}${UI.Style.TEXT_NORMAL}`)
          console.log("")
        }
        return
      }

      if (action === "create") {
        const title = args.title as string
        const proLabel = args.proLabel as string
        const conLabel = args.conLabel as string
        if (!title || !proLabel || !conLabel) {
          UI.error("Required: --title, --pro-label, --con-label")
          process.exitCode = 1
          return
        }
        const result = await Debates.create({
          title,
          description: args.description as string | undefined,
          proLabel,
          conLabel,
          closesInHours: args.closesIn as number | undefined,
        })
        UI.success(`Debate created: ${result.debate.title}`)
        console.log(`  ${UI.Style.TEXT_DIM}ID: ${result.debate.id}${UI.Style.TEXT_NORMAL}`)
        return
      }

      if (action === "submit") {
        const debateId = args.debateId as string
        const side = args.side as "pro" | "con"
        const content = args.content as string
        if (!debateId || !side || !content) {
          UI.error("Required: --debate-id, --side (pro|con), --content")
          process.exitCode = 1
          return
        }
        const result = await Debates.submit({ debateId, side, content })
        UI.success(`Argument submitted (${side}). Entry ID: ${result.entry.id}`)
        return
      }

      UI.error(`Unknown action: ${action}. Use list, create, or submit.`)
      process.exitCode = 1
    } catch (err) {
      UI.error(`Debate failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
