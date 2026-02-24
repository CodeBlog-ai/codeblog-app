import { createSignal, createMemo, onMount, Show, For } from "solid-js"
import { useKeyboard, usePaste } from "@opentui/solid"
import { useTheme } from "../context/theme"

interface ModelItem {
  id: string
  name: string
  provider: string
}

export function ModelPicker(props: { onDone: (model?: string) => void }) {
  const theme = useTheme()
  const [models, setModels] = createSignal<ModelItem[]>([])
  const [idx, setIdx] = createSignal(0)
  const [current, setCurrent] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [filter, setFilter] = createSignal("")
  const [status, setStatus] = createSignal("")

  // Visible height for scrolling
  const maxVisible = 15

  const filtered = createMemo(() => {
    const q = filter().toLowerCase()
    if (!q) return models()
    return models().filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
  })

  // Scroll offset
  const scrollTop = createMemo(() => {
    const i = idx()
    const len = filtered().length
    if (len <= maxVisible) return 0
    if (i < maxVisible - 2) return 0
    if (i > len - 3) return Math.max(0, len - maxVisible)
    return i - maxVisible + 3
  })

  const visible = createMemo(() => filtered().slice(scrollTop(), scrollTop() + maxVisible))

  onMount(async () => {
    try {
      const { AIProvider } = await import("../../ai/provider")
      const { Config } = await import("../../config")
      const { resolveModelFromConfig } = await import("../../ai/models")
      const cfg = await Config.load()
      const resolved = resolveModelFromConfig(cfg) || AIProvider.DEFAULT_MODEL
      setCurrent(resolved)
      if (cfg.cli?.model !== resolved) await Config.save({ cli: { model: resolved } })

      setStatus("Fetching models from API...")
      const all = await AIProvider.available()
      const items = all.filter((m) => m.hasKey).map((m) => ({
        id: m.model.id,
        name: m.model.name,
        provider: m.model.providerID,
      }))
      if (items.length > 0) {
        setModels(items)
        const modelId = resolveModelFromConfig(cfg) || AIProvider.DEFAULT_MODEL
        const curIdx = items.findIndex((m) => m.id === modelId || `${m.provider}/${m.id}` === modelId)
        if (curIdx >= 0) setIdx(curIdx)
        setStatus(`${items.length} models loaded`)
      } else {
        setModels([])
        setStatus("No models with API keys configured")
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setLoading(false)
  })

  usePaste((evt) => {
    const text = evt.text.replace(/[\n\r]/g, "").trim()
    if (text) {
      setFilter((s) => s + text)
      setIdx(0)
      evt.preventDefault()
    }
  })

  useKeyboard((evt) => {
    if (evt.name === "up") {
      setIdx((i) => (i - 1 + filtered().length) % filtered().length)
      evt.preventDefault()
      return
    }
    if (evt.name === "down") {
      setIdx((i) => (i + 1) % filtered().length)
      evt.preventDefault()
      return
    }
    if (evt.name === "return") {
      const m = filtered()[idx()]
      if (m) save(m.id)
      evt.preventDefault()
      return
    }
    if (evt.name === "escape") {
      if (filter()) { setFilter(""); setIdx(0) }
      else props.onDone()
      evt.preventDefault()
      return
    }
    if (evt.name === "backspace") {
      setFilter((s) => s.slice(0, -1))
      setIdx(0)
      evt.preventDefault()
      return
    }
    if (evt.sequence && evt.sequence.length >= 1 && !evt.ctrl && !evt.meta) {
      const clean = evt.sequence.replace(/[\x00-\x1f\x7f]/g, "")
      if (clean) {
        setFilter((s) => s + clean)
        setIdx(0)
        evt.preventDefault()
        return
      }
    }
    if (evt.name === "space") {
      setFilter((s) => s + " ")
      evt.preventDefault()
      return
    }
  })

  async function save(id: string) {
    try {
      const item = filtered().find((m) => m.id === id)
      const saveId = item && item.provider === "openai-compatible" ? `openai-compatible/${id}` : id
      const { Config } = await import("../../config")
      await Config.save({ cli: { model: saveId } })
      props.onDone(saveId)
    } catch {
      props.onDone()
    }
  }

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
      <box flexDirection="row" flexShrink={0}>
        <text fg={theme.colors.primary}>
          <span style={{ bold: true }}>Select Model</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.colors.textMuted}>
          ↑↓ select · Enter confirm · Type to filter · Esc back
        </text>
      </box>

      <box flexShrink={0} flexDirection="row" paddingTop={1}>
        <text fg={theme.colors.textMuted}>Current: </text>
        <text fg={theme.colors.success}>{current()}</text>
        <text fg={theme.colors.textMuted}>{" · " + status()}</text>
      </box>

      {/* Filter input */}
      <box flexShrink={0} paddingTop={1} flexDirection="row">
        <text fg={theme.colors.primary}><span style={{ bold: true }}>{"❯ "}</span></text>
        <text fg={theme.colors.input}>{filter()}</text>
        <text fg={theme.colors.cursor}>{"█"}</text>
        <Show when={!filter()}>
          <text fg={theme.colors.textMuted}> type to filter...</text>
        </Show>
      </box>

      <box height={1} />

      <Show when={loading()}>
        <text fg={theme.colors.textMuted}>Fetching models from API...</text>
      </Show>

      <Show when={!loading()}>
        <Show when={filtered().length === 0}>
          <text fg={theme.colors.warning}>No models match "{filter()}"</text>
        </Show>
        <Show when={filtered().length > 0}>
          <box flexDirection="column" flexShrink={0}>
            <For each={visible()}>
              {(m, i) => {
                const selected = () => scrollTop() + i() === idx()
                return (
                  <box flexDirection="row" backgroundColor={selected() ? theme.colors.primary : undefined}>
                    <text fg={selected() ? "#ffffff" : theme.colors.textMuted}>
                      {selected() ? "❯ " : "  "}
                    </text>
                    <text fg={selected() ? "#ffffff" : theme.colors.text}>
                      <span style={{ bold: selected() }}>
                        {m.id.length > 40 ? m.id.slice(0, 40) + "…" : m.id.padEnd(42)}
                      </span>
                    </text>
                    <text fg={selected() ? "#ffffff" : theme.colors.textMuted}>
                      {" " + m.provider}
                    </text>
                    {(m.id === current() || `${m.provider}/${m.id}` === current()) ? (
                      <text fg={selected() ? "#ffffff" : theme.colors.success}>{" ← current"}</text>
                    ) : null}
                  </box>
                )
              }}
            </For>
          </box>
          <Show when={filtered().length > maxVisible}>
            <text fg={theme.colors.textMuted}>
              {"  ↑↓ " + filtered().length + " models total · showing " + (scrollTop() + 1) + "-" + Math.min(scrollTop() + maxVisible, filtered().length)}
            </text>
          </Show>
        </Show>
      </Show>
    </box>
  )
}
