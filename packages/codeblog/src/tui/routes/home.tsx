import { createSignal, createMemo, createEffect, onCleanup, onMount, untrack, Show, For } from "solid-js"
import { useKeyboard, usePaste } from "@opentui/solid"
import { SyntaxStyle, type ThemeTokenStyle } from "@opentui/core"
import { useExit } from "../context/exit"
import { useTheme, type ThemeColors } from "../context/theme"
import { createCommands, LOGO, TIPS, TIPS_NO_AI } from "../commands"
import { TOOL_LABELS } from "../../ai/tools"
import { mask, saveProvider } from "../../ai/configure"
import { ChatHistory } from "../../storage/chat"
import { TuiStreamAssembler } from "../stream-assembler"
import { resolveAssistantContent } from "../ai-stream"
import { isShiftEnterSequence, onInputIntent } from "../input-intent"
import { Log } from "../../util/log"

function buildMarkdownSyntaxRules(colors: ThemeColors): ThemeTokenStyle[] {
  return [
    { scope: ["default"], style: { foreground: colors.text } },
    { scope: ["spell", "nospell"], style: { foreground: colors.text } },
    { scope: ["conceal"], style: { foreground: colors.textMuted } },
    { scope: ["markup.heading", "markup.heading.1", "markup.heading.2", "markup.heading.3", "markup.heading.4", "markup.heading.5", "markup.heading.6"], style: { foreground: colors.primary, bold: true } },
    { scope: ["markup.bold", "markup.strong"], style: { foreground: colors.text, bold: true } },
    { scope: ["markup.italic"], style: { foreground: colors.text, italic: true } },
    { scope: ["markup.list"], style: { foreground: colors.text } },
    { scope: ["markup.quote"], style: { foreground: colors.textMuted, italic: true } },
    { scope: ["markup.raw", "markup.raw.block", "markup.raw.inline"], style: { foreground: colors.accent } },
    { scope: ["markup.link", "markup.link.url"], style: { foreground: colors.primary, underline: true } },
    { scope: ["markup.link.label"], style: { foreground: colors.primary, underline: true } },
    { scope: ["label"], style: { foreground: colors.primary } },
    { scope: ["comment"], style: { foreground: colors.textMuted, italic: true } },
    { scope: ["string", "symbol"], style: { foreground: colors.success } },
    { scope: ["number", "boolean"], style: { foreground: colors.accent } },
    { scope: ["keyword"], style: { foreground: colors.primary, italic: true } },
    { scope: ["keyword.function", "function.method", "function", "constructor", "variable.member"], style: { foreground: colors.primary } },
    { scope: ["variable", "variable.parameter", "property", "parameter"], style: { foreground: colors.text } },
    { scope: ["type", "module", "class"], style: { foreground: colors.warning } },
    { scope: ["operator", "keyword.operator", "punctuation.delimiter"], style: { foreground: colors.textMuted } },
    { scope: ["punctuation", "punctuation.bracket"], style: { foreground: colors.textMuted } },
  ]
}

interface ChatMsg {
  role: "user" | "assistant" | "tool" | "system"
  content: string
  modelContent?: string
  tone?: "info" | "success" | "warning" | "error"
  toolName?: string
  toolCallID?: string
  toolStatus?: "running" | "done" | "error"
}

interface ModelOption {
  id: string
  label: string
}

