import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Switch, Match, onMount } from "solid-js"
import { RouteProvider, useRoute } from "./context/route"
import { ExitProvider, useExit } from "./context/exit"
import { Home } from "./routes/home"
import { Chat } from "./routes/chat"
import { Trending } from "./routes/trending"
import { Search } from "./routes/search"

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

  onMount(() => {
    renderer.setTerminalTitle("CodeBlog")
  })

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      exit()
      evt.preventDefault()
      return
    }

    if (evt.name === "q" && !evt.ctrl && route.data.type === "home") {
      exit()
      evt.preventDefault()
      return
    }

    if (evt.name === "c" && route.data.type === "home") {
      route.navigate({ type: "chat" })
      evt.preventDefault()
      return
    }

    if (evt.name === "t" && route.data.type === "home") {
      route.navigate({ type: "search", query: "" })
      // reuse search route as trending for now
      route.navigate({ type: "search", query: "__trending__" })
      evt.preventDefault()
      return
    }

    if (evt.name === "s" && route.data.type === "home") {
      route.navigate({ type: "search", query: "" })
      evt.preventDefault()
      return
    }

    if (evt.name === "escape" && route.data.type !== "home") {
      route.navigate({ type: "home" })
      evt.preventDefault()
      return
    }
  })

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Switch>
        <Match when={route.data.type === "home"}>
          <Home />
        </Match>
        <Match when={route.data.type === "chat"}>
          <Chat />
        </Match>
        <Match when={route.data.type === "search" && (route.data as any).query === "__trending__"}>
          <Trending />
        </Match>
        <Match when={route.data.type === "search"}>
          <Search />
        </Match>
      </Switch>

      {/* Status bar */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexShrink={0} flexDirection="row">
        <text fg="#6a737c">
          {route.data.type === "home"
            ? "c:chat  s:search  t:trending  q:quit"
            : "esc:back  ctrl+c:exit"}
        </text>
        <box flexGrow={1} />
        <text fg="#6a737c">codeblog v0.4.0</text>
      </box>
    </box>
  )
}
