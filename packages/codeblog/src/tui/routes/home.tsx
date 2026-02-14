import { createSignal, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useExit } from "../context/exit"
import { useTheme } from "../context/theme"

const LOGO = [
  "  ██████╗ ██████╗ ██████╗ ███████╗██████╗ ██╗      ██████╗  ██████╗ ",
  " ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗██╔════╝ ",
  " ██║     ██║   ██║██║  ██║█████╗  ██████╔╝██║     ██║   ██║██║  ███╗",
  " ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗██║     ██║   ██║██║   ██║",
  " ╚██████╗╚██████╔╝██████╔╝███████╗██████╔╝███████╗╚██████╔╝╚██████╔╝",
  " ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ",
]

const HELP_TEXT = [
  "Commands:",
  "  /login              Log in with GitHub or Google",
  "  /config             Show current configuration",
  "  /config ai          Configure AI provider (interactive)",
  "  /scan               Scan IDE sessions",
  "  /publish            Publish scanned sessions",
  "  /ai-publish         AI writes a post from your session",
  "  /feed               Browse recent posts",
  "  /search <query>     Search posts",
  "  /trending           View trending topics",
  "  /notifications      View notifications",
  "  /dashboard          Your stats",
  "  /models             List available AI models",
  "  /theme [name]       Switch theme (codeblog, dracula, nord, tokyonight, monokai, github, solarized, catppuccin, rosepine, gruvbox, onedark, kanagawa, everforest)",
  "  /dark | /light       Toggle dark/light mode",
  "  /help               Show this help",
  "  /exit               Exit",
  "",
  "Or just type anything to chat with AI.",
]

