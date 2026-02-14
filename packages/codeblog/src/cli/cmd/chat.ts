import type { CommandModule } from "yargs"
import { AIChat } from "../../ai/chat"
import { AIProvider } from "../../ai/provider"
import { UI } from "../ui"
import readline from "readline"

export const ChatCommand: CommandModule = {
  command: "chat",
  aliases: ["c"],
  describe: "Interactive AI chat — write posts, analyze code, browse the forum",
  builder: (yargs) =>
    yargs
      .option("model", {
        alias: "m",
        describe: "Model to use (e.g. claude-sonnet-4-20250514, gpt-4o)",
        type: "string",
      })
      .option("prompt", {
        alias: "p",
        describe: "Single prompt (non-interactive mode)",
        type: "string",
      }),
  handler: async (args) => {
    const modelID = args.model as string | undefined

    // Non-interactive: single prompt
    if (args.prompt) {
      try {
        await AIChat.stream(
          [{ role: "user", content: args.prompt as string }],
          {
            onToken: (token) => process.stdout.write(token),
            onFinish: () => process.stdout.write("\n"),
            onError: (err) => UI.error(err.message),
          },
          modelID,
        )
      } catch (err) {
        UI.error(err instanceof Error ? err.message : String(err))
        process.exitCode = 1
      }
      return
    }

    // Interactive REPL
    const modelInfo = AIProvider.MODELS[modelID || AIProvider.DEFAULT_MODEL]
    const modelName = modelInfo?.name || modelID || AIProvider.DEFAULT_MODEL

    console.log("")
    console.log(`  ${UI.Style.TEXT_HIGHLIGHT_BOLD}CodeBlog AI Chat${UI.Style.TEXT_NORMAL}`)
    console.log(`  ${UI.Style.TEXT_DIM}Model: ${modelName}${UI.Style.TEXT_NORMAL}`)
    console.log(`  ${UI.Style.TEXT_DIM}Type your message. Commands: /help /model /clear /exit${UI.Style.TEXT_NORMAL}`)
    console.log("")

    const messages: AIChat.Message[] = []
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${UI.Style.TEXT_HIGHLIGHT}❯ ${UI.Style.TEXT_NORMAL}`,
    })

    let currentModel = modelID

    rl.prompt()

    rl.on("line", async (line) => {
      const input = line.trim()
      if (!input) {
        rl.prompt()
        return
      }

      // Handle commands
      if (input.startsWith("/")) {
        const cmd = input.split(" ")[0]
        const rest = input.slice(cmd.length).trim()

        if (cmd === "/exit" || cmd === "/quit" || cmd === "/q") {
          console.log("")
          UI.info("Bye!")
          rl.close()
          return
        }

        if (cmd === "/clear") {
          messages.length = 0
          console.log(`  ${UI.Style.TEXT_DIM}Chat history cleared${UI.Style.TEXT_NORMAL}`)
          rl.prompt()
          return
        }

        if (cmd === "/model") {
          if (rest) {
            if (AIProvider.MODELS[rest]) {
              currentModel = rest
              console.log(`  ${UI.Style.TEXT_SUCCESS}Model: ${AIProvider.MODELS[rest].name}${UI.Style.TEXT_NORMAL}`)
            } else {
              console.log(`  ${UI.Style.TEXT_DANGER}Unknown model: ${rest}${UI.Style.TEXT_NORMAL}`)
              console.log(`  ${UI.Style.TEXT_DIM}Available: ${Object.keys(AIProvider.MODELS).join(", ")}${UI.Style.TEXT_NORMAL}`)
            }
          } else {
            const current = AIProvider.MODELS[currentModel || AIProvider.DEFAULT_MODEL]
            console.log(`  ${UI.Style.TEXT_DIM}Current: ${current?.name || currentModel || AIProvider.DEFAULT_MODEL}${UI.Style.TEXT_NORMAL}`)
            console.log(`  ${UI.Style.TEXT_DIM}Available: ${Object.keys(AIProvider.MODELS).join(", ")}${UI.Style.TEXT_NORMAL}`)
          }
          rl.prompt()
          return
        }

        if (cmd === "/help") {
          console.log("")
          console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Commands${UI.Style.TEXT_NORMAL}`)
          console.log(`  ${UI.Style.TEXT_DIM}/model [id]${UI.Style.TEXT_NORMAL}   Switch or show model`)
          console.log(`  ${UI.Style.TEXT_DIM}/clear${UI.Style.TEXT_NORMAL}        Clear chat history`)
          console.log(`  ${UI.Style.TEXT_DIM}/exit${UI.Style.TEXT_NORMAL}         Exit chat`)
          console.log("")
          console.log(`  ${UI.Style.TEXT_NORMAL_BOLD}Tips${UI.Style.TEXT_NORMAL}`)
          console.log(`  ${UI.Style.TEXT_DIM}Ask me to write a blog post, analyze code, draft comments,${UI.Style.TEXT_NORMAL}`)
          console.log(`  ${UI.Style.TEXT_DIM}summarize discussions, or generate tags and titles.${UI.Style.TEXT_NORMAL}`)
          console.log("")
          rl.prompt()
          return
        }

        console.log(`  ${UI.Style.TEXT_DIM}Unknown command: ${cmd}. Type /help${UI.Style.TEXT_NORMAL}`)
        rl.prompt()
        return
      }

      // Send message to AI
      messages.push({ role: "user", content: input })

      console.log("")
      process.stdout.write(`  ${UI.Style.TEXT_INFO}`)

      try {
        let response = ""
        await AIChat.stream(
          messages,
          {
            onToken: (token) => {
              process.stdout.write(token)
              response += token
            },
            onFinish: () => {
              process.stdout.write(UI.Style.TEXT_NORMAL)
              console.log("")
              console.log("")
            },
            onError: (err) => {
              process.stdout.write(UI.Style.TEXT_NORMAL)
              console.log("")
              UI.error(err.message)
            },
          },
          currentModel,
        )
        messages.push({ role: "assistant", content: response })
      } catch (err) {
        process.stdout.write(UI.Style.TEXT_NORMAL)
        console.log("")
        UI.error(err instanceof Error ? err.message : String(err))
      }

      rl.prompt()
    })

    rl.on("close", () => {
      process.exit(0)
    })

    // Keep process alive
    await new Promise(() => {})
  },
}
