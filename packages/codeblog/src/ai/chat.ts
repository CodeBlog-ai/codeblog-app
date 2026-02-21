import { streamText, stepCountIs } from "ai"
import { AIProvider } from "./provider"
import { getChatTools } from "./tools"
import { Log } from "../util/log"
import { createRunEventFactory, type StreamEvent } from "./stream-events"

const log = Log.create({ service: "ai-chat" })

const SYSTEM_PROMPT = `You are CodeBlog AI — an assistant for the CodeBlog developer forum (codeblog.ai).

You help developers with everything on the platform:
- Scan and analyze their local IDE coding sessions
- Write and publish blog posts from coding sessions
- Browse, search, read, comment, vote on forum posts
- Manage bookmarks, notifications, debates, tags, trending topics
- Manage agents, view dashboard, follow users
- Generate weekly digests

You have 20+ tools. Use them whenever the user's request matches. Chain multiple tools if needed.
After a tool returns results, summarize them naturally for the user.

CRITICAL: When using tools, ALWAYS use the EXACT data returned by previous tool calls.
- If scan_sessions returns a path like "/Users/zhaoyifei/...", use that EXACT path
- NEVER modify, guess, or infer file paths — use them exactly as returned
- If a tool call fails with "file not found", the path is wrong — check the scan results again

Write casually like a dev talking to another dev. Be specific, opinionated, and genuine.
Use code examples when relevant. Think Juejin / HN / Linux.do vibes — not a conference paper.

POSTING RULE: When publishing any post (manual, auto, or digest), ALWAYS follow this flow:

Step 1 — Generate preview:
  Call preview_post to generate a preview. The tool returns the full post content.

Step 2 — Show the COMPLETE preview to the user:
  You MUST display the ENTIRE preview exactly as returned by the tool. Do NOT summarize, shorten, or omit any part.
  Format it clearly like this:

  ---
  **Title:** [title]
  **Summary:** [summary]
  **Category:** [category] · **Tags:** [tags]
  **Language:** [language]

  ---

  [FULL article content — every paragraph, every code block, every section. Copy it ALL.]

  ---

  This is critical — the user needs to review the COMPLETE article before deciding to publish.
  Never say "includes..." or give a summary of sections. Show the actual content.

Step 3 — Ask for confirmation:
  After showing the full preview, ask the user if they want to publish, edit, or discard.

Step 4 — Handle edits:
  If the user wants changes (e.g. "change the title", "rewrite the intro", "add a section about X"):
  - Apply their changes to the content yourself
  - Call preview_post(mode='manual') with the updated title/content/tags
  - IMPORTANT: The "content" field must NOT start with the title. Title is a separate field — never repeat it as a heading or plain text at the beginning of content.
  - Show the COMPLETE updated preview again (same format as Step 2)
  - Ask for confirmation again
  - Repeat until satisfied

Step 5 — Publish:
  Only call confirm_post after the user explicitly says to publish.

If preview_post or confirm_post are not available, fall back to auto_post(dry_run=true) then auto_post(dry_run=false).
Never publish without showing a full preview first unless the user explicitly says "skip preview".

CONTENT QUALITY: When generating posts with preview_post(mode='auto'), review the generated content before showing it.
If the analysis result is too generic or off-topic, improve it — rewrite the title to be specific and catchy, ensure the content tells a real story from the session.`

const IDLE_TIMEOUT_MS = 60_000
const TOOL_TIMEOUT_MS = 45_000
const DEFAULT_MAX_STEPS = 10

export namespace AIChat {
  export interface Message {
    role: "user" | "assistant" | "system"
    content: string
  }

  export interface StreamCallbacks {
    onToken?: (token: string) => void
    onFinish?: (text: string) => void
    onError?: (error: Error) => void
    onToolCall?: (name: string, args: unknown, callID: string) => void
    onToolResult?: (name: string, result: unknown, callID: string) => void
  }

  export interface StreamOptions {
    maxSteps?: number
    runId?: string
    idleTimeoutMs?: number
    toolTimeoutMs?: number
  }

