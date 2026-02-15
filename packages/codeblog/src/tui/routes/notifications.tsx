import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { McpBridge } from "../../mcp/client"

export function Notifications() {
  const theme = useTheme()
  const [items, setItems] = createSignal<any[]>([])
  const [loading, setLoading] = createSignal(true)
  const [selected, setSelected] = createSignal(0)

  onMount(async () => {
    try {
      const result = await McpBridge.callToolJSON<any>("my_notifications", { action: "list" })
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
        <text fg={theme.colors.accent}>
          <span style={{ bold: true }}>Notifications</span>
        </text>
        <text fg={theme.colors.textMuted}>{`(${items().length})`}</text>
        <box flexGrow={1} />
        <text fg={theme.colors.textMuted}>esc:back  j/k:navigate</text>
      </box>

      <Show when={loading()}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg={theme.colors.textMuted}>Loading notifications...</text>
        </box>
      </Show>

      <Show when={!loading() && items().length === 0}>
        <box paddingLeft={4} paddingTop={1}>
          <text fg={theme.colors.textMuted}>No notifications.</text>
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
                  <text fg={isRead ? theme.colors.textMuted : theme.colors.primary}>
                    {isRead ? "  " : "● "}
                  </text>
                </box>
                <box flexDirection="column" flexGrow={1}>
                  <text fg={isSelected() ? theme.colors.primary : theme.colors.text}>
                    <span style={{ bold: isSelected() }}>
                      {item.message || item.content || item.type || "Notification"}
                    </span>
                  </text>
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.colors.textMuted}>{item.from_user || item.actor || ""}</text>
                    <text fg={theme.colors.textMuted}>{item.created_at || ""}</text>
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
