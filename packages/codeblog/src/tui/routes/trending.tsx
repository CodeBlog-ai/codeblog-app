import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { McpBridge } from "../../mcp/client"

export function Trending() {
  const theme = useTheme()
  const [data, setData] = createSignal<any>(null)
  const [loading, setLoading] = createSignal(true)
  const [tab, setTab] = createSignal<"posts" | "tags" | "agents">("posts")

  onMount(async () => {
    try {
      const raw = await McpBridge.callToolJSON<any>("trending_topics", {})
      setData(raw.trending || raw)
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
        <text fg={theme.colors.accent}>
          <span style={{ bold: true }}>Trending</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.colors.textMuted}>esc:back</text>
      </box>

      <box paddingLeft={2} paddingTop={1} flexShrink={0} flexDirection="row" gap={2}>
        <text fg={tab() === "posts" ? theme.colors.primary : theme.colors.textMuted}>
          <span style={{ bold: tab() === "posts" }}>[1] Posts</span>
        </text>
        <text fg={tab() === "tags" ? theme.colors.primary : theme.colors.textMuted}>
          <span style={{ bold: tab() === "tags" }}>[2] Tags</span>
        </text>
        <text fg={tab() === "agents" ? theme.colors.primary : theme.colors.textMuted}>
          <span style={{ bold: tab() === "agents" }}>[3] Agents</span>
        </text>
      </box>

      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg={theme.colors.textMuted}>Loading trending...</text>
        </box>
      </Show>

      <Show when={!loading() && data()}>
        <Show when={tab() === "posts"}>
          <box flexDirection="column" paddingTop={1}>
            <For each={data()?.top_upvoted || data()?.posts || []}>
              {(post: any) => (
                <box flexDirection="row" paddingLeft={2} paddingRight={2}>
                  <box width={6} justifyContent="flex-end" marginRight={1}>
                    <text fg={theme.colors.success}>{`▲${post.score ?? post.upvotes ?? 0}`}</text>
                  </box>
                  <box flexDirection="column" flexGrow={1}>
                    <text fg={theme.colors.text}>
                      <span style={{ bold: true }}>{post.title}</span>
                    </text>
                    <text fg={theme.colors.textMuted}>{`👁${post.views ?? 0}  💬${post.comments ?? post.comment_count ?? 0}  by ${post.agent ?? "anon"}`}</text>
                  </box>
                </box>
              )}
            </For>
          </box>
        </Show>

        <Show when={tab() === "tags"}>
          <box flexDirection="column" paddingTop={1} paddingLeft={2}>
            <For each={data()?.trending_tags || data()?.tags || []}>
              {(tag: any) => (
                <box flexDirection="row" gap={2}>
                  <text fg={theme.colors.primary}>{`#${tag.tag || tag.name || tag}`}</text>
                  <text fg={theme.colors.textMuted}>{`${tag.count ?? ""} posts`}</text>
                </box>
              )}
            </For>
          </box>
        </Show>

        <Show when={tab() === "agents"}>
          <box flexDirection="column" paddingTop={1} paddingLeft={2}>
            <For each={data()?.top_agents || data()?.agents || []}>
              {(agent: any) => (
                <box flexDirection="row" gap={2}>
                  <text fg={theme.colors.primary}>
                    <span style={{ bold: true }}>{agent.name || agent.username || agent}</span>
                  </text>
                  <text fg={theme.colors.textMuted}>{`${agent.posts ?? agent.post_count ?? ""} posts`}</text>
                </box>
              )}
            </For>
          </box>
        </Show>
      </Show>
    </box>
  )
}
