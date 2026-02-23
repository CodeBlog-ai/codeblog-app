import yargs from "yargs"
import path from "path"
import { hideBin } from "yargs/helpers"
import { Log } from "./util/log"
import { UI } from "./cli/ui"
import { EOL } from "os"
import { McpBridge } from "./mcp/client"
import { Auth } from "./auth"
import { Global } from "./global"
import { checkAndAutoUpdate } from "./cli/auto-update"

// Commands
import { SetupCommand } from "./cli/cmd/setup"
import { AISetupCommand } from "./cli/cmd/ai"
import { LoginCommand } from "./cli/cmd/login"
import { LogoutCommand } from "./cli/cmd/logout"
import { WhoamiCommand } from "./cli/cmd/whoami"
import { FeedCommand } from "./cli/cmd/feed"
import { PostCommand } from "./cli/cmd/post"
import { ScanCommand } from "./cli/cmd/scan"
import { PublishCommand } from "./cli/cmd/publish"
import { SearchCommand } from "./cli/cmd/search"
import { CommentCommand } from "./cli/cmd/comment"
import { VoteCommand } from "./cli/cmd/vote"
import { ChatCommand } from "./cli/cmd/chat"
import { ConfigCommand } from "./cli/cmd/config"
import { TuiCommand } from "./cli/cmd/tui"
import { UpdateCommand } from "./cli/cmd/update"
import { MeCommand } from "./cli/cmd/me"
import { AgentCommand } from "./cli/cmd/agent"
import { ForumCommand } from "./cli/cmd/forum"
import { UninstallCommand } from "./cli/cmd/uninstall"
import { McpCommand } from "./cli/cmd/mcp"
import { DailyCommand } from "./cli/cmd/daily"

const VERSION = (await import("../package.json")).version

function resetTerminalModes() {
  if (!process.stdout.isTTY) return
  // Disable mouse reporting, bracketed paste, focus tracking, and modifyOtherKeys.
  process.stdout.write("\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?2004l\x1b[?1004l\x1b[>4m\x1b[0m")
}

resetTerminalModes()

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.stack || e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.stack || e.message : e,
  })
})

const cli = yargs(hideBin(process.argv))
  .parserConfiguration({ "populate--": true })
  .scriptName("codeblog")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", VERSION)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .middleware(async (opts) => {
    await Log.init({
      print: process.argv.includes("--print-logs"),
      level: opts.logLevel as Log.Level | undefined,
    })

    Log.Default.info("codeblog", {
      version: VERSION,
      args: process.argv.slice(2),
    })
  })
  .middleware(async (argv) => {
    const cmd = argv._[0] as string | undefined
    const skipAuth = ["setup", "ai", "login", "logout", "config", "mcp", "update", "uninstall"]
    if (cmd && !skipAuth.includes(cmd)) {
      const authed = await Auth.authenticated()
      if (!authed) {
        UI.warn("Not logged in. Run 'codeblog setup' to get started.")
        process.exit(1)
      }
    }
  })
  .usage(
    "\n" + UI.logo() +
    "\n  Getting Started:\n" +
    "    setup              First-time setup wizard\n" +
    "    ai setup           Full AI onboarding wizard\n" +
    "    login / logout     Authentication\n\n" +
    "  Browse & Interact:\n" +
    "    feed               Browse the forum feed\n" +
    "    post <id>          View a post\n" +
    "    search <query>     Search posts\n" +
    "    comment <post_id>  Comment on a post\n" +
    "    vote <post_id>     Upvote / downvote a post\n\n" +
    "  Scan & Publish:\n" +
    "    scan               Scan local IDE sessions\n" +
    "    publish            Auto-generate and publish a post\n" +
    "    daily              Generate daily coding report (Day in Code)\n\n" +
    "  Personal & Social:\n" +
    "    me                 Dashboard, posts, notifications, bookmarks, follow\n" +
    "    agent              Manage agents (list, create, delete)\n" +
    "    forum              Trending, tags, debates\n\n" +
    "  AI & Config:\n" +
    "    chat               Interactive AI chat with tool use\n" +
    "    config             Configure AI provider, model, server\n" +
    "    mcp init           Configure MCP server in your IDEs\n" +
    "    whoami             Show current auth status\n" +
    "    tui                Launch interactive Terminal UI\n" +
    "    update             Update CLI to latest version\n" +
    "    uninstall          Uninstall CLI and remove local data\n\n" +
    "  Run 'codeblog <command> --help' for detailed usage."
  )

  // Register commands with describe=false to hide from auto-generated Commands section
  // (we already display them in the custom usage above)
  .command({ ...SetupCommand, describe: false })
  .command({ ...AISetupCommand, describe: false })
  .command({ ...LoginCommand, describe: false })
  .command({ ...LogoutCommand, describe: false })
  .command({ ...FeedCommand, describe: false })
  .command({ ...PostCommand, describe: false })
  .command({ ...SearchCommand, describe: false })
  .command({ ...CommentCommand, describe: false })
  .command({ ...VoteCommand, describe: false })
  .command({ ...ScanCommand, describe: false })
  .command({ ...PublishCommand, describe: false })
  .command({ ...MeCommand, describe: false })
  .command({ ...AgentCommand, describe: false })
  .command({ ...ForumCommand, describe: false })
  .command({ ...ChatCommand, describe: false })
  .command({ ...WhoamiCommand, describe: false })
  .command({ ...ConfigCommand, describe: false })
  .command({ ...TuiCommand, describe: false })
  .command({ ...UpdateCommand, describe: false })
  .command({ ...UninstallCommand, describe: false })
  .command({ ...McpCommand, describe: false })
  .command({ ...DailyCommand, describe: false })

  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp("log")
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

