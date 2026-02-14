import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Switch, Match, onMount, createSignal, Show } from "solid-js"
import { RouteProvider, useRoute } from "./context/route"
import { ExitProvider, useExit } from "./context/exit"
import { Home } from "./routes/home"
import { Chat } from "./routes/chat"

import pkg from "../../package.json"
const VERSION = pkg.version

export function tui(input: { onExit?: () => Promise<void> }) {
  return new Promise<void>(async (resolve) => {
    render(
      () => (
        <ExitProvider onExit={async () => { await input.onExit?.(); resolve() }}>
          <RouteProvider>
            <App />
          </RouteProvider>
        </ExitProvider>
      ),
      {
        targetFps: 30,
        exitOnCtrlC: false,
        autoFocus: false,
        openConsoleOnError: false,
      },
    )
  })
}

function App() {
  const route = useRoute()
  const exit = useExit()
  const dimensions = useTerminalDimensions()
  const renderer = useRenderer()
  const [loggedIn, setLoggedIn] = createSignal(false)
  const [username, setUsername] = createSignal("")
  const [hasAI, setHasAI] = createSignal(false)
  const [aiProvider, setAiProvider] = createSignal("")

  onMount(async () => {
    renderer.setTerminalTitle("CodeBlog")

    // Check auth status
    try {
      const { Auth } = await import("../auth")
      const authenticated = await Auth.authenticated()
      setLoggedIn(authenticated)
      if (authenticated) {
        const token = await Auth.load()
        if (token?.username) setUsername(token.username)
      }
    } catch {}

    // Check AI provider status
    try {
      const { AIProvider } = await import("../ai/provider")
      const has = await AIProvider.hasAnyKey()
      setHasAI(has)
      if (has) {
        const { Config } = await import("../config")
        const cfg = await Config.load()
        const model = cfg.model || AIProvider.DEFAULT_MODEL
        const info = AIProvider.BUILTIN_MODELS[model]
        setAiProvider(info?.name || model)
      }
    } catch {}
  })

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      exit()
      evt.preventDefault()
      return
    }

    // Home screen shortcuts
    if (route.data.type === "home") {
      if (evt.name === "q" && !evt.ctrl) {
        exit()
        evt.preventDefault()
        return
      }
    }

    // Back navigation
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
            hasAI={hasAI()}
            aiProvider={aiProvider()}
            onLogin={async () => {
              try {
                const { OAuth } = await import("../auth/oauth")
                await OAuth.login("github")
                const { Auth } = await import("../auth")
                setLoggedIn(true)
                const token = await Auth.load()
                if (token?.username) setUsername(token.username)
              } catch {}
            }}
          />
        </Match>
        <Match when={route.data.type === "chat"}>
          <Chat />
        </Match>
      </Switch>

      {/* Status bar */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexShrink={0} flexDirection="row">
        <text fg="#6a737c">
          {route.data.type === "home"
            ? "type to chat · /help · q:quit"
            : "esc:back · ctrl+c:exit"}
        </text>
        <box flexGrow={1} />
        <Show when={hasAI()}>
          <text fg="#48a868">{"● "}</text>
          <text fg="#6a737c">{aiProvider()}</text>
          <text fg="#6a737c">{"  "}</text>
        </Show>
        <Show when={!hasAI()}>
          <text fg="#d73a49">{"○ "}</text>
          <text fg="#6a737c">{"no AI  "}</text>
        </Show>
        <text fg={loggedIn() ? "#48a868" : "#d73a49"}>
          {loggedIn() ? "● " : "○ "}
        </text>
        <text fg="#6a737c">{loggedIn() ? username() || "logged in" : "not logged in"}</text>
        <text fg="#6a737c">{`  v${VERSION}`}</text>
      </box>
    </box>
  )
}
