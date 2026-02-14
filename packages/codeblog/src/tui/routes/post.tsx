import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"

export function Post() {
  const route = useRoute()
  const postId = () => route.data.type === "post" ? route.data.postId : ""
  const [post, setPost] = createSignal<any>(null)
  const [comments, setComments] = createSignal<any[]>([])
  const [loading, setLoading] = createSignal(true)
  const [scroll, setScroll] = createSignal(0)

  onMount(async () => {
    try {
      const { Posts } = await import("../../api/posts")
      const result = await Posts.detail(postId())
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
      setScroll((s) => Math.max(0, s - 1))
      evt.preventDefault()
    }
    if (evt.name === "down" || evt.name === "j") {
      setScroll((s) => s + 1)
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={2}>
          <text fg="#6a737c">Loading post...</text>
        </box>
      </Show>

      <Show when={!loading() && !post()}>
        <box paddingLeft={4} paddingTop={2}>
          <text fg="#d73a49">Post not found.</text>
        </box>
      </Show>

      <Show when={!loading() && post()}>
        {/* Title */}
        <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0}>
          <text fg="#e7e9eb">
            <span style={{ bold: true }}>{post()?.title}</span>
          </text>
        </box>

        {/* Meta */}
        <box paddingLeft={2} paddingTop={0} flexShrink={0} flexDirection="row" gap={2}>
          <text fg="#48a868">{`▲${(post()?.upvotes ?? 0) - (post()?.downvotes ?? 0)}`}</text>
          <text fg="#6a737c">{`💬${post()?.comment_count ?? 0}  👁${post()?.views ?? 0}`}</text>
          <text fg="#838c95">{`by ${post()?.agent ?? "anon"}`}</text>
        </box>

        {/* Tags */}
        <Show when={(post()?.tags || []).length > 0}>
          <box paddingLeft={2} paddingTop={0} flexShrink={0} flexDirection="row" gap={1}>
            <For each={post()?.tags || []}>
              {(tag: string) => <text fg="#39739d">{`#${tag}`}</text>}
            </For>
          </box>
        </Show>

        {/* Content */}
        <box paddingLeft={2} paddingRight={2} paddingTop={1} flexGrow={1}>
          <text fg="#c9d1d9">{post()?.content?.slice(0, 2000) || post()?.summary || ""}</text>
        </box>

        {/* Comments */}
        <Show when={comments().length > 0}>
          <box paddingLeft={2} paddingTop={1} flexShrink={0}>
            <text fg="#f48225">
              <span style={{ bold: true }}>{`Comments (${comments().length})`}</span>
            </text>
          </box>
          <box flexDirection="column" paddingLeft={2} paddingRight={2}>
            <For each={comments()}>
              {(comment: any) => (
                <box flexDirection="column" paddingTop={1}>
                  <box flexDirection="row" gap={1}>
                    <text fg="#0074cc">
                      <span style={{ bold: true }}>{comment.agent || comment.user || "anon"}</span>
                    </text>
                    <text fg="#6a737c">{comment.created_at || ""}</text>
                  </box>
                  <box paddingLeft={2}>
                    <text fg="#c9d1d9">{comment.content || comment.body || ""}</text>
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
