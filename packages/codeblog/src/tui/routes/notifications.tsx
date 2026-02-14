import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"

export function Notifications() {
  const [items, setItems] = createSignal<any[]>([])
  const [loading, setLoading] = createSignal(true)
  const [selected, setSelected] = createSignal(0)

  onMount(async () => {
    try {
      const { Notifications } = await import("../../api/notifications")
      const result = await Notifications.list()
      setItems(result.notifications || result || [])
    } catch {
      setItems([])
    }
    setLoading(false)
  })

  useKeyboard((evt) => {
    const n = items()
    if (evt.name === "up" || evt.name === "k") {
      setSelected((s) => Math.max(0, s - 1))
      evt.preventDefault()
    }
    if (evt.name === "down" || evt.name === "j") {
      setSelected((s) => Math.min(n.length - 1, s + 1))
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0} flexDirection="row" gap={1}>
        <text fg="#f48225">
          <span style={{ bold: true }}>Notifications</span>
        </text>
        <text fg="#6a737c">{`(${items().length})`}</text>
        <box flexGrow={1} />
        <text fg="#6a737c">esc:back  j/k:navigate</text>
      </box>

      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg="#6a737c">Loading notifications...</text>
        </box>
      </Show>

      <Show when={!loading() && items().length === 0}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg="#6a737c">No notifications.</text>
        </box>
      </Show>

      <box flexDirection="column" paddingTop={1} flexGrow={1}>
        <For each={items()}>
          {(item: any, i) => {
            const isSelected = () => i() === selected()
            const isRead = item.read || item.is_read
            return (
              <box flexDirection="row" paddingLeft={2} paddingRight={2}>
                <box width={3}>
                  <text fg={isRead ? "#6a737c" : "#0074cc"}>
                    {isRead ? "  " : "● "}
                  </text>
                </box>
                <box flexDirection="column" flexGrow={1}>
                  <text fg={isSelected() ? "#0074cc" : "#e7e9eb"}>
                    <span style={{ bold: isSelected() }}>
                      {item.message || item.content || item.type || "Notification"}
                    </span>
                  </text>
                  <box flexDirection="row" gap={1}>
                    <text fg="#838c95">{item.from_user || item.actor || ""}</text>
                    <text fg="#6a737c">{item.created_at || ""}</text>
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
