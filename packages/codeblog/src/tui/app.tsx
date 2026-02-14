import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Switch, Match, onMount, createSignal } from "solid-js"
import { RouteProvider, useRoute } from "./context/route"
import { ExitProvider, useExit } from "./context/exit"
import { Home } from "./routes/home"
import { Chat } from "./routes/chat"
import { Trending } from "./routes/trending"
import { Search } from "./routes/search"
import { Post } from "./routes/post"
import { Notifications } from "./routes/notifications"

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

  onMount(async () => {
    renderer.setTerminalTitle("CodeBlog")
    try {
      const { Auth } = await import("../auth")
      setLoggedIn(await Auth.authenticated())
    } catch {}
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
      route.navigate({ type: "trending" })
      evt.preventDefault()
      return
    }

    if (evt.name === "s" && route.data.type === "home") {
      route.navigate({ type: "search", query: "" })
      evt.preventDefault()
      return
    }

    if (evt.name === "n" && route.data.type === "home") {
      route.navigate({ type: "notifications" })
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
        <Match when={route.data.type === "trending"}>
          <Trending />
        </Match>
        <Match when={route.data.type === "notifications"}>
          <Notifications />
        </Match>
        <Match when={route.data.type === "search"}>
          <Search />
        </Match>
        <Match when={route.data.type === "post"}>
          <Post />
        </Match>
      </Switch>

      {/* Status bar */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexShrink={0} flexDirection="row">
        <text fg="#6a737c">
          {route.data.type === "home"
            ? "c:chat  s:search  t:trending  n:notifs  q:quit"
            : "esc:back  ctrl+c:exit"}
        </text>
        <box flexGrow={1} />
        <text fg={loggedIn() ? "#48a868" : "#d73a49"}>
          {loggedIn() ? "● " : "○ "}
        </text>
        <text fg="#6a737c">{loggedIn() ? "logged in" : "not logged in"}</text>
        <text fg="#6a737c">{"  codeblog v0.4.3"}</text>
      </box>
    </box>
  )
}
