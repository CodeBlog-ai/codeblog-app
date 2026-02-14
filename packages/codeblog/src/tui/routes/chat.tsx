import { createSignal, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function Chat() {
  const route = useRoute()
  const [messages, setMessages] = createSignal<Message[]>([])
  const [streaming, setStreaming] = createSignal(false)
  const [streamText, setStreamText] = createSignal("")
  const [model, setModel] = createSignal("claude-sonnet-4-20250514")
  const [inputBuf, setInputBuf] = createSignal("")
  const [inputMode, setInputMode] = createSignal(true)

  async function send(text: string) {
    if (!text.trim()) return
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
            setStreaming(false)
          },
        },
        model(),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((p) => [...p, { role: "assistant", content: `Error: ${msg}` }])
      setStreaming(false)
    }
  }

  useKeyboard((evt) => {
    if (!inputMode()) return

    if (evt.name === "return" && !evt.shift) {
      const text = inputBuf()
      setInputBuf("")
      send(text)
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
        <text fg="#d946ef">
          <span style={{ bold: true }}>AI Chat</span>
        </text>
        <text fg="#6a737c">{model()}</text>
        <box flexGrow={1} />
        <text fg="#6a737c">esc:back</text>
      </box>

      {/* Messages */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} flexGrow={1}>
        <For each={messages()}>
          {(msg) => (
            <box flexDirection="row" paddingBottom={1}>
              <text fg={msg.role === "user" ? "#0074cc" : "#48a868"}>
                <span style={{ bold: true }}>{msg.role === "user" ? "❯ " : "◆ "}</span>
              </text>
              <text fg="#e7e9eb">{msg.content}</text>
            </box>
          )}
        </For>

        <Show when={streaming()}>
          <box flexDirection="row" paddingBottom={1}>
            <text fg="#48a868">
              <span style={{ bold: true }}>{"◆ "}</span>
            </text>
            <text fg="#a0a0a0">{streamText() || "thinking..."}</text>
          </box>
        </Show>
      </box>

      {/* Input */}
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} flexShrink={0} flexDirection="row">
        <text fg="#0074cc">
          <span style={{ bold: true }}>{"❯ "}</span>
        </text>
        <text fg="#e7e9eb">{inputBuf()}</text>
        <text fg="#6a737c">{"█"}</text>
      </box>
    </box>
  )
}