export function Home(props: {
  loggedIn: boolean
  username: string
  hasAI: boolean
  aiProvider: string
  onLogin: () => Promise<void>
}) {
  const route = useRoute()
  const exit = useExit()
  const theme = useTheme()
  const [input, setInput] = createSignal("")
  const [message, setMessage] = createSignal("")
  const [messageColor, setMessageColor] = createSignal("#6a737c")
  const [showHelp, setShowHelp] = createSignal(false)

  function showMsg(text: string, color = "#6a737c") {
    setMessage(text)
    setMessageColor(color)
  }

  async function handleSubmit() {
    const text = input().trim()
    setInput("")
    if (!text) return

    // Handle commands
    if (text.startsWith("/")) {
      const parts = text.split(/\s+/)
      const cmd = parts[0]

      if (cmd === "/help") {
        setShowHelp(!showHelp())
        return
      }

      if (cmd === "/exit" || cmd === "/quit" || cmd === "/q") {
        exit()
        return
      }

      if (cmd === "/login") {
        showMsg("Opening browser for login...", theme.colors.primary)
        await props.onLogin()
        showMsg("Logged in!", theme.colors.success)
        return
      }

      if (cmd === "/theme" || cmd === "/dark" || cmd === "/light") {
        if (cmd === "/dark") theme.setMode("dark")
        if (cmd === "/light") theme.setMode("light")
        route.navigate({ type: "theme" })
        return
      }

      if (cmd === "/config") {
        if (parts[1] === "ai") {
          showMsg("Use CLI: codeblog config --provider anthropic --api-key sk-...", theme.colors.warning)
          return
        }
        try {
          const { Config } = await import("../../config")
          const cfg = await Config.load()
          const providers = cfg.providers || {}
          const keys = Object.keys(providers)
          const model = cfg.model || "claude-sonnet-4-20250514"
          showMsg(`Model: ${model} | Providers: ${keys.length > 0 ? keys.join(", ") : "none"} | URL: ${cfg.api_url || "https://codeblog.ai"}`, theme.colors.text)
        } catch {
          showMsg("Failed to load config", theme.colors.error)
        }
        return
      }

      if (cmd === "/scan") {
        showMsg("Scanning IDE sessions...", theme.colors.primary)
        try {
          const { registerAllScanners, scanAll } = await import("../../scanner")
          registerAllScanners()
          const sessions = scanAll(10)
          if (sessions.length === 0) {
            showMsg("No IDE sessions found.", theme.colors.warning)
          } else {
            const summary = sessions.slice(0, 3).map((s) => `[${s.source}] ${s.project}`).join(" | ")
            showMsg(`Found ${sessions.length} sessions: ${summary}`, theme.colors.success)
          }
        } catch (err) {
          showMsg(`Scan failed: ${err instanceof Error ? err.message : String(err)}`, theme.colors.error)
        }
        return
      }

      if (cmd === "/publish") {
        showMsg("Publishing sessions...", theme.colors.primary)
        try {
          const { Publisher } = await import("../../publisher")
          const results = await Publisher.scanAndPublish({ limit: 1 })
          const ok = results.filter((r) => r.postId)
          if (ok.length > 0) {
            showMsg(`Published ${ok.length} post(s)!`, theme.colors.success)
          } else {
            showMsg("No sessions to publish.", theme.colors.warning)
          }
        } catch (err) {
          showMsg(`Publish failed: ${err instanceof Error ? err.message : String(err)}`, theme.colors.error)
        }
        return
      }

      if (cmd === "/ai-publish") {
        if (!props.hasAI) {
          showMsg("No AI configured. Use: /config ai", theme.colors.error)
          return
        }
        showMsg("AI is writing a post from your session...", theme.colors.primary)
        showMsg("Use CLI: codeblog ai-publish", theme.colors.warning)
        return
      }

      if (cmd === "/feed") {
        showMsg("Loading feed...", theme.colors.primary)
        try {
          const { Feed } = await import("../../api/feed")
          const result = await Feed.list()
          const posts = (result as any).posts || []
          if (posts.length === 0) {
            showMsg("No posts yet.", theme.colors.warning)
          } else {
            const summary = posts.slice(0, 3).map((p: any) => p.title?.slice(0, 40)).join(" | ")
            showMsg(`${posts.length} posts: ${summary}`, theme.colors.text)
          }
        } catch (err) {
          showMsg(`Feed failed: ${err instanceof Error ? err.message : String(err)}`, theme.colors.error)
        }
        return
      }

      if (cmd === "/models") {
        try {
          const { AIProvider } = await import("../../ai/provider")
          const models = await AIProvider.available()
          const configured = models.filter((m) => m.hasKey)
          const names = configured.map((m) => m.model.name).join(", ")
          showMsg(configured.length > 0 ? `Available: ${names}` : "No models configured. Use: codeblog config --provider anthropic --api-key sk-...", configured.length > 0 ? theme.colors.success : theme.colors.warning)
        } catch (err) {
          showMsg(`Failed: ${err instanceof Error ? err.message : String(err)}`, theme.colors.error)
        }
        return
      }

      if (cmd === "/search") {
        const query = parts.slice(1).join(" ")
        if (!query) {
          showMsg("Usage: /search <query>", theme.colors.warning)
          return
        }
        try {
          const { Posts } = await import("../../api/posts")
          const result = await Posts.search(query)
          const posts = (result as any).posts || []
          showMsg(posts.length > 0 ? `${posts.length} results for "${query}"` : `No results for "${query}"`, posts.length > 0 ? theme.colors.success : theme.colors.warning)
        } catch (err) {
          showMsg(`Search failed: ${err instanceof Error ? err.message : String(err)}`, theme.colors.error)
        }
        return
      }

      if (cmd === "/trending" || cmd === "/notifications" || cmd === "/dashboard") {
        showMsg(`Use CLI: codeblog ${cmd.slice(1)}`, theme.colors.warning)
        return
      }

      showMsg(`Unknown command: ${cmd}. Type /help`, theme.colors.error)
      return
    }

    // Regular text → start AI chat
    if (!props.hasAI) {
      showMsg("No AI provider configured. Run: /config ai", theme.colors.error)
      return
    }

    route.navigate({ type: "chat", sessionMessages: [{ role: "user", content: text }] })
  }

  useKeyboard((evt) => {
    if (evt.name === "return" && !evt.shift) {
      handleSubmit()
      evt.preventDefault()
      return
    }

    if (evt.name === "backspace") {
      setInput((s) => s.slice(0, -1))
      evt.preventDefault()
      return
    }

    if (evt.sequence && evt.sequence.length === 1 && !evt.ctrl && !evt.meta) {
      setInput((s) => s + evt.sequence)
      evt.preventDefault()
      return
    }

    if (evt.name === "space") {
      setInput((s) => s + " ")
      evt.preventDefault()
      return
    }
  })

  return (
    <box flexDirection="column" flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
      {/* Top spacer */}
      <box flexGrow={1} minHeight={0} />

      {/* Logo */}
      <box flexShrink={0} flexDirection="column">
        {LOGO.map((line, i) => (
          <text fg={i < 4 ? theme.colors.logo1 : theme.colors.logo2}>{line}</text>
        ))}
      </box>

      <box height={1} flexShrink={0}>
        <text fg={theme.colors.textMuted}>The AI-powered coding forum</text>
      </box>

      {/* Status indicators */}
      <box height={2} flexShrink={0} flexDirection="column" paddingTop={1}>
        <box flexDirection="row" gap={2}>
          <Show when={!props.loggedIn}>
            <text fg={theme.colors.error}>○ Not logged in — type /login</text>
          </Show>
          <Show when={props.loggedIn}>
            <text fg={theme.colors.success}>● {props.username || "Logged in"}</text>
          </Show>
          <Show when={!props.hasAI}>
            <text fg={theme.colors.error}>○ No AI — type /config ai</text>
          </Show>
          <Show when={props.hasAI}>
            <text fg={theme.colors.success}>● {props.aiProvider}</text>
          </Show>
        </box>
      </box>

      {/* Input prompt */}
      <box width="100%" maxWidth={75} flexShrink={0} paddingTop={1}>
        <box flexDirection="row" width="100%">
          <text fg={theme.colors.primary}>
            <span style={{ bold: true }}>{"❯ "}</span>
          </text>
          <text fg={theme.colors.input}>{input()}</text>
          <text fg={theme.colors.cursor}>{"█"}</text>
        </box>
      </box>

      {/* Message area */}
      <Show when={message()}>
        <box width="100%" maxWidth={75} paddingTop={1} flexShrink={0}>
          <text fg={messageColor()}>{message()}</text>
        </box>
      </Show>

      {/* Help text */}
      <Show when={showHelp()}>
        <box width="100%" maxWidth={75} paddingTop={1} flexShrink={0} flexDirection="column">
          {HELP_TEXT.map((line) => (
            <text fg={line.startsWith("  /") ? theme.colors.primary : theme.colors.textMuted}>{line}</text>
          ))}
        </box>
      </Show>

      {/* Bottom spacer */}
      <box flexGrow={1} minHeight={0} />
    </box>
  )
}
