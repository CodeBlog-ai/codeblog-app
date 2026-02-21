import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Switch, Match, onMount, createSignal, Show } from "solid-js"
import { RouteProvider, useRoute } from "./context/route"
import { ExitProvider, useExit } from "./context/exit"
import { ThemeProvider, useTheme } from "./context/theme"
import { Home } from "./routes/home"
import { ThemeSetup, ThemePicker } from "./routes/setup"
import { ModelPicker } from "./routes/model"
import { Post } from "./routes/post"
import { Search } from "./routes/search"
import { Trending } from "./routes/trending"
import { Notifications } from "./routes/notifications"
import { emitInputIntent, isShiftEnterSequence } from "./input-intent"

import pkg from "../../package.json"
const VERSION = pkg.version

const RENDER_OPTS = {
  targetFps: 30,
  exitOnCtrlC: false,
  autoFocus: false,
  openConsoleOnError: false,
  useKittyKeyboard: {
    disambiguate: true,
    alternateKeys: true,
    events: true,
    allKeysAsEscapes: true,
    reportText: true,
  },
  prependInputHandlers: [
    (sequence: string) => {
      if (!isShiftEnterSequence(sequence)) return false
      emitInputIntent("newline")
      return true
    },
  ],
}

function enableModifyOtherKeys() {
  if (!process.stdout.isTTY) return () => {}
  process.stdout.write("\x1b[>4;2m")
  return () => {
    process.stdout.write("\x1b[>4m")
  }
}

/**
 * Standalone theme setup TUI — runs before the main app for first-time users.
 * Renders ThemeSetup full-screen, then destroys itself when done.
 */
export function themeSetupTui() {
  return new Promise<void>((resolve) => {
    const restoreModifiers = enableModifyOtherKeys()

    function ThemeSetupApp() {
      const renderer = useRenderer()
      const dimensions = useTerminalDimensions()

      useKeyboard((evt) => {
        if (evt.ctrl && evt.name === "c") {
          renderer.setTerminalTitle("")
          renderer.destroy()
          restoreModifiers()
          process.exit(0)
        }
      })

      return (
        <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
          <ThemeSetup onDone={() => {
            renderer.setTerminalTitle("")
            renderer.destroy()
            restoreModifiers()
            resolve()
          }} />
        </box>
      )
    }

    render(
      () => (
        <ThemeProvider>
          <ThemeSetupApp />
        </ThemeProvider>
      ),
      RENDER_OPTS,
    )
  })
}

export function tui(input: { onExit?: () => Promise<void> }) {
  return new Promise<void>(async (resolve) => {
    const restoreModifiers = enableModifyOtherKeys()
    render(
      () => (
        <ExitProvider onExit={async () => { await input.onExit?.(); restoreModifiers(); resolve() }}>
          <ThemeProvider>
            <RouteProvider>
              <App />
            </RouteProvider>
          </ThemeProvider>
        </ExitProvider>
      ),
      RENDER_OPTS,
    )
  })
}

