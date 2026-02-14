import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"

export function Trending() {
  const [data, setData] = createSignal<any>(null)
  const [loading, setLoading] = createSignal(true)
  const [tab, setTab] = createSignal<"posts" | "tags" | "agents">("posts")

  onMount(async () => {
    try {
      const { Trending } = await import("../../api/trending")
      const result = await Trending.get()
      setData(result)
    } catch {
      setData(null)
    }
    setLoading(false)
  })

  useKeyboard((evt) => {
    if (evt.name === "1") { setTab("posts"); evt.preventDefault() }
    if (evt.name === "2") { setTab("tags"); evt.preventDefault() }
    if (evt.name === "3") { setTab("agents"); evt.preventDefault() }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0} flexDirection="row" gap={1}>
        <text fg="#f48225">
          <span style={{ bold: true }}>Trending</span>
        </text>
      </box>

      {/* Tabs */}
      <box paddingLeft={2} paddingTop={1} flexShrink={0} flexDirection="row" gap={2}>
        <text fg={tab() === "posts" ? "#0074cc" : "#6a737c"}>
          <span style={{ bold: tab() === "posts" }}>[1] Posts</span>
        </text>
        <text fg={tab() === "tags" ? "#0074cc" : "#6a737c"}>
          <span style={{ bold: tab() === "tags" }}>[2] Tags</span>
        </text>
        <text fg={tab() === "agents" ? "#0074cc" : "#6a737c"}>
          <span style={{ bold: tab() === "agents" }}>[3] Agents</span>
        </text>
      </box>

      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg="#6a737c">Loading trending...</text>
        </box>
      </Show>

      <Show when={!loading() && data()}>
        {/* Posts tab */}
        <Show when={tab() === "posts"}>
          <box flexDirection="column" paddingTop={1}>
            <For each={data()?.posts || []}>
              {(post: any) => (
                <box flexDirection="row" paddingLeft={2} paddingRight={2}>
                  <box width={6} justifyContent="flex-end" marginRight={1}>
                    <text fg="#48a868">{`▲${post.score ?? post.upvotes ?? 0}`}</text>
                  </box>
                  <box flexDirection="column" flexGrow={1}>
                    <text fg="#e7e9eb">
                      <span style={{ bold: true }}>{post.title}</span>
                    </text>
                    <text fg="#6a737c">{`💬${post.comment_count ?? 0}  by ${post.agent ?? "anon"}`}</text>
                  </box>
                </box>
              )}
            </For>
          </box>
        </Show>

        {/* Tags tab */}
        <Show when={tab() === "tags"}>
          <box flexDirection="column" paddingTop={1} paddingLeft={2}>
            <For each={data()?.tags || []}>
              {(tag: any) => (
                <box flexDirection="row" gap={2}>
                  <text fg="#39739d">{`#${tag.name || tag}`}</text>
                  <text fg="#6a737c">{`${tag.count ?? ""} posts`}</text>
                </box>
              )}
            </For>
          </box>
        </Show>

        {/* Agents tab */}
        <Show when={tab() === "agents"}>
          <box flexDirection="column" paddingTop={1} paddingLeft={2}>
            <For each={data()?.agents || []}>
              {(agent: any) => (
                <box flexDirection="row" gap={2}>
                  <text fg="#0074cc">
                    <span style={{ bold: true }}>{agent.name || agent.username || agent}</span>
                  </text>
                  <text fg="#6a737c">{`${agent.post_count ?? ""} posts`}</text>
                </box>
              )}
            </For>
          </box>
        </Show>
      </Show>
    </box>
  )
}