  export async function* streamEvents(
    messages: Message[],
    modelID?: string,
    signal?: AbortSignal,
    options?: StreamOptions,
  ): AsyncGenerator<StreamEvent> {
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    const routeCompat = await AIProvider.resolveModelCompat(modelID).catch(() => undefined)
    const tools = await getChatTools(routeCompat || "default")
    const model = await AIProvider.getModel(modelID)
    const maxSteps = options?.maxSteps ?? DEFAULT_MAX_STEPS
    const idleTimeoutMs = options?.idleTimeoutMs ?? IDLE_TIMEOUT_MS
    const toolTimeoutMs = options?.toolTimeoutMs ?? TOOL_TIMEOUT_MS

    const run = createRunEventFactory(options?.runId)
    let full = ""
    let aborted = false
    let externalAbort = false
    let abortError: Error | undefined
    let errorEmitted = false
    const toolQueue = new Map<string, string[]>()
    const activeTools = new Map<string, { name: string; timer?: ReturnType<typeof setTimeout> }>()

    const internalAbort = new AbortController()
    const abortRun = (error?: Error) => {
      if (aborted) return
      aborted = true
      if (error) abortError = error
      internalAbort.abort()
    }
    const onExternalAbort = () => {
      externalAbort = true
      abortRun()
    }
    signal?.addEventListener("abort", onExternalAbort)

    yield run.next("run-start", {
      modelID: modelID || AIProvider.DEFAULT_MODEL,
      messageCount: history.length,
    })

    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const clearAllToolTimers = () => {
      for (const entry of activeTools.values()) {
        if (entry.timer) clearTimeout(entry.timer)
      }
    }

    const pushToolID = (name: string, callID: string) => {
      const queue = toolQueue.get(name)
      if (!queue) {
        toolQueue.set(name, [callID])
        return
      }
      queue.push(callID)
    }

    const shiftToolID = (name: string) => {
      const queue = toolQueue.get(name)
      if (!queue || queue.length === 0) return undefined
      const callID = queue.shift()
      if (queue.length === 0) toolQueue.delete(name)
      return callID
    }

    const dropToolID = (name: string, callID: string) => {
      const queue = toolQueue.get(name)
      if (!queue || queue.length === 0) return
      const next = queue.filter((id) => id !== callID)
      if (next.length === 0) {
        toolQueue.delete(name)
        return
      }
      toolQueue.set(name, next)
    }

    const armToolTimeout = (name: string, callID: string) => {
      if (toolTimeoutMs <= 0) return
      const timer = setTimeout(() => {
        abortRun(new Error(`Tool call "${name}" timed out after ${toolTimeoutMs}ms`))
      }, toolTimeoutMs)
      const active = activeTools.get(callID)
      if (!active) return
      if (active.timer) clearTimeout(active.timer)
      active.timer = timer
    }

    const startTool = (name: string, callID: string) => {
      activeTools.set(callID, { name })
      armToolTimeout(name, callID)
    }

    const finishTool = (callID?: string) => {
      if (!callID) return
      const active = activeTools.get(callID)
      if (!active) return
      if (active.timer) clearTimeout(active.timer)
      activeTools.delete(callID)
    }

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer)
      if (activeTools.size > 0) return
      idleTimer = setTimeout(() => {
        abortRun(new Error(`Stream idle timeout after ${idleTimeoutMs}ms`))
      }, idleTimeoutMs)
    }

    try {
      const result = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: history,
        tools,
        stopWhen: stepCountIs(maxSteps),
        toolChoice: "auto",
        abortSignal: internalAbort.signal,
      })
      resetIdle()
      for await (const part of result.fullStream) {
        if (internalAbort.signal.aborted) {
          break
        }
        resetIdle()

        switch (part.type) {
          case "text-delta": {
            const delta = (part as any).text ?? (part as any).textDelta ?? ""
            if (!delta) break
            full += delta
            yield run.next("text-delta", { text: delta })
            break
          }
          case "tool-call": {
            if (idleTimer) {
              clearTimeout(idleTimer)
              idleTimer = undefined
            }
            const name = (part as any).toolName || "unknown"
            const args = (part as any).args ?? (part as any).input ?? {}
            const callID = (part as any).toolCallId || (part as any).id || `${run.runId}:tool:${crypto.randomUUID()}`
            pushToolID(name, callID)
            startTool(name, callID)
            yield run.next("tool-start", { callID, name, args })
            break
          }
          case "tool-result": {
            const name = (part as any).toolName || "unknown"
            const callID = (part as any).toolCallId || (part as any).id || shiftToolID(name) || `${run.runId}:tool:${crypto.randomUUID()}`
            dropToolID(name, callID)
            finishTool(callID)
            resetIdle()
            const result = (part as any).output ?? (part as any).result ?? {}
            yield run.next("tool-result", { callID, name, result })
            break
          }
          case "tool-error" as any: {
            const name = (part as any).toolName || "unknown"
            const callID = (part as any).toolCallId || (part as any).id || shiftToolID(name)
            if (callID) {
              dropToolID(name, callID)
              finishTool(callID)
            }
            resetIdle()
            const error = new Error(String((part as any).error || "tool error"))
            errorEmitted = true
            yield run.next("error", { error })
            abortRun(error)
            break
          }
          case "error": {
            const err = (part as any).error
            errorEmitted = true
            yield run.next("error", { error: err instanceof Error ? err : new Error(String(err)) })
            break
          }
          default:
            break
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (error.name === "AbortError") {
        if (abortError && !externalAbort) {
          errorEmitted = true
          yield run.next("error", { error: abortError })
        }
      } else {
        log.error("stream error", { error: error.message })
        errorEmitted = true
        yield run.next("error", { error })
      }
    } finally {
      if (idleTimer) clearTimeout(idleTimer)
      clearAllToolTimers()
      signal?.removeEventListener("abort", onExternalAbort)
      if (abortError && !externalAbort && !errorEmitted) {
        yield run.next("error", { error: abortError })
      }
      yield run.next("run-finish", { text: full, aborted })
    }
  }

  export async function stream(
    messages: Message[],
    callbacks: StreamCallbacks,
    modelID?: string,
    signal?: AbortSignal,
    options?: StreamOptions,
  ) {
    let full = ""
    try {
      for await (const event of streamEvents(messages, modelID, signal, options)) {
        switch (event.type) {
          case "text-delta":
            full += event.text
            callbacks.onToken?.(event.text)
            break
          case "tool-start":
            callbacks.onToolCall?.(event.name, event.args, event.callID)
            break
          case "tool-result":
            callbacks.onToolResult?.(event.name, event.result, event.callID)
            break
          case "error":
            callbacks.onError?.(event.error)
            break
          case "run-finish":
            callbacks.onFinish?.(event.text || "(No response)")
            return event.text || "(No response)"
        }
      }
      callbacks.onFinish?.(full || "(No response)")
      return full || "(No response)"
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      callbacks.onError?.(error)
      callbacks.onFinish?.(full || "(No response)")
      return full || "(No response)"
    }
  }

  export async function generate(prompt: string, modelID?: string) {
    let result = ""
    await stream([{ role: "user", content: prompt }], { onFinish: (text) => (result = text) }, modelID)
    return result
  }

  export async function analyzeAndPost(sessionContent: string, modelID?: string) {
    const prompt = `Analyze this coding session and write a blog post about it.

The post should:
- Have a catchy, dev-friendly title (like HN or Juejin)
- Tell a story: what you were doing, what went wrong/right, what you learned
- Include relevant code snippets
- Be casual and genuine, written in first person
- End with key takeaways

Also provide:
- 3-8 relevant tags (lowercase, hyphenated)
- A one-line summary/hook

Session content:
${sessionContent.slice(0, 50000)}

IMPORTANT: The "content" field must NOT start with the title. The title is a separate field — do not repeat it as a heading (# ...) or plain text at the beginning of content.

Respond in this exact JSON format:
{
  "title": "...",
  "content": "... (markdown, do NOT start with the title)",
  "tags": ["tag1", "tag2"],
  "summary": "..."
}`

    const raw = await generate(prompt, modelID)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("AI did not return valid JSON")
    return JSON.parse(jsonMatch[0])
  }
}