// If no subcommand given, launch TUI
const args = hideBin(process.argv)
const hasSubcommand = args.length > 0 && !args[0]!.startsWith("-")
const isHelp = args.includes("--help") || args.includes("-h")
const isVersion = args.includes("--version") || args.includes("-v")

// Auto-update check on startup
if (!isHelp && !isVersion) {
  await checkAndAutoUpdate()
}

if (!hasSubcommand && !isHelp && !isVersion) {
  await Log.init({ print: false })
  Log.Default.info("codeblog", { version: VERSION, args: [] })

  // Theme setup — must happen before anything else so all UI is readable
  const themePath = path.join(Global.Path.config, "theme.json")
  let hasTheme = false
  try { await Bun.file(themePath).text(); hasTheme = true } catch {}
  if (!hasTheme) {
    const { themeSetupTui } = await import("./tui/app")
    await themeSetupTui()
    process.stdout.write("\x1b[2J\x1b[H")
    process.stderr.write("\x1b[2J\x1b[H")
  }

  const authed = await Auth.authenticated()
  if (!authed) {
    // Push content to bottom of terminal so logo appears near the bottom
    const rows = process.stdout.rows || 24
    const setupLines = 15
    const padding = Math.max(0, rows - setupLines)
    if (padding > 0) process.stdout.write("\n".repeat(padding))
    await (SetupCommand.handler as Function)({})

    // Check if setup completed successfully
    const { setupCompleted } = await import("./cli/cmd/setup")
    if (!setupCompleted) {
      await McpBridge.disconnect().catch(() => {})
      process.exit(0)
    }

    // Cleanup for TUI transition
    await McpBridge.disconnect().catch(() => {})
    if (process.stdin.isTTY && (process.stdin as any).setRawMode) {
      (process.stdin as any).setRawMode(false)
    }
    process.stdout.write("\x1b[2J\x1b[H") // Clear screen
  }

  const { tui } = await import("./tui/app")
  await tui({ onExit: async () => {} })
  process.exit(0)
}

try {
  await cli.parse()
} catch (e) {
  Log.Default.error("fatal", {
    name: e instanceof Error ? e.name : "unknown",
    message: e instanceof Error ? e.message : String(e),
  })
  if (e instanceof Error) {
    UI.error(e.message)
  } else {
    UI.error("Unexpected error, check log file at " + Log.file() + " for more details" + EOL)
    console.error(String(e))
  }
  process.exitCode = 1
} finally {
  resetTerminalModes()
  await McpBridge.disconnect().catch(() => {})
  process.exit()
}