export function Home(props: {
  loggedIn: boolean
  username: string
  activeAgent: string
  agentCount: number
  hasAI: boolean
  aiProvider: string
  modelName: string
  onLogin: () => Promise<{ ok: boolean; error?: string }>
  onLogout: () => void
  onAIConfigured: () => void
}) {
  const exit = useExit()
  const theme = useTheme()
  const [input, setInput] = createSignal("")
  const [selectedIdx, setSelectedIdx] = createSignal(0)

  const [messages, setMessages] = createSignal<ChatMsg[]>([])
  const [streaming, setStreaming] = createSignal(false)
  const [streamText, setStreamText] = createSignal("")
  let abortCtrl: AbortController | undefined
  let abortByUser = false
  let shiftDown = false
  let commandDisplay = ""
  let sessionId = ""
  const chatting = createMemo(() => messages().length > 0 || streaming())
  const renderRows = createMemo<Array<ChatMsg | { role: "stream" }>>(() => {
    const rows = messages()
    if (!streaming()) return rows
    return [...rows, { role: "stream" as const }]
  })
  const syntaxStyle = createMemo(() => SyntaxStyle.fromTheme(buildMarkdownSyntaxRules(theme.colors)))

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
        const latest = sessions[0]
        if (!latest) { showMsg("No previous sessions", theme.colors.warning); return }
        sid = latest.id
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
  const [modelPicking, setModelPicking] = createSignal(false)
  const [modelOptions, setModelOptions] = createSignal<ModelOption[]>([])
  const [modelIdx, setModelIdx] = createSignal(0)
  const [modelQuery, setModelQuery] = createSignal("")
  const [modelLoading, setModelLoading] = createSignal(false)
  let modelPreload: Promise<ModelOption[]> | undefined
  const keyLog = process.env.CODEBLOG_DEBUG_KEYS === "1" ? Log.create({ service: "tui-key" }) : undefined
  const toHex = (value: string) => Array.from(value).map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0")).join(" ")
  const chars = (evt: { sequence: string; name: string; ctrl: boolean; meta: boolean }) => {
    if (evt.ctrl || evt.meta) return ""
    const seq = (evt.sequence || "").replace(/[\x00-\x1f\x7f]/g, "")
    if (seq) return seq
    if (evt.name.length === 1) return evt.name
    return ""
  }

  function tone(color: string): ChatMsg["tone"] {
    if (color === theme.colors.success) return "success"
    if (color === theme.colors.warning) return "warning"
    if (color === theme.colors.error) return "error"
    return "info"
  }

  function showMsg(text: string, color = "#6a737c") {
    ensureSession()
    setMessages((p) => [...p, { role: "system", content: text, tone: tone(color) }])
  }

  function clearChat() {
    abortByUser = true
    abortCtrl?.abort()
    abortCtrl = undefined
    setMessages([])
    setStreamText("")
    setStreaming(false)
    setInput("")
    setSelectedIdx(0)
    setModelPicking(false)
    setModelOptions([])
    setModelIdx(0)
    setModelQuery("")
    sessionId = ""
  }

  async function loadModelOptions(force = false): Promise<ModelOption[]> {
    if (!props.hasAI) return []
    const cached = untrack(() => modelOptions())
    if (!force && cached.length > 0) return cached
    if (modelPreload) return modelPreload

    modelPreload = (async () => {
      try {
        setModelLoading(true)
        const { AIProvider } = await import("../../ai/provider")
        const { Config } = await import("../../config")
        const { resolveModelFromConfig } = await import("../../ai/models")
        const cfg = await Config.load()
        const current = resolveModelFromConfig(cfg) || AIProvider.DEFAULT_MODEL
        const currentBuiltin = AIProvider.BUILTIN_MODELS[current]
        const currentProvider =
          cfg.default_provider ||
          (current.includes("/") ? current.split("/")[0] : currentBuiltin?.providerID) ||
          "openai"
        const providerCfg = cfg.providers?.[currentProvider]
        const providerApi = providerCfg?.api || providerCfg?.compat_profile || (currentProvider === "openai" ? "openai" : "openai-compatible")
        const providerKey = providerCfg?.api_key
        const providerBase = providerCfg?.base_url || (currentProvider === "openai" ? "https://api.openai.com" : "")

        const remote = await (async () => {
          if (!providerKey || !providerBase) return [] as string[]
          if (providerApi !== "openai" && providerApi !== "openai-compatible") return [] as string[]
          try {
            const clean = providerBase.replace(/\/+$/, "")
            const url = clean.endsWith("/v1") ? `${clean}/models` : `${clean}/v1/models`
            const r = await fetch(url, {
              headers: { Authorization: `Bearer ${providerKey}` },
              signal: AbortSignal.timeout(8000),
            })
            if (!r.ok) return []
            const data = await r.json() as { data?: Array<{ id: string }> }
            return data.data?.map((m) => m.id).filter(Boolean) || []
          } catch {
            return []
          }
        })()

        const fromRemote = remote.map((id) => {
          const saveId = currentProvider === "openai-compatible" && !id.includes("/") ? `openai-compatible/${id}` : id
          return { id: saveId, label: `${saveId}  [${currentProvider}]` }
        })
        const list = await AIProvider.available()
        const fromAvailable = list
          .filter((m) => m.hasKey)
          .map((m) => {
            const id = m.model.providerID === "openai-compatible" ? `openai-compatible/${m.model.id}` : m.model.id
            const provider = m.model.providerID
            return { id, label: `${id}${provider ? `  [${provider}]` : ""}` }
          })
        const unique = Array.from(new Map([...fromRemote, ...fromAvailable].map((m) => [m.id, m])).values())
        setModelOptions(unique)
        return unique
      } finally {
        setModelLoading(false)
      }
    })()

    const out = await modelPreload
    modelPreload = undefined
    return out
  }

  async function openModelPicker() {
    if (!props.hasAI) {
      showMsg("/model requires AI. Type /ai to configure.", theme.colors.warning)
      return
    }
    setModelQuery("")
    setModelPicking(true)
    const cached = modelOptions()
    if (cached.length === 0) await loadModelOptions(true)
    else void loadModelOptions(true)

    const current = props.modelName
    const next = modelOptions()
    if (next.length === 0) {
      setModelPicking(false)
      showMsg("No available models. Configure provider with /ai first.", theme.colors.warning)
      return
    }
    setModelIdx(Math.max(0, next.findIndex((m) => m.id === current)))
    showMsg("Model picker: use ↑/↓ then Enter (Esc to cancel), type to search", theme.colors.textMuted)
  }

  async function pickModel(id: string) {
    try {
      const { Config } = await import("../../config")
      await Config.save({ model: id })
      props.onAIConfigured()
      showMsg(`Set model to ${id}`, theme.colors.success)
    } catch (err) {
      showMsg(`Failed to switch model: ${err instanceof Error ? err.message : String(err)}`, theme.colors.error)
    } finally {
      setModelPicking(false)
      setModelIdx(0)
      setModelQuery("")
      void loadModelOptions(true)
    }
  }

  onMount(() => {
    if (!props.hasAI) return
    void loadModelOptions(true)
  })

  createEffect(() => {
    if (!props.hasAI) {
      setModelOptions([])
      return
    }
    props.modelName
    void loadModelOptions(false)
  })

  const commands = createCommands({
    showMsg,
    openModelPicker,
    exit,
    onLogin: props.onLogin,
    onLogout: props.onLogout,
    clearChat,
    startAIConfig: () => {
      setAiUrl(""); setAiKey(""); setAiMode("url")
      showMsg("Quick setup: paste API URL (or press Enter to skip). Full wizard: `codeblog ai setup`", theme.colors.primary)
    },
    setMode: theme.setMode,
    send,
    onAIConfigured: props.onAIConfigured,
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
    if (modelPicking()) return false
    if (!v.startsWith("/")) return false
    if (v.includes(" ")) return false
    return filtered().length > 0
  })

  createEffect(() => {
    const len = filtered().length
    const idx = selectedIdx()
    if (len === 0 && idx !== 0) {
      setSelectedIdx(0)
      return
    }
    if (idx >= len) setSelectedIdx(len - 1)
  })

  const visibleStart = createMemo(() => {
    const len = filtered().length
    if (len <= 8) return 0
    const max = len - 8
    const idx = selectedIdx()
    return Math.max(0, Math.min(idx - 3, max))
  })

  const visibleItems = createMemo(() => {
    const start = visibleStart()
    return filtered().slice(start, start + 8)
  })

  const modelFiltered = createMemo(() => {
    const list = modelOptions()
    const query = modelQuery().trim().toLowerCase()
    if (!query) return list
    return list.filter((m) => m.id.toLowerCase().includes(query) || m.label.toLowerCase().includes(query))
  })

  const modelVisibleStart = createMemo(() => {
    const len = modelFiltered().length
    if (len <= 8) return 0
    const max = len - 8
    const idx = modelIdx()
    return Math.max(0, Math.min(idx - 3, max))
  })

  const modelVisibleItems = createMemo(() => {
    const start = modelVisibleStart()
    return modelFiltered().slice(start, start + 8)
  })

  createEffect(() => {
    const len = modelFiltered().length
    const idx = modelIdx()
    if (len === 0 && idx !== 0) {
      setModelIdx(0)
      return
    }
    if (idx >= len) setModelIdx(len - 1)
  })

  const offInputIntent = onInputIntent((intent) => {
    if (intent !== "newline" || aiMode()) return
    setInput((s) => s + "\n")
    setSelectedIdx(0)
  })
  onCleanup(() => offInputIntent())

  usePaste((evt) => {
    // For URL/key modes, strip newlines; for normal input, preserve them
    if (aiMode() === "url" || aiMode() === "key") {
      const text = evt.text.replace(/[\n\r]/g, "").trim()
      if (!text) return
      evt.preventDefault()
      if (aiMode() === "url") { setAiUrl(text); return }
      setAiKey(text)
      return
    }
    const text = evt.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    if (!text) return
    evt.preventDefault()
    setInput((s) => s + text)
  })

  async function send(text: string, options?: { display?: string }) {
    if (!text.trim() || streaming()) return
    ensureSession()
    const prompt = text.trim()
    const userMsg: ChatMsg = { role: "user", content: options?.display || commandDisplay || prompt, modelContent: prompt }
    const prev = messages()
    setMessages([...prev, userMsg])
    setStreaming(true)
    setStreamText("")
    abortByUser = false
    const assembler = new TuiStreamAssembler()
    const toolResults: Array<{ name: string; result: string }> = []
    const flushMs = 60
    let flushTimer: ReturnType<typeof setTimeout> | undefined

    const flushStream = (force = false) => {
      if (force) {
        if (flushTimer) clearTimeout(flushTimer)
        flushTimer = undefined
        setStreamText(assembler.getText())
        return
      }
      if (flushTimer) return
      flushTimer = setTimeout(() => {
        flushTimer = undefined
        setStreamText(assembler.getText())
      }, flushMs)
    }

    try {
      const { AIChat } = await import("../../ai/chat")
      const { AIProvider } = await import("../../ai/provider")
      const { Config } = await import("../../config")
      const { resolveModelFromConfig } = await import("../../ai/models")
      const cfg = await Config.load()
      const mid = resolveModelFromConfig(cfg) || AIProvider.DEFAULT_MODEL
      const allMsgs = [...prev, userMsg]
        .filter((m): m is ChatMsg & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.modelContent || m.content }))
      abortCtrl = new AbortController()

      let hasToolCalls = false
      let finalizedText = ""
      for await (const event of AIChat.streamEvents(allMsgs, mid, abortCtrl.signal, { maxSteps: 10 })) {
        if (event.type === "text-delta") {
          assembler.pushDelta(event.text, event.seq)
          flushStream()
          continue
        }

        if (event.type === "tool-start") {
          hasToolCalls = true
          const partial = assembler.getText().trim()
          if (partial) {
            setMessages((p) => [...p, { role: "assistant", content: partial }])
            assembler.reset()
            setStreamText("")
          }
          setMessages((p) => [...p, { role: "tool", content: TOOL_LABELS[event.name] || event.name, toolName: event.name, toolCallID: event.callID, toolStatus: "running" }])
          continue
        }

        if (event.type === "tool-result") {
          try {
            const str = typeof event.result === "string" ? event.result : JSON.stringify(event.result)
            toolResults.push({ name: event.name, result: str.slice(0, 1200) })
          } catch {}
          setMessages((p) => {
            let matched = false
            const next = p.map((m) => {
              if (m.role !== "tool" || m.toolStatus !== "running") return m
              if (m.toolCallID !== event.callID) return m
              matched = true
              return { ...m, toolStatus: "done" as const }
            })
            if (matched) return next
            return p.map((m) =>
              m.role === "tool" && m.toolName === event.name && m.toolStatus === "running"
                ? { ...m, toolStatus: "done" as const }
                : m
            )
          })
          continue
        }

        if (event.type === "error") {
          setMessages((p) => {
            const updated = p.map((m) =>
              m.role === "tool" && m.toolStatus === "running"
                ? { ...m, toolStatus: "error" as const }
                : m
            )
            return [...updated, { role: "assistant" as const, content: `Error: ${event.error.message}` }]
          })
          continue
        }

        if (event.type === "run-finish") {
          finalizedText = assembler.pushFinal(event.text).trim()
          flushStream(true)
          const content = resolveAssistantContent({
            finalText: finalizedText,
            aborted: event.aborted,
            abortByUser,
            hasToolCalls,
            toolResults,
          })
          if (content) setMessages((p) => [...p, { role: "assistant", content }])
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((p) => [...p, { role: "assistant", content: `Error: ${msg}` }])
    } finally {
      if (flushTimer) clearTimeout(flushTimer)
      abortCtrl = undefined
      setStreamText("")
      setStreaming(false)
      saveChat()
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
        commandDisplay = sel.name
        try {
          await sel.action(sel.name.split(/\s+/))
        } finally {
          commandDisplay = ""
        }
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
        commandDisplay = text
        try {
          await match.action(parts)
        } finally {
          commandDisplay = ""
        }
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

    send(text, { display: text })
  }

  useKeyboard((evt) => {
    if (evt.name === "leftshift" || evt.name === "rightshift" || evt.name === "shift") {
      shiftDown = evt.eventType !== "release"
      evt.preventDefault()
      return
    }
    if (evt.eventType === "release") return

    const submitKey = evt.name === "return" || evt.name === "enter"
    const raw = evt.raw || ""
    const seq = evt.sequence || ""
    const rawReturn = raw === "\r" || seq === "\r" || raw.endsWith("\r") || seq.endsWith("\r")
    const submitFromRawOnly = !submitKey && rawReturn
    if (keyLog && (submitKey || evt.name === "linefeed" || evt.name === "" || evt.name === "leftshift" || evt.name === "rightshift" || evt.name === "shift")) {
      keyLog.info("submit-key", {
        name: evt.name,
        eventType: evt.eventType,
        shift: evt.shift,
        ctrl: evt.ctrl,
        meta: evt.meta,
        source: evt.source,
        raw,
        sequence: seq,
        rawHex: toHex(raw),
        sequenceHex: toHex(seq),
      })
    }
    const shiftFromRaw = isShiftEnterSequence(raw) || isShiftEnterSequence(seq) || raw.includes(";2u") || seq.includes(";2u")
    const shift = evt.shift || shiftDown || shiftFromRaw
    const newlineFromRaw = raw === "\n" || seq === "\n" || raw === "\r\n" || seq === "\r\n"
    const modifiedSubmitFromRaw =
      (submitKey && raw.startsWith("\x1b[") && raw.endsWith("~")) ||
      (submitKey && seq.startsWith("\x1b[") && seq.endsWith("~")) ||
      (submitKey && raw.includes(";13")) ||
      (submitKey && seq.includes(";13"))
    const print = chars(evt)
    const newlineKey =
      evt.name === "linefeed" ||
      newlineFromRaw ||
      isShiftEnterSequence(raw) ||
      isShiftEnterSequence(seq) ||
      (submitFromRawOnly && (shiftDown || raw.startsWith("\x1b") || seq.startsWith("\x1b")) && !evt.ctrl) ||
      (modifiedSubmitFromRaw && !evt.ctrl) ||
      (submitKey && shift && !evt.ctrl && !evt.meta) ||
      (submitKey && evt.meta && !evt.ctrl) ||
      (evt.name === "j" && evt.ctrl && !evt.meta)

    if (aiMode() === "url") {
      if (submitKey || newlineKey) { handleSubmit(); evt.preventDefault(); return }
      if (evt.name === "escape") { setAiMode(""); evt.preventDefault(); return }
      if (evt.name === "backspace") { setAiUrl((s) => s.slice(0, -1)); evt.preventDefault(); return }
      if (print === " " || evt.name === "space") { evt.preventDefault(); return }
      if (print) { setAiUrl((s) => s + print); evt.preventDefault(); return }
      return
    }
    if (aiMode() === "key") {
      if (submitKey || newlineKey) { handleSubmit(); evt.preventDefault(); return }
      if (evt.name === "escape") { setAiMode("url"); setAiKey(""); showMsg("Paste your API URL (or press Enter to skip):", theme.colors.primary); evt.preventDefault(); return }
      if (evt.name === "backspace") { setAiKey((s) => s.slice(0, -1)); evt.preventDefault(); return }
      if (print) { setAiKey((s) => s + print); evt.preventDefault(); return }
      if (evt.name === "space") { setAiKey((s) => s + " "); evt.preventDefault(); return }
      return
    }

    if (modelPicking()) {
      if (evt.name === "up" || evt.name === "k") {
        const len = modelFiltered().length
        if (len > 0) setModelIdx((i) => (i - 1 + len) % len)
        evt.preventDefault()
        return
      }
      if (evt.name === "down" || evt.name === "j") {
        const len = modelFiltered().length
        if (len > 0) setModelIdx((i) => (i + 1) % len)
        evt.preventDefault()
        return
      }
      if (submitKey || evt.name === "enter") {
        const selected = modelFiltered()[modelIdx()]
        if (selected) void pickModel(selected.id)
        evt.preventDefault()
        return
      }
      if (evt.name === "backspace") {
        setModelQuery((q) => q.slice(0, -1))
        setModelIdx(0)
        evt.preventDefault()
        return
      }
      if (evt.name === "escape") {
        if (modelQuery()) {
          setModelQuery("")
          setModelIdx(0)
          evt.preventDefault()
          return
        }
        setModelPicking(false)
        setModelIdx(0)
        setModelQuery("")
        showMsg("Model switch canceled", theme.colors.textMuted)
        evt.preventDefault()
        return
      }
      if (print) { setModelQuery((q) => q + print); setModelIdx(0); evt.preventDefault(); return }
      if (evt.name === "space") {
        setModelQuery((q) => q + " ")
        setModelIdx(0)
        evt.preventDefault()
        return
      }
      return
    }

    if (showAutocomplete()) {
      if (evt.name === "up" || evt.name === "down") {
        const len = filtered().length
        if (len === 0) { evt.preventDefault(); return }
        if (evt.name === "up") setSelectedIdx((i) => (i - 1 + len) % len)
        else setSelectedIdx((i) => (i + 1) % len)
        evt.preventDefault()
        return
      }
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
      abortByUser = true
      abortCtrl?.abort()
      evt.preventDefault(); return
    }
    if (evt.name === "escape" && chatting() && !streaming()) { clearChat(); evt.preventDefault(); return }

    if (submitKey && !shift && !evt.ctrl && !evt.meta && !modifiedSubmitFromRaw) { handleSubmit(); evt.preventDefault(); return }
    if (newlineKey) { setInput((s) => s + "\n"); evt.preventDefault(); return }
    if (evt.name === "backspace") { setInput((s) => s.slice(0, -1)); setSelectedIdx(0); evt.preventDefault(); return }
    if (print) { setInput((s) => s + print); setSelectedIdx(0); evt.preventDefault(); return }
    if (evt.name === "space") { setInput((s) => s + " "); evt.preventDefault(); return }
  }, { release: true })

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
      <scrollbox
        flexGrow={1}
        paddingTop={1}
        stickyScroll={true}
        stickyStart="bottom"
        verticalScrollbarOptions={{ visible: false }}
        horizontalScrollbarOptions={{ visible: false }}
      >
        <Show when={!chatting()}>
          <box flexGrow={1} minHeight={0} />
        </Show>

        <box flexShrink={0} flexDirection="column" alignItems="center">
          {LOGO.map((line, i) => (
            <text fg={i < 4 ? theme.colors.logo1 : theme.colors.logo2}>{line}</text>
          ))}
          <box height={1} />
          <text fg={theme.colors.textMuted}>The AI-powered coding forum</text>

          <box height={1} />
          <box flexDirection="column" alignItems="center" gap={0}>
            <box flexDirection="row" gap={1}>
              <text fg={props.hasAI ? theme.colors.success : theme.colors.warning}>
                {props.hasAI ? "●" : "○"}
              </text>
              <text fg={theme.colors.text}>
                {props.hasAI ? props.modelName : "No AI"}
              </text>
              <Show when={!props.hasAI}>
                <text fg={theme.colors.textMuted}> — type /ai</text>
              </Show>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={props.loggedIn ? theme.colors.success : theme.colors.warning}>
                {props.loggedIn ? "●" : "○"}
              </text>
              <text fg={theme.colors.text}>
                {props.loggedIn ? props.username : "Not logged in"}
              </text>
              <Show when={props.loggedIn && props.activeAgent}>
                <text fg={theme.colors.textMuted}> / {props.activeAgent}{props.agentCount > 1 ? ` (${props.agentCount} agents)` : ""}</text>
              </Show>
              <Show when={!props.loggedIn}>
                <text fg={theme.colors.textMuted}> — type /login</text>
              </Show>
            </box>
          </box>

          <Show when={props.loggedIn}>
            <box flexDirection="row" paddingTop={1}>
              <text fg={theme.colors.warning} flexShrink={0}>● Tip </text>
              <text fg={theme.colors.textMuted}>{tipPool()[tipIdx % tipPool().length]}</text>
            </box>
          </Show>
        </box>

        <For each={renderRows()}>
          {(row) => {
            if (row.role === "stream") {
              return (
                <box flexShrink={0} paddingBottom={1}>
                  <Show when={streamText()}>
                    <code
                      filetype="markdown"
                      drawUnstyledText={false}
                      streaming={true}
                      syntaxStyle={syntaxStyle()}
                      content={streamText()}
                      conceal={true}
                      fg={theme.colors.text}
                    />
                  </Show>
                  <Show when={!streamText()}>
                    <text fg={theme.colors.textMuted} wrapMode="word">
                      {"◆ " + shimmerText()}
                    </text>
                  </Show>
                </box>
              )
            }
            const msg = row
            return (
              <box flexShrink={0}>
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
                <Show when={msg.role === "assistant"}>
                  <box paddingBottom={1} flexShrink={0}>
                    <code
                      filetype="markdown"
                      drawUnstyledText={false}
                      syntaxStyle={syntaxStyle()}
                      content={msg.content}
                      conceal={true}
                      fg={theme.colors.text}
                    />
                  </box>
                </Show>
                <Show when={msg.role === "system"}>
                  <box flexDirection="row" paddingLeft={2} paddingBottom={1}>
                    <text
                      fg={
                        msg.tone === "success"
                          ? theme.colors.success
                          : msg.tone === "warning"
                            ? theme.colors.warning
                            : msg.tone === "error"
                              ? theme.colors.error
                              : theme.colors.textMuted
                      }
                      flexShrink={0}
                    >
                      {"└ "}
                    </text>
                    <text
                      fg={
                        msg.tone === "success"
                          ? theme.colors.success
                          : msg.tone === "warning"
                            ? theme.colors.warning
                            : msg.tone === "error"
                              ? theme.colors.error
                              : theme.colors.textMuted
                      }
                      wrapMode="word"
                      flexGrow={1}
                      flexShrink={1}
                    >
                      {msg.content}
                    </text>
                  </box>
                </Show>
              </box>
            )
          }}
        </For>

        <Show when={!chatting()}>
          <box flexGrow={1} minHeight={0} />
        </Show>
      </scrollbox>

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
            <Show when={modelPicking()}>
              <box flexDirection="column" paddingBottom={1}>
                <text fg={theme.colors.textMuted}>{"  /model — choose with ↑/↓, Enter to confirm, Esc to cancel"}</text>
                <box flexDirection="row">
                  <text fg={theme.colors.textMuted}>{"  search: "}</text>
                  <text fg={theme.colors.input}>{modelQuery()}</text>
                  <text fg={theme.colors.cursor}>{"█"}</text>
                </box>
                <Show when={modelLoading()}>
                  <text fg={theme.colors.textMuted}>{"  Loading models..."}</text>
                </Show>
                <Show when={modelVisibleStart() > 0}>
                  <text fg={theme.colors.textMuted}>{"  ↑ more models"}</text>
                </Show>
                <For each={modelVisibleItems()}>
                  {(option, i) => {
                    const selected = () => i() + modelVisibleStart() === modelIdx()
                    const current = () => option.id === props.modelName
                    return (
                      <box flexDirection="row" backgroundColor={selected() ? theme.colors.primary : undefined}>
                        <text fg={selected() ? "#ffffff" : theme.colors.text}>
                          {"  " + (selected() ? "● " : "○ ") + option.label + (current() ? "  (current)" : "")}
                        </text>
                      </box>
                    )
                  }}
                </For>
                <Show when={modelFiltered().length === 0 && !modelLoading()}>
                  <text fg={theme.colors.warning}>{"  No matched models"}</text>
                </Show>
                <Show when={modelVisibleStart() + modelVisibleItems().length < modelFiltered().length}>
                  <text fg={theme.colors.textMuted}>{"  ↓ more models"}</text>
                </Show>
              </box>
            </Show>
            {/* Command autocomplete — above prompt */}
            <Show when={showAutocomplete()}>
              <box flexDirection="column" paddingBottom={1}>
                <Show when={visibleStart() > 0}>
                  <text fg={theme.colors.textMuted}>{"  ↑ more commands"}</text>
                </Show>
                <For each={visibleItems()}>
                  {(cmd, i) => {
                    const disabled = () => cmd.needsAI && !props.hasAI
                    const selected = () => i() + visibleStart() === selectedIdx()
                    return (
                      <box flexDirection="row" backgroundColor={selected() ? theme.colors.primary : undefined}>
                        <text fg={selected() ? "#ffffff" : (disabled() ? theme.colors.textMuted : theme.colors.primary)}>
                          {"  " + cmd.name.padEnd(18)}
                        </text>
                        <text fg={selected() ? "#ffffff" : theme.colors.textMuted}>
                          {disabled() ? cmd.description + " [needs /ai]" : cmd.description}
                        </text>
                      </box>
                    )
                  }}
                </For>
                <Show when={visibleStart() + visibleItems().length < filtered().length}>
                  <text fg={theme.colors.textMuted}>{"  ↓ more commands"}</text>
                </Show>
              </box>
            </Show>
            {/* Input line with blinking cursor */}
            <box flexDirection="column">
              {(() => {
                const lines = input().split("\n")
                return lines.map((line, i) => (
                  <box flexDirection="row">
                    <text fg={theme.colors.primary}><span style={{ bold: true }}>{i === 0 ? "❯ " : "  "}</span></text>
                    <text fg={theme.colors.input}>{line}</text>
                    {i === lines.length - 1 && <text fg={theme.colors.cursor}><span style={{ bold: true }}>{"█"}</span></text>}
                  </box>
                ))
              })()}
            </box>
          </box>
        </Show>
      </box>
    </box>
  )
}
