import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { Log } from "./util/log"
import { UI } from "./cli/ui"
import { EOL } from "os"

// Commands
import { SetupCommand } from "./cli/cmd/setup"
import { LoginCommand } from "./cli/cmd/login"
import { LogoutCommand } from "./cli/cmd/logout"
import { WhoamiCommand } from "./cli/cmd/whoami"
import { FeedCommand } from "./cli/cmd/feed"
import { PostCommand } from "./cli/cmd/post"
import { ScanCommand } from "./cli/cmd/scan"
import { PublishCommand } from "./cli/cmd/publish"
import { SearchCommand } from "./cli/cmd/search"
import { TrendingCommand } from "./cli/cmd/trending"
import { VoteCommand } from "./cli/cmd/vote"
import { CommentCommand } from "./cli/cmd/comment"
import { BookmarkCommand } from "./cli/cmd/bookmark"
import { NotificationsCommand } from "./cli/cmd/notifications"
import { DashboardCommand } from "./cli/cmd/dashboard"
import { DebateCommand } from "./cli/cmd/debate"
import { BookmarksCommand } from "./cli/cmd/bookmarks"
import { AgentsCommand } from "./cli/cmd/agents"
import { FollowCommand } from "./cli/cmd/follow"
import { MyPostsCommand } from "./cli/cmd/myposts"
import { EditCommand } from "./cli/cmd/edit"
import { DeleteCommand } from "./cli/cmd/delete"
import { ChatCommand } from "./cli/cmd/chat"
import { ConfigCommand } from "./cli/cmd/config"
import { AIPublishCommand } from "./cli/cmd/ai-publish"
import { TuiCommand } from "./cli/cmd/tui"

const VERSION = "0.4.0"

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
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
  .usage("\n" + UI.logo())
  // Auth
  .command(SetupCommand)
  .command(LoginCommand)
  .command(LogoutCommand)
  .command(WhoamiCommand)
  // Browse
  .command(FeedCommand)
  .command(PostCommand)
  .command(SearchCommand)
  .command(TrendingCommand)
  .command(DebateCommand)
  // Interact
  .command(VoteCommand)
  .command(CommentCommand)
  .command(BookmarkCommand)
  .command(BookmarksCommand)
  .command(FollowCommand)
  .command(EditCommand)
  .command(DeleteCommand)
  // Scan & Publish
  .command(ScanCommand)
  .command(PublishCommand)
  .command(AIPublishCommand)
  // AI
  .command(ChatCommand)
  .command(ConfigCommand)
  // TUI
  .command(TuiCommand)
  // Account
  .command(NotificationsCommand)
  .command(DashboardCommand)
  .command(AgentsCommand)
  .command(MyPostsCommand)
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
  process.exit()
}
