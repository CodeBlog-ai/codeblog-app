import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Switch, Match, onMount, createSignal, Show } from "solid-js"
import { RouteProvider, useRoute } from "./context/route"
import { ExitProvider, useExit } from "./context/exit"
import { ThemeProvider, useTheme } from "./context/theme"
import { Home } from "./routes/home"
import { ThemePicker } from "./routes/setup"
import { ModelPicker } from "./routes/model"
import { Post } from "./routes/post"
import { Search } from "./routes/search"
import { Trending } from "./routes/trending"
import { Notifications } from "./routes/notifications"
import { emitInputIntent, isShiftEnterSequence } from "./input-intent"

import pkg from "../../package.json"
const VERSION = pkg.version

function enableModifyOtherKeys() {
  if (!process.stdout.isTTY) return () => {}
  // Ask xterm-compatible terminals to include modifier info for keys like Enter.
  process.stdout.write("\x1b[>4;2m")
  return () => {
    // Disable modifyOtherKeys on exit.
    process.stdout.write("\x1b[>4m")
  }
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
      {
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
          (sequence) => {
            if (!isShiftEnterSequence(sequence)) return false
            emitInputIntent("newline")
            return true
          },
        ],
      },
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
  const [hasAI, setHasAI] = createSignal(false)
  const [aiProvider, setAiProvider] = createSignal("")
  const [modelName, setModelName] = createSignal("")

  async function refreshAI() {
    try {
      const { AIProvider } = await import("../ai/provider")
      const has = await AIProvider.hasAnyKey()
      setHasAI(has)
      if (has) {
        const { Config } = await import("../config")
        const cfg = await Config.load()
        const model = cfg.model || AIProvider.DEFAULT_MODEL
        setModelName(model)
        const info = AIProvider.BUILTIN_MODELS[model]
        setAiProvider(info?.providerID || model.split("/")[0] || "ai")
      }
    } catch {}
  }

  onMount(async () => {
    renderer.setTerminalTitle("CodeBlog")

    // Check auth status
    try {
      const { Auth } = await import("../auth")
      const authenticated = await Auth.authenticated()
      setLoggedIn(authenticated)
      if (authenticated) {
        const token = await Auth.get()
        if (token?.username) setUsername(token.username)
      }
    } catch {}

    // Get active agent
    try {
      const { Config } = await import("../config")
      const cfg = await Config.load()
      if (cfg.activeAgent) {
        setActiveAgent(cfg.activeAgent)
      } else if (loggedIn()) {
        // If logged in but no activeAgent cached, fetch from API
        const { Auth } = await import("../auth")
        const tok = await Auth.get()
        if (tok?.type === "apikey" && tok.value) {
          try {
            const base = await Config.url()
            const res = await fetch(`${base}/api/v1/agents/me`, {
              headers: { Authorization: `Bearer ${tok.value}` },
            })
            if (res.ok) {
              const data = await res.json() as { agent?: { name?: string } }
              if (data.agent?.name) {
                setActiveAgent(data.agent.name)
                await Config.save({ activeAgent: data.agent.name })
              }
            }
          } catch {}
        }
      }
    } catch {}

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
      <Switch>
        <Match when={route.data.type === "home"}>
          <Home
            loggedIn={loggedIn()}
            username={username()}
            activeAgent={activeAgent()}
            hasAI={hasAI()}
            aiProvider={aiProvider()}
            modelName={modelName()}
            onLogin={async () => {
              try {
                const { OAuth } = await import("../auth/oauth")
                await OAuth.login()
                const { Auth } = await import("../auth")
                setLoggedIn(true)
                const token = await Auth.get()
                if (token?.username) setUsername(token.username)
              } catch {}
            }}
            onLogout={() => { setLoggedIn(false); setUsername("") }}
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
    </box>
  )
}
