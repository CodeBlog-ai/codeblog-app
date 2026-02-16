import { createSignal, createMemo, createEffect, onCleanup, Show, For } from "solid-js"
import { useKeyboard, usePaste } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useExit } from "../context/exit"
import { useTheme } from "../context/theme"
import { createCommands, LOGO, TIPS, TIPS_NO_AI } from "../commands"
import { TOOL_LABELS } from "../../ai/tools"
import { mask, saveProvider } from "../../ai/configure"
import { ChatHistory } from "../../storage/chat"

interface ChatMsg {
  role: "user" | "assistant" | "tool"
  content: string
  toolName?: string
  toolStatus?: "running" | "done" | "error"
}

export function Home(props: {
  loggedIn: boolean
  username: string
  hasAI: boolean
  aiProvider: string
  modelName: string
  onLogin: () => Promise<void>
  onLogout: () => void
  onAIConfigured: () => void
}) {
  const route = useRoute()
  const exit = useExit()
  const theme = useTheme()
  const [input, setInput] = createSignal("")
  const [message, setMessage] = createSignal("")
  const [messageColor, setMessageColor] = createSignal("#6a737c")
  const [selectedIdx, setSelectedIdx] = createSignal(0)

  const [messages, setMessages] = createSignal<ChatMsg[]>([])
  const [streaming, setStreaming] = createSignal(false)
  const [streamText, setStreamText] = createSignal("")
  let abortCtrl: AbortController | undefined
  let escCooldown = 0
  let sessionId = ""
  const chatting = createMemo(() => messages().length > 0 || streaming())

  function ensureSession() {
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      try { ChatHistory.create(sessionId) } catch {}
    }
  }

  function saveChat() {
    if (!sessionId) return
    try { ChatHistory.save(sessionId, messages()) } catch {}
  }

  function resumeSession(sid?: string) {
    try {
      if (!sid) {
        const sessions = ChatHistory.list(1)
        if (sessions.length === 0) { showMsg("No previous sessions", theme.colors.warning); return }
        sid = sessions[0].id
      }
      const msgs = ChatHistory.load(sid)
      if (msgs.length === 0) { showMsg("Session is empty", theme.colors.warning); return }
      sessionId = sid
      setMessages(msgs as ChatMsg[])
      showMsg("Resumed session", theme.colors.success)
    } catch { showMsg("Failed to resume", theme.colors.error) }
  }

  // Shimmer animation for thinking state (like Claude Code)
  const SHIMMER_WORDS = ["Thinking", "Reasoning", "Composing", "Reflecting", "Analyzing", "Processing"]
  const [shimmerIdx, setShimmerIdx] = createSignal(0)
  const [shimmerDots, setShimmerDots] = createSignal(0)
  createEffect(() => {
    if (!streaming()) return
    const id = setInterval(() => {
      setShimmerDots((d) => (d + 1) % 4)
      if (shimmerDots() === 0) setShimmerIdx((i) => (i + 1) % SHIMMER_WORDS.length)
    }, 500)
    onCleanup(() => clearInterval(id))
  })
  const shimmerText = () => SHIMMER_WORDS[shimmerIdx()] + ".".repeat(shimmerDots())

  const tipPool = () => props.hasAI ? TIPS : TIPS_NO_AI
  const tipIdx = Math.floor(Math.random() * TIPS.length)
  const [aiMode, setAiMode] = createSignal<"" | "url" | "key" | "testing">("")
  const [aiUrl, setAiUrl] = createSignal("")
  const [aiKey, setAiKey] = createSignal("")

  function showMsg(text: string, color = "#6a737c") {
    setMessage(text)
    setMessageColor(color)
  }

  function clearChat() {
    setMessages([]); setStreamText(""); setStreaming(false); setMessage("")
    sessionId = ""
  }

  const commands = createCommands({
    showMsg,
    navigate: route.navigate,
    exit,
    onLogin: props.onLogin,
    onLogout: props.onLogout,
    clearChat,
    startAIConfig: () => {
      setAiUrl(""); setAiKey(""); setAiMode("url")
      showMsg("Paste your API URL (or press Enter to skip):", theme.colors.primary)
    },
    setMode: theme.setMode,
    send,
    resume: resumeSession,
    listSessions: () => { try { return ChatHistory.list(10) } catch { return [] } },
    hasAI: props.hasAI,
    colors: theme.colors,
  })

  const filtered = createMemo(() => {
    const v = input()
    if (!v.startsWith("/")) return []
    const query = v.slice(1).toLowerCase()
    if (!query) return commands
    return commands.filter((c) => c.name.slice(1).toLowerCase().includes(query))
  })

  const showAutocomplete = createMemo(() => {
    const v = input()
    if (aiMode()) return false
    if (!v.startsWith("/")) return false
    if (v.includes(" ")) return false
    return filtered().length > 0
  })

  usePaste((evt) => {
    const text = evt.text.replace(/[\n\r]/g, "").trim()
    if (!text) return
    evt.preventDefault()
    if (aiMode() === "url") { setAiUrl(text); return }
    if (aiMode() === "key") { setAiKey(text); return }
    setInput((s) => s + text)
  })

  async function send(text: string) {
    if (!text.trim() || streaming()) return
    ensureSession()
    const userMsg: ChatMsg = { role: "user", content: text.trim() }
    const prev = messages()
    setMessages([...prev, userMsg])
    setStreaming(true)
    setStreamText("")
    setMessage("")

    try {
      const { AIChat } = await import("../../ai/chat")
      const { Config } = await import("../../config")
      const { AIProvider } = await import("../../ai/provider")
      const { Log } = await import("../../util/log")
      const sendLog = Log.create({ service: "home-send" })
      const cfg = await Config.load()
      const mid = cfg.model || AIProvider.DEFAULT_MODEL
      const allMsgs = [...prev, userMsg].filter((m) => m.role !== "tool").map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      let full = ""
      let hasToolCalls = false
      let lastToolName = ""
      let lastToolResult = ""
      let summaryStreamActive = false
      abortCtrl = new AbortController()
      sendLog.info("calling AIChat.stream", { model: mid, msgCount: allMsgs.length })
      await AIChat.stream(allMsgs, {
        onToken: (token) => { full += token; setStreamText(full) },
        onToolCall: (name) => {
          hasToolCalls = true
          lastToolName = name
          sendLog.info("onToolCall", { name })
          // Save any accumulated text as assistant message before tool
          if (full.trim()) {
            setMessages((p) => [...p, { role: "assistant", content: full.trim() }])
            full = ""
            setStreamText("")
          }
          setMessages((p) => [...p, { role: "tool", content: TOOL_LABELS[name] || name, toolName: name, toolStatus: "running" }])
        },
        onToolResult: (name, result) => {
          sendLog.info("onToolResult", { name })
          try {
            const str = typeof result === "string" ? result : JSON.stringify(result)
            lastToolResult = str.slice(0, 6000)
          } catch { lastToolResult = "" }
          setMessages((p) => p.map((m) =>
            m.role === "tool" && m.toolName === name && m.toolStatus === "running"
              ? { ...m, toolStatus: "done" as const }
              : m
          ))
        },
        onFinish: () => {
          sendLog.info("onFinish", { fullLength: full.length, hasToolCalls, hasToolResult: !!lastToolResult })
          if (full.trim()) {
            setMessages((p) => [...p, { role: "assistant", content: full.trim() }])
            setStreamText(""); setStreaming(false)
            saveChat()
          } else if (hasToolCalls && lastToolResult) {
            // Tool executed but model didn't summarize — send a follow-up request
            // to have the model produce a natural-language summary
            sendLog.info("auto-summarizing tool result", { tool: lastToolName })
            full = ""
            setStreamText("")
            const summaryMsgs = [
              ...allMsgs,
              { role: "assistant" as const, content: `I used the ${lastToolName} tool. Here are the results:\n${lastToolResult}` },
              { role: "user" as const, content: "Please summarize these results in a helpful, natural way." },
            ]
            // NOTE: intentionally not awaited — the outer await resolves here,
            // but streaming state is managed by the inner callbacks.
            // The finally block must NOT reset streaming in this path.
            summaryStreamActive = true
            AIChat.stream(summaryMsgs, {
              onToken: (token) => { full += token; setStreamText(full) },
              onFinish: () => {
                if (full.trim()) {
                  setMessages((p) => [...p, { role: "assistant", content: full.trim() }])
                } else {
                  setMessages((p) => [...p, { role: "assistant", content: "(Tool executed — model did not respond)" }])
                }
                setStreamText(""); setStreaming(false)
                saveChat()
              },
              onError: (err) => {
                sendLog.info("summary stream error", { message: err.message })
                setMessages((p) => [...p, { role: "assistant", content: `Tool result received but summary failed: ${err.message}` }])
                setStreamText(""); setStreaming(false)
                saveChat()
              },
            }, mid, abortCtrl?.signal)
          } else if (hasToolCalls) {
            setMessages((p) => [...p, { role: "assistant", content: "(Tool executed — no response from model)" }])
            setStreamText(""); setStreaming(false)
            saveChat()
          } else {
            setStreamText(""); setStreaming(false)
            saveChat()
          }
        },
        onError: (err) => {
          sendLog.info("onError", { message: err.message })
          setMessages((p) => {
            // Mark any running tools as error
            const updated = p.map((m) =>
              m.role === "tool" && m.toolStatus === "running"
                ? { ...m, toolStatus: "error" as const }
                : m
            )
            return [...updated, { role: "assistant" as const, content: `Error: ${err.message}` }]
          })
          setStreamText(""); setStreaming(false)
          saveChat()
        },
      }, mid, abortCtrl.signal)
      sendLog.info("AIChat.stream returned normally")
      abortCtrl = undefined
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Can't use sendLog here because it might not be in scope
      setMessages((p) => [...p, { role: "assistant", content: `Error: ${msg}` }])
      saveChat()
    } finally {
      // Clean up streaming state — but NOT if a summary stream is still running
      if (!summaryStreamActive) {
        setStreamText("")
        setStreaming(false)
      }
    }
  }

  async function saveAI() {
    setAiMode("testing")
    showMsg("Detecting API format...", theme.colors.primary)
    try {
      const result = await saveProvider(aiUrl().trim(), aiKey().trim())
      if (result.error) {
        showMsg(result.error, theme.colors.error)
        setAiMode("key")
        return
      }
      showMsg(`✓ AI configured! (${result.provider})`, theme.colors.success)
      setAiMode("")
      props.onAIConfigured()
    } catch (err) {
      showMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`, theme.colors.error)
      setAiMode("key")
    }
  }

  async function handleSubmit() {
    if (aiMode() === "url") {
      const v = aiUrl().trim()
      if (v && !v.startsWith("http")) { showMsg("URL must start with http:// or https://", theme.colors.error); return }
      setAiMode("key")
      showMsg("Now paste your API key (or press Esc to cancel):", theme.colors.primary)
      return
    }
    if (aiMode() === "key") {
      const url = aiUrl().trim()
      const key = aiKey().trim()
      // Both empty → friendly skip
      if (!url && !key) {
        showMsg("No AI configuration provided — skipped. Use /ai anytime to configure.", theme.colors.warning)
        setAiMode("")
        return
      }
      // Key empty but URL provided → friendly skip
      if (!key) {
        showMsg("No API key provided — skipped. Use /ai anytime to configure.", theme.colors.warning)
        setAiMode("")
        return
      }
      if (key.length < 5) { showMsg("API key too short", theme.colors.error); return }
      saveAI()
      return
    }

    if (showAutocomplete()) {
      const items = filtered()
      const sel = items[selectedIdx()]
      if (sel) {
        if (sel.needsAI && !props.hasAI) {
          showMsg(`${sel.name} requires AI. Type /ai to configure.`, theme.colors.warning)
          setInput("")
          setSelectedIdx(0)
          return
        }
        setInput("")
        setSelectedIdx(0)
        sel.action(sel.name.split(/\s+/))
        return
      }
    }

    const text = input().trim()
    setInput("")
    setSelectedIdx(0)
    if (!text) return

    if (text.startsWith("/")) {
      const parts = text.split(/\s+/)
      const cmd = parts[0]
      const match = commands.find((c) => c.name === cmd)
      if (match) {
        if (match.needsAI && !props.hasAI) {
          showMsg(`${cmd} requires AI. Type /ai to configure.`, theme.colors.warning)
          return
        }
        match.action(parts)
        return
      }
      if (cmd === "/quit" || cmd === "/q") { exit(); return }
      showMsg(`Unknown command: ${cmd}. Type / to see commands`, theme.colors.error)
      return
    }

    if (!props.hasAI) {
      showMsg("No AI configured. Type /ai to set up", theme.colors.error)
      return
    }

    send(text)
  }

  useKeyboard((evt) => {
    if (aiMode() === "url") {
      if (evt.name === "return") { handleSubmit(); evt.preventDefault(); return }
      if (evt.name === "escape") { setAiMode(""); setMessage(""); evt.preventDefault(); return }
      if (evt.name === "backspace") { setAiUrl((s) => s.slice(0, -1)); evt.preventDefault(); return }
      if (evt.sequence && evt.sequence.length >= 1 && !evt.ctrl && !evt.meta) {
        const clean = evt.sequence.replace(/[\x00-\x1f\x7f]/g, "")
        if (clean) { setAiUrl((s) => s + clean); evt.preventDefault(); return }
      }
      if (evt.name === "space") { evt.preventDefault(); return }
      return
    }
    if (aiMode() === "key") {
      if (evt.name === "return") { handleSubmit(); evt.preventDefault(); return }
      if (evt.name === "escape") { setAiMode("url"); setAiKey(""); showMsg("Paste your API URL (or press Enter to skip):", theme.colors.primary); evt.preventDefault(); return }
      if (evt.name === "backspace") { setAiKey((s) => s.slice(0, -1)); evt.preventDefault(); return }
      if (evt.sequence && evt.sequence.length >= 1 && !evt.ctrl && !evt.meta) {
        const clean = evt.sequence.replace(/[\x00-\x1f\x7f]/g, "")
        if (clean) { setAiKey((s) => s + clean); evt.preventDefault(); return }
      }
      if (evt.name === "space") { setAiKey((s) => s + " "); evt.preventDefault(); return }
      return
    }

    if (showAutocomplete()) {
      if (evt.name === "up") { setSelectedIdx((i) => (i - 1 + filtered().length) % filtered().length); evt.preventDefault(); return }
      if (evt.name === "down") { setSelectedIdx((i) => (i + 1) % filtered().length); evt.preventDefault(); return }
      if (evt.name === "tab") {
        const sel = filtered()[selectedIdx()]
        if (sel) setInput(sel.name + " ")
        evt.preventDefault()
        return
      }
      if (evt.name === "escape") { setInput(""); setSelectedIdx(0); evt.preventDefault(); return }
    }

    // Escape while streaming → abort; while chatting → clear
    if (evt.name === "escape" && streaming()) {
      abortCtrl?.abort()
      const cur = streamText()
      if (cur.trim()) setMessages((p) => [...p, { role: "assistant", content: cur.trim() + "\n\n(interrupted)" }])
      setStreamText(""); setStreaming(false)
      saveChat()
      evt.preventDefault(); return
    }
    if (evt.name === "escape" && chatting() && !streaming()) { clearChat(); evt.preventDefault(); return }

    if (evt.name === "return" && !evt.shift) { handleSubmit(); evt.preventDefault(); return }
    if (evt.name === "backspace") { setInput((s) => s.slice(0, -1)); setSelectedIdx(0); evt.preventDefault(); return }
    if (evt.sequence && evt.sequence.length >= 1 && !evt.ctrl && !evt.meta) {
      const clean = evt.sequence.replace(/[\x00-\x1f\x7f]/g, "")
      if (clean) { setInput((s) => s + clean); setSelectedIdx(0); evt.preventDefault(); return }
    }
    if (evt.name === "space") { setInput((s) => s + " "); evt.preventDefault(); return }
  })

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
      {/* When no chat: show logo centered */}
      <Show when={!chatting()}>
        <box flexGrow={1} minHeight={0} />
        <box flexShrink={0} flexDirection="column" alignItems="center">
          {LOGO.map((line, i) => (
            <text fg={i < 4 ? theme.colors.logo1 : theme.colors.logo2}>{line}</text>
          ))}
          <box height={1} />
          <text fg={theme.colors.textMuted}>The AI-powered coding forum</text>
        </box>
        <Show when={!props.loggedIn || !props.hasAI}>
          <box flexShrink={0} flexDirection="column" paddingTop={1} alignItems="center">
            <box flexDirection="row" gap={1}>
              <text fg={props.hasAI ? theme.colors.success : theme.colors.warning}>{props.hasAI ? "✓" : "●"}</text>
              <text fg={props.hasAI ? theme.colors.textMuted : theme.colors.text}>
                {props.hasAI ? `AI: ${props.modelName}` : "Type /ai to configure AI"}
              </text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={props.loggedIn ? theme.colors.success : theme.colors.warning}>{props.loggedIn ? "✓" : "●"}</text>
              <text fg={props.loggedIn ? theme.colors.textMuted : theme.colors.text}>
                {props.loggedIn ? `Logged in as ${props.username}` : "Type /login to sign in"}
              </text>
            </box>
          </box>
        </Show>
      </Show>

      {/* When chatting: messages fill the space */}
      <Show when={chatting()}>
        <scrollbox flexGrow={1} paddingTop={1} stickyScroll={true} stickyStart="bottom">
          <For each={messages()}>
            {(msg) => (
              <box flexShrink={0}>
                {/* User message — bold with ❯ prefix */}
                <Show when={msg.role === "user"}>
                  <box flexDirection="row" paddingBottom={1}>
                    <text fg={theme.colors.primary} flexShrink={0}>
                      <span style={{ bold: true }}>{"❯ "}</span>
                    </text>
                    <text fg={theme.colors.text} wrapMode="word" flexGrow={1} flexShrink={1}>
                      <span style={{ bold: true }}>{msg.content}</span>
                    </text>
                  </box>
                </Show>
                {/* Tool execution — ⚙/✓ icon + tool name + status */}
                <Show when={msg.role === "tool"}>
                  <box flexDirection="row" paddingLeft={2}>
                    <text fg={msg.toolStatus === "done" ? theme.colors.success : msg.toolStatus === "error" ? theme.colors.error : theme.colors.warning} flexShrink={0}>
                      {msg.toolStatus === "done" ? "  ✓ " : msg.toolStatus === "error" ? "  ✗ " : "  ⚙ "}
                    </text>
                    <text fg={theme.colors.textMuted}>
                      {msg.content}
                    </text>
                  </box>
                </Show>
                {/* Assistant message — ◆ prefix */}
                <Show when={msg.role === "assistant"}>
                  <box flexDirection="row" paddingBottom={1}>
                    <text fg={theme.colors.success} flexShrink={0}>
                      <span style={{ bold: true }}>{"◆ "}</span>
                    </text>
                    <text fg={theme.colors.text} wrapMode="word" flexGrow={1} flexShrink={1}>{msg.content}</text>
                  </box>
                </Show>
              </box>
            )}
          </For>
          <box
            flexDirection="row"
            paddingBottom={streaming() ? 1 : 0}
            flexShrink={0}
            height={streaming() ? undefined : 0}
            overflow="hidden"
          >
            <text fg={theme.colors.success} flexShrink={0}>
              <span style={{ bold: true }}>{streaming() ? "◆ " : ""}</span>
            </text>
            <text fg={streamText() ? theme.colors.text : theme.colors.textMuted} wrapMode="word" flexGrow={1} flexShrink={1}>
              {streaming() ? (streamText() || shimmerText()) : ""}
            </text>
          </box>
        </scrollbox>
      </Show>

      {/* Spacer when no chat and no autocomplete */}
      <Show when={!chatting()}>
        <box flexGrow={1} minHeight={0} />
      </Show>

      {/* Prompt — always at bottom */}
      <box flexShrink={0} paddingTop={1} paddingBottom={1}>
        <Show when={aiMode() === "url"}>
          <box flexDirection="column">
            <text fg={theme.colors.text}><span style={{ bold: true }}>API URL:</span></text>
            <box flexDirection="row">
              <text fg={theme.colors.primary}><span style={{ bold: true }}>{"❯ "}</span></text>
              <text fg={theme.colors.input}>{aiUrl()}</text>
              <text fg={theme.colors.cursor}>{"█"}</text>
            </box>
          </box>
        </Show>
        <Show when={aiMode() === "key"}>
          <box flexDirection="column">
            {aiUrl().trim() ? <text fg={theme.colors.textMuted}>{"URL: " + aiUrl().trim()}</text> : null}
            <text fg={theme.colors.text}><span style={{ bold: true }}>API Key:</span></text>
            <box flexDirection="row">
              <text fg={theme.colors.primary}><span style={{ bold: true }}>{"❯ "}</span></text>
              <text fg={theme.colors.input}>{mask(aiKey())}</text>
              <text fg={theme.colors.cursor}>{"█"}</text>
            </box>
          </box>
        </Show>
        <Show when={aiMode() === "testing"}>
          <text fg={theme.colors.primary}>Detecting API format...</text>
        </Show>
        <Show when={!aiMode()}>
          <box flexDirection="column">
            {/* Command autocomplete — above prompt */}
            <Show when={showAutocomplete()}>
              <box flexDirection="column" paddingBottom={1}>
                <For each={filtered()}>
                  {(cmd, i) => {
                    const disabled = () => cmd.needsAI && !props.hasAI
                    const selected = () => i() === selectedIdx()
                    return (
                      <box flexDirection="row" backgroundColor={selected() && !disabled() ? theme.colors.primary : undefined}>
                        <text fg={selected() && !disabled() ? "#ffffff" : (disabled() ? theme.colors.textMuted : theme.colors.primary)}>
                          {"  " + cmd.name.padEnd(18)}
                        </text>
                        <text fg={selected() && !disabled() ? "#ffffff" : theme.colors.textMuted}>
                          {disabled() ? cmd.description + " [needs /ai]" : cmd.description}
                        </text>
                      </box>
                    )
                  }}
                </For>
              </box>
            </Show>
            {/* Message feedback */}
            <Show when={message() && !showAutocomplete()}>
              <text fg={messageColor()} flexShrink={0}>{message()}</text>
            </Show>
            {/* Tip */}
            <Show when={!showAutocomplete() && !message() && !chatting() && props.loggedIn}>
              <box flexDirection="row" paddingBottom={1}>
                <text fg={theme.colors.warning} flexShrink={0}>● Tip </text>
                <text fg={theme.colors.textMuted}>{tipPool()[tipIdx % tipPool().length]}</text>
              </box>
            </Show>
            {/* Input line */}
            <box flexDirection="row">
              <text fg={theme.colors.primary}><span style={{ bold: true }}>{"❯ "}</span></text>
              <text fg={theme.colors.input}>{input()}</text>
              <text fg={theme.colors.cursor}>{"█"}</text>
            </box>
          </box>
        </Show>
      </box>
    </box>
  )
}
