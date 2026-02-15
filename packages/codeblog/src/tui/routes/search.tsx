import { createSignal, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTheme } from "../context/theme"
import { McpBridge } from "../../mcp/client"

export function Search() {
  const route = useRoute()
  const theme = useTheme()
  const [query, setQuery] = createSignal(route.data.type === "search" ? route.data.query : "")
  const [results, setResults] = createSignal<any[]>([])
  const [loading, setLoading] = createSignal(false)
  const [searched, setSearched] = createSignal(false)

  async function doSearch(q: string) {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const result = await McpBridge.callToolJSON<any>("search_posts", { query: q.trim() })
      setResults(result.results || result.posts || [])
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  useKeyboard((evt) => {
    if (evt.name === "return" && !evt.shift) {
      doSearch(query())
      evt.preventDefault()
      return
    }
    if (evt.name === "backspace") {
      setQuery((s) => s.slice(0, -1))
      evt.preventDefault()
      return
    }
    if (evt.sequence && evt.sequence.length === 1 && !evt.ctrl && !evt.meta) {
      setQuery((s) => s + evt.sequence)
      evt.preventDefault()
      return
    }
    if (evt.name === "space") {
      setQuery((s) => s + " ")
      evt.preventDefault()
      return
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0} flexDirection="row" gap={1}>
        <text fg={theme.colors.accent}>
          <span style={{ bold: true }}>Search</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.colors.textMuted}>esc:back</text>
      </box>

      <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0} flexDirection="row">
        <text fg={theme.colors.primary}>
          <span style={{ bold: true }}>{"🔍 "}</span>
        </text>
        <text fg={theme.colors.input}>{query()}</text>
        <text fg={theme.colors.cursor}>{"█"}</text>
      </box>

      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg={theme.colors.textMuted}>Searching...</text>
        </box>
      </Show>

      <Show when={!loading() && searched() && results().length === 0}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg={theme.colors.textMuted}>No results found.</text>
        </box>
      </Show>

      <box flexDirection="column" paddingTop={1} flexGrow={1}>
        <For each={results()}>
          {(item: any) => (
            <box flexDirection="row" paddingLeft={2} paddingRight={2}>
              <box width={6} justifyContent="flex-end" marginRight={1}>
                <text fg={theme.colors.success}>{`▲${item.score ?? item.upvotes ?? 0}`}</text>
              </box>
              <box flexDirection="column" flexGrow={1}>
                <text fg={theme.colors.text}>
                  <span style={{ bold: true }}>{item.title}</span>
                </text>
                <box flexDirection="row" gap={1}>
                  <text fg={theme.colors.textMuted}>{`💬${item.comment_count ?? 0}`}</text>
                  <For each={(item.tags || []).slice(0, 3)}>
                    {(tag: string) => <text fg={theme.colors.primary}>{`#${tag}`}</text>}
                  </For>
                </box>
              </box>
            </box>
          )}
        </For>
      </box>
    </box>
  )
}
