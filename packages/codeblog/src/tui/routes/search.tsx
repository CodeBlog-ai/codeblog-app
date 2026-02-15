import { createSignal, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"

export function Search() {
  const route = useRoute()
  const [query, setQuery] = createSignal(route.data.type === "search" ? route.data.query : "")
  const [results, setResults] = createSignal<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = createSignal(false)
  const [searched, setSearched] = createSignal(false)

  async function doSearch(q: string) {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const { Search } = await import("../../api/search")
      const result = await Search.query(q.trim())
      const rows = Array.isArray(result.posts) ? result.posts : []
      setResults(rows.map((item) => (item && typeof item === "object" ? item as Record<string, unknown> : {})))
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
        <text fg="#f48225">
          <span style={{ bold: true }}>Search</span>
        </text>
        <box flexGrow={1} />
        <text fg="#6a737c">esc:back</text>
      </box>

      {/* Search input */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0} flexDirection="row">
        <text fg="#0074cc">
          <span style={{ bold: true }}>{"🔍 "}</span>
        </text>
        <text fg="#e7e9eb">{query()}</text>
        <text fg="#6a737c">{"█"}</text>
      </box>

      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg="#6a737c">Searching...</text>
        </box>
      </Show>

      <Show when={!loading() && searched() && results().length === 0}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg="#6a737c">No results found.</text>
        </box>
      </Show>

      <box flexDirection="column" paddingTop={1} flexGrow={1}>
        <For each={results()}>
          {(item) => {
            const score =
              typeof item.score === "number"
                ? item.score
                : typeof item.upvotes === "number"
                  ? item.upvotes
                  : 0
            const title = typeof item.title === "string" ? item.title : "Untitled"
            const commentCount = typeof item.comment_count === "number" ? item.comment_count : 0
            const tags = Array.isArray(item.tags)
              ? item.tags.filter((tag): tag is string => typeof tag === "string")
              : []

            return (
              <box flexDirection="row" paddingLeft={2} paddingRight={2}>
                <box width={6} justifyContent="flex-end" marginRight={1}>
                  <text fg="#48a868">{`▲${score}`}</text>
                </box>
                <box flexDirection="column" flexGrow={1}>
                  <text fg="#e7e9eb">
                    <span style={{ bold: true }}>{title}</span>
                  </text>
                  <box flexDirection="row" gap={1}>
                    <text fg="#6a737c">{`💬${commentCount}`}</text>
                    <For each={tags.slice(0, 3)}>
                      {(tag) => <text fg="#39739d">{`#${tag}`}</text>}
                    </For>
                  </box>
                </box>
              </box>
            )
          }}
        </For>
      </box>
    </box>
  )
}
