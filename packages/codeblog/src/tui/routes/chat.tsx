import { createSignal, For, Show, onMount } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTheme } from "../context/theme"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function Chat() {
  const route = useRoute()
  const theme = useTheme()
  const [messages, setMessages] = createSignal<Message[]>([])
  const [streaming, setStreaming] = createSignal(false)
  const [streamText, setStreamText] = createSignal("")
  const [model, setModel] = createSignal("")
  const [modelName, setModelName] = createSignal("")
  const [inputBuf, setInputBuf] = createSignal("")

  onMount(async () => {
    try {
      const { Config } = await import("../../config")
      const { AIProvider } = await import("../../ai/provider")
      const cfg = await Config.load()
      const id = cfg.model || AIProvider.DEFAULT_MODEL
      setModel(id)
      const info = AIProvider.BUILTIN_MODELS[id]
      setModelName(info?.name || id)
    } catch {}

    // Auto-send initial message from home screen
    const data = route.data as any
    if (data.sessionMessages?.length > 0) {
      for (const msg of data.sessionMessages) {
        if (msg.role === "user") {
          send(msg.content)
          break
        }
      }
    }
  })

  async function send(text: string) {
    if (!text.trim() || streaming()) return
    const userMsg: Message = { role: "user", content: text.trim() }
    const prev = messages()
    setMessages([...prev, userMsg])
    setStreaming(true)
    setStreamText("")

    try {
      const { AIChat } = await import("../../ai/chat")
      const allMsgs = [...prev, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))

      let full = ""
      await AIChat.stream(
        allMsgs,
        {
          onToken: (token) => {
            full += token
            setStreamText(full)
          },
          onFinish: (t) => {
            setMessages((p) => [...p, { role: "assistant", content: t }])
            setStreamText("")
            setStreaming(false)
          },
          onError: (err) => {
            setMessages((p) => [...p, { role: "assistant", content: `Error: ${err.message}` }])
            setStreamText("")
            setStreaming(false)
          },
        },
        model(),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((p) => [...p, { role: "assistant", content: `Error: ${msg}` }])
      setStreamText("")
      setStreaming(false)
    }
  }

  function handleCommand(cmd: string) {
    const parts = cmd.split(/\s+/)
    const name = parts[0]

    if (name === "/clear") {
      setMessages([])
      setStreamText("")
      return
    }

    if (name === "/model") {
      const id = parts[1]
      if (!id) {
        setMessages((p) => [...p, { role: "assistant", content: `Current model: ${modelName()} (${model()})\nUsage: /model <model-id>` }])
        return
      }
      setModel(id)
      import("../../ai/provider").then(({ AIProvider }) => {
        const info = AIProvider.BUILTIN_MODELS[id]
        setModelName(info?.name || id)
      }).catch(() => setModelName(id))
      setMessages((p) => [...p, { role: "assistant", content: `Switched to model: ${id}` }])
      return
    }

    if (name === "/help") {
      setMessages((p) => [...p, {
        role: "assistant",
        content: [
          "Available commands:",
          "  /model <id>  — switch AI model (e.g. /model gpt-4o)",
          "  /model       — show current model",
          "  /clear       — clear conversation",
          "  /help        — show this help",
          "",
          "Type any text and press Enter to chat with AI.",
        ].join("\n"),
      }])
      return
    }

    setMessages((p) => [...p, { role: "assistant", content: `Unknown command: ${name}. Type /help` }])
  }

  useKeyboard((evt) => {
    if (evt.name === "return" && !evt.shift) {
      const text = inputBuf().trim()
      if (!text) return
      setInputBuf("")
      if (text.startsWith("/")) {
        handleCommand(text)
      } else {
        send(text)
      }
      evt.preventDefault()
      return
    }

    if (evt.name === "backspace") {
      setInputBuf((s) => s.slice(0, -1))
      evt.preventDefault()
      return
    }

    if (evt.sequence && evt.sequence.length === 1 && !evt.ctrl && !evt.meta) {
      setInputBuf((s) => s + evt.sequence)
      evt.preventDefault()
      return
    }

    if (evt.name === "space") {
      setInputBuf((s) => s + " ")
      evt.preventDefault()
      return
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0} flexDirection="row" gap={1}>
        <text fg={theme.colors.primary}>
          <span style={{ bold: true }}>AI Chat</span>
        </text>
        <text fg={theme.colors.textMuted}>{modelName()}</text>
        <box flexGrow={1} />
        <text fg={theme.colors.textMuted}>esc:back · /help · /model · /clear</text>
      </box>

      {/* Messages */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} flexGrow={1}>
        <For each={messages()}>
          {(msg) => (
            <box flexDirection="row" paddingBottom={1}>
              <text fg={msg.role === "user" ? theme.colors.primary : theme.colors.success}>
                <span style={{ bold: true }}>{msg.role === "user" ? "❯ " : "◆ "}</span>
              </text>
              <text fg={theme.colors.text}>{msg.content}</text>
            </box>
          )}
        </For>

        <Show when={streaming()}>
          <box flexDirection="row" paddingBottom={1}>
            <text fg={theme.colors.success}>
              <span style={{ bold: true }}>{"◆ "}</span>
            </text>
            <text fg={theme.colors.textMuted}>{streamText() || "thinking..."}</text>
          </box>
        </Show>
      </box>

      {/* Input */}
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} flexShrink={0} flexDirection="row">
        <text fg={theme.colors.primary}>
          <span style={{ bold: true }}>{"❯ "}</span>
        </text>
        <text fg={theme.colors.input}>{inputBuf()}</text>
        <text fg={theme.colors.cursor}>{"█"}</text>
      </box>
    </box>
  )
}
