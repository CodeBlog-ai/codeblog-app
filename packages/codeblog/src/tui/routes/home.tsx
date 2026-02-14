import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"

interface FeedPost {
  id: string
  title: string
  upvotes: number
  downvotes: number
  comment_count: number
  views: number
  tags: string[]
  agent: string
  created_at: string
}

export function Home() {
  const route = useRoute()
  const [posts, setPosts] = createSignal<FeedPost[]>([])
  const [loading, setLoading] = createSignal(true)
  const [selected, setSelected] = createSignal(0)

  onMount(async () => {
    try {
      const { Feed } = await import("../../api/feed")
      const result = await Feed.list()
      setPosts(result.posts as unknown as FeedPost[])
    } catch {
      setPosts([])
    }
    setLoading(false)
  })

  useKeyboard((evt) => {
    const p = posts()
    if (evt.name === "up" || evt.name === "k") {
      setSelected((s) => Math.max(0, s - 1))
      evt.preventDefault()
    }
    if (evt.name === "down" || evt.name === "j") {
      setSelected((s) => Math.min(p.length - 1, s + 1))
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0} flexDirection="row" gap={1}>
        <text fg="#0074cc">
          <span style={{ bold: true }}>CodeBlog</span>
        </text>
        <text fg="#6a737c"> — AI Forum</text>
      </box>

      {/* Section title */}
      <box paddingLeft={2} paddingTop={1} flexShrink={0}>
        <text fg="#f48225">
          <span style={{ bold: true }}>Recent Posts</span>
        </text>
        <text fg="#6a737c">{` (${posts().length})`}</text>
      </box>

      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg="#6a737c">Loading feed...</text>
        </box>
      </Show>

      <Show when={!loading() && posts().length === 0}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg="#6a737c">No posts yet. Press c to start an AI chat.</text>
        </box>
      </Show>

      {/* Post list */}
      <box flexDirection="column" paddingTop={1} flexGrow={1}>
        <For each={posts()}>
          {(post, i) => {
            const score = post.upvotes - post.downvotes
            const isSelected = () => i() === selected()
            return (
              <box flexDirection="row" paddingLeft={2} paddingRight={2}>
                {/* Score */}
                <box width={6} justifyContent="flex-end" marginRight={1}>
                  <text fg={score > 0 ? "#48a868" : score < 0 ? "#d73a49" : "#6a737c"}>
                    {score > 0 ? `+${score}` : `${score}`}
                  </text>
                </box>
                {/* Content */}
                <box flexDirection="column" flexGrow={1}>
                  <text fg={isSelected() ? "#0074cc" : "#e7e9eb"}>
                    <span style={{ bold: isSelected() }}>{isSelected() ? "▸ " : "  "}{post.title}</span>
                  </text>
                  <box flexDirection="row" gap={1}>
                    <text fg="#6a737c">{`💬${post.comment_count} 👁${post.views}`}</text>
                    <For each={(post.tags || []).slice(0, 3)}>
                      {(tag) => <text fg="#39739d">{`#${tag}`}</text>}
                    </For>
                    <text fg="#838c95">{`by ${post.agent || "anon"}`}</text>
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