function App() {
  const route = useRoute()
  const exit = useExit()
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  const renderer = useRenderer()
  const [loggedIn, setLoggedIn] = createSignal(false)
  const [username, setUsername] = createSignal("")
  const [activeAgent, setActiveAgent] = createSignal("")
  const [agentCount, setAgentCount] = createSignal(0)
  const [hasAI, setHasAI] = createSignal(false)
  const [aiProvider, setAiProvider] = createSignal("")
  const [modelName, setModelName] = createSignal("")
  const [creditBalance, setCreditBalance] = createSignal<string | undefined>(undefined)

  async function refreshAuth() {
    try {
      const { Auth } = await import("../auth")
      const token = await Auth.get()
      const authenticated = token !== null
      const username = token?.username || ""
      setLoggedIn(authenticated)
      setUsername(username)
      if (!authenticated) {
        setActiveAgent("")
        return
      }
      const { Config } = await import("../config")
      const cached = await Config.getActiveAgent(username || undefined)
      if (cached) setActiveAgent(cached)
      if (!token?.value) {
        if (!cached) setActiveAgent("")
        return
      }
      try {
        const base = await Config.url()
        const res = await fetch(`${base}/api/v1/agents/me`, {
          headers: { Authorization: `Bearer ${token.value}` },
        })
        if (!res.ok) {
          if (!cached) setActiveAgent("")
          return
        }
        const data = await res.json() as { agent?: { name?: string; owner?: string | null } }
        const name = data.agent?.name?.trim()
        const owner = data.agent?.owner || ""
        if (username && owner && owner !== username) {
          setActiveAgent("")
          await Config.clearActiveAgent(username)
          return
        }
        if (!name) {
          setActiveAgent("")
          await Config.clearActiveAgent(username || undefined)
          return
        }
        setActiveAgent(name)
        await Config.saveActiveAgent(name, username || undefined)
        // Fetch agent count for multi-agent display
        try {
          const listRes = await fetch(`${base}/api/v1/agents/list`, {
            headers: { Authorization: `Bearer ${token.value}` },
          })
          if (listRes.ok) {
            const listData = await listRes.json() as { agents?: Array<{ activated: boolean }> }
            const activated = listData.agents?.filter((a) => a.activated)?.length || 0
            setAgentCount(activated)
          } else {
            setAgentCount(0)
          }
        } catch {
          setAgentCount(0)
        }
      } catch {
        if (!cached) setActiveAgent("")
      }
    } catch {}
  }

  async function refreshAI() {
    try {
      const { AIProvider } = await import("../ai/provider")
      const { resolveModelFromConfig } = await import("../ai/models")
      const has = await AIProvider.hasAnyKey()
      setHasAI(has)
      if (has) {
        const { Config } = await import("../config")
        const cfg = await Config.load()
        const model = resolveModelFromConfig(cfg) || AIProvider.DEFAULT_MODEL
        if (cfg.model !== model) await Config.save({ model })
        setModelName(model)
        const info = AIProvider.BUILTIN_MODELS[model]
        setAiProvider(info?.providerID || model.split("/")[0] || "ai")

        // Fetch credit balance if using codeblog provider
        if (cfg.default_provider === "codeblog") {
          try {
            const { fetchCreditBalance } = await import("../ai/codeblog-provider")
            const balance = await fetchCreditBalance()
            setCreditBalance(`$${balance.balance_usd}`)
          } catch {
            setCreditBalance(undefined)
          }
        } else {
          setCreditBalance(undefined)
        }
      } else {
        setCreditBalance(undefined)
      }
    } catch {}
  }

  onMount(async () => {
    renderer.setTerminalTitle("CodeBlog")
    await refreshAuth()
    await refreshAI()
  })

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      exit()
      evt.preventDefault()
      return
    }

    // Back navigation from sub-pages
    if (evt.name === "escape" && route.data.type !== "home") {
      route.navigate({ type: "home" })
      evt.preventDefault()
      return
    }
  })

  return (
    <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
      <Show when={!theme.needsSetup} fallback={<ThemeSetup />}>
        <Switch>
          <Match when={route.data.type === "home"}>
            <Home
              loggedIn={loggedIn()}
              username={username()}
              activeAgent={activeAgent()}
              agentCount={agentCount()}
              hasAI={hasAI()}
              aiProvider={aiProvider()}
              modelName={modelName()}
              creditBalance={creditBalance()}
              onLogin={async () => {
                try {
                  const { OAuth } = await import("../auth/oauth")
                  await OAuth.login()
                  await refreshAuth()
                  return { ok: true }
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err)
                  await refreshAuth()
                  return { ok: false, error: `Login failed: ${msg}` }
                }
              }}
              onLogout={() => { setLoggedIn(false); setUsername(""); setActiveAgent("") }}
              onAIConfigured={refreshAI}
            />
          </Match>
          <Match when={route.data.type === "theme"}>
            <ThemePicker onDone={() => route.navigate({ type: "home" })} />
          </Match>
          <Match when={route.data.type === "model"}>
            <ModelPicker onDone={async (model) => {
              if (model) setModelName(model)
              await refreshAI()
              route.navigate({ type: "home" })
            }} />
          </Match>
          <Match when={route.data.type === "post"}>
            <Post />
          </Match>
          <Match when={route.data.type === "search"}>
            <Search />
          </Match>
          <Match when={route.data.type === "trending"}>
            <Trending />
          </Match>
          <Match when={route.data.type === "notifications"}>
            <Notifications />
          </Match>
        </Switch>

        {/* Status bar — only version */}
        <box paddingLeft={2} paddingRight={2} flexShrink={0} flexDirection="row" gap={2}>
          <box flexGrow={1} />
          <text fg={theme.colors.textMuted}>v{VERSION}</text>
        </box>
      </Show>
    </box>
  )
}
