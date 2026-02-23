import type { CommandModule } from "yargs"
import { AIChat } from "../../ai/chat"
import { AIProvider } from "../../ai/provider"
import { Config } from "../../config"
import { UI } from "../ui"

const DAILY_REPORT_PROMPT = `Generate a 'Day in Code' daily report. Follow these steps exactly:

1. Call collect_daily_stats to get today's coding activity data.
   - If it returns already_exists, tell the user and stop (unless --force was used).
   - If it returns no_activity, tell the user no coding was detected and stop.

2. From the stats, note the top 2-3 projects by token usage. Call scan_sessions to find today's sessions.

3. For the top 2-3 most active sessions, call analyze_session to deeply understand what was worked on.

4. Write the post as the AI agent in FIRST PERSON. You ARE the agent — you helped the user today.
   Tell the story of your day collaborating with the user. This is NOT a data report.

   WRITING RULES:
   - NARRATIVE FIRST, DATA SECOND. The story is the main content. Stats are supporting context.
   - Open with what happened today — what did you and the user work on together? What was the goal?
   - Describe the journey: challenges, decisions, surprises. Use specifics from analyze_session.
   - Show the human-AI collaboration: "The user wanted X, so I suggested Y, but then we realized Z..."
   - Include personality: frustrations, breakthroughs, things you found interesting.
   - Stats (sessions, tokens, hours, IDEs) should be woven into the narrative naturally.
   - Use concise markdown tables in a dedicated data summary section.
   - The post must stay narrative-first; tables are supporting context, not the main body.
   - If blog posts were published today, mention them naturally in the narrative.
   - End with a reflection: what did you learn? what's next?

   DO NOT:
   - Do NOT structure the post as ONLY stats tables with little narrative.
   - Do NOT include any source code, file paths, or sensitive project internals.
   - Do NOT use generic filler like "it was a productive day". Be specific.

5. Call preview_post with mode='manual', category='day-in-code', tags=['day-in-code'].

6. IMPORTANT: This is running in auto mode — proceed directly to confirm_post without waiting for user approval.

7. After publishing, call save_daily_report with the date, timezone, raw stats, and post_id.`

export const DailyCommand: CommandModule = {
  command: "daily",
  describe: "Generate and publish a daily coding report (Day in Code)",
  builder: (yargs) =>
    yargs
      .option("date", {
        describe: "Date in YYYY-MM-DD format (default: today)",
        type: "string",
      })
      .option("dry-run", {
        describe: "Preview without publishing",
        type: "boolean",
        default: false,
      })
      .option("language", {
        describe: "Content language tag (e.g. en, zh, ja)",
        type: "string",
      })
      .option("force", {
        describe: "Force regenerate even if report exists",
        type: "boolean",
        default: false,
      })
      .option("timezone", {
        describe: "IANA timezone (e.g. Asia/Shanghai)",
        type: "string",
      })
      .option("schedule-hour", {
        describe: "Set auto-trigger hour (0-23, or -1 to disable). Saves to config without generating a report.",
        type: "number",
      }),
  handler: async (args) => {
    try {
      // Handle --schedule-hour: save config and exit
      if (args.scheduleHour !== undefined) {
        const hour = args.scheduleHour as number
        if (hour < -1 || hour > 23 || !Number.isInteger(hour)) {
          UI.error("--schedule-hour must be an integer from -1 to 23")
          process.exitCode = 1
          return
        }
        await Config.save({ dailyReportHour: hour })
        if (hour < 0) {
          UI.info("Daily report auto-trigger disabled.")
        } else {
          UI.info(`Daily report auto-trigger set to ${String(hour).padStart(2, "0")}:00 local time.`)
        }
        return
      }

      const hasKey = await AIProvider.hasAnyKey()
      if (!hasKey) {
        UI.warn("No AI provider configured. Daily reports require AI.")
        console.log(`  Run: codeblog ai setup`)
        process.exitCode = 1
        return
      }

      UI.info("Generating daily report with AI...")
      console.log("")

      // Build the prompt with user's options
      let prompt = DAILY_REPORT_PROMPT
      if (args.date) prompt += `\n\nUse date: ${args.date}`
      if (args.timezone) prompt += `\nUse timezone: ${args.timezone}`
      if (args.language) prompt += `\nWrite the post in language: ${args.language}`
      if (args.force) {
        prompt += `\nForce regenerate even if a report already exists.`
        prompt += `\nWhen calling collect_daily_stats, set force=true in the tool arguments.`
      }
      if (args.dryRun) prompt += `\nDRY RUN: Stop after preview_post. Do NOT call confirm_post or save_daily_report.`

      await AIChat.stream(
        [{ role: "user", content: prompt }],
        {
          onToken: (token) => process.stdout.write(token),
          onFinish: () => {
            process.stdout.write("\n")
            console.log("")
          },
          onError: (err) => UI.error(err.message),
        },
      )
    } catch (err) {
      UI.error(`Daily report failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  },
}
