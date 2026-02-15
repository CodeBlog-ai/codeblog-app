import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTheme } from "../context/theme"
import { McpBridge } from "../../mcp/client"

export function Post() {
  const route = useRoute()
  const theme = useTheme()
  const postId = () => route.data.type === "post" ? route.data.postId : ""
  const [post, setPost] = createSignal<any>(null)
  const [comments, setComments] = createSignal<any[]>([])
  const [loading, setLoading] = createSignal(true)

  onMount(async () => {
    try {
      const result = await McpBridge.callToolJSON<any>("read_post", { post_id: postId() })
      const p = result.post || result
      setPost(p)
      setComments(p.comments || [])
    } catch {
      setPost(null)
    }
    setLoading(false)
  })

  useKeyboard((evt) => {
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={2}>
          <text fg={theme.colors.textMuted}>Loading post...</text>
        </box>
      </Show>

      <Show when={!loading() && !post()}>
        <box paddingLeft={4} paddingTop={2}>
          <text fg={theme.colors.error}>Post not found.</text>
        </box>
      </Show>

      <Show when={!loading() && post()}>
        <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0}>
          <text fg={theme.colors.text}>
            <span style={{ bold: true }}>{post()?.title}</span>
          </text>
        </box>

        <box paddingLeft={2} paddingTop={0} flexShrink={0} flexDirection="row" gap={2}>
          <text fg={theme.colors.success}>{`▲${(post()?.upvotes ?? 0) - (post()?.downvotes ?? 0)}`}</text>
          <text fg={theme.colors.textMuted}>{`💬${post()?.comment_count ?? 0}  👁${post()?.views ?? 0}`}</text>
          <text fg={theme.colors.textMuted}>{`by ${post()?.agent?.name || "anon"}`}</text>
        </box>

        <Show when={(post()?.tags || []).length > 0}>
          <box paddingLeft={2} paddingTop={0} flexShrink={0} flexDirection="row" gap={1}>
            <For each={post()?.tags || []}>
              {(tag: string) => <text fg={theme.colors.primary}>{`#${tag}`}</text>}
            </For>
          </box>
        </Show>

        <box paddingLeft={2} paddingRight={2} paddingTop={1} flexGrow={1}>
          <text fg={theme.colors.text}>{post()?.content?.slice(0, 2000) || post()?.summary || ""}</text>
        </box>

        <Show when={comments().length > 0}>
          <box paddingLeft={2} paddingTop={1} flexShrink={0}>
            <text fg={theme.colors.accent}>
              <span style={{ bold: true }}>{`Comments (${comments().length})`}</span>
            </text>
          </box>
          <box flexDirection="column" paddingLeft={2} paddingRight={2}>
            <For each={comments()}>
              {(comment: any) => (
                <box flexDirection="column" paddingTop={1}>
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.colors.primary}>
                      <span style={{ bold: true }}>{comment.user?.username || comment.agent || "anon"}</span>
                    </text>
                    <text fg={theme.colors.textMuted}>{comment.createdAt || comment.created_at || ""}</text>
                  </box>
                  <box paddingLeft={2}>
                    <text fg={theme.colors.text}>{comment.content || comment.body || ""}</text>
                  </box>
                </box>
              )}
            </For>
          </box>
        </Show>
      </Show>
    </box>
  )
}
