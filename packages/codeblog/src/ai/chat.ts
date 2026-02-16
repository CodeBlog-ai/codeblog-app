import { streamText, stepCountIs } from "ai"
import { AIProvider } from "./provider"
import { getChatTools } from "./tools"
import { Log } from "../util/log"

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

Write casually like a dev talking to another dev. Be specific, opinionated, and genuine.
Use code examples when relevant. Think Juejin / HN / Linux.do vibes — not a conference paper.`

const MAX_TOOL_STEPS = 1
const IDLE_TIMEOUT_MS = 15_000 // 15s without any stream event → abort

export namespace AIChat {
  export interface Message {
    role: "user" | "assistant" | "system"
    content: string
  }

  export interface StreamCallbacks {
    onToken?: (token: string) => void
    onFinish?: (text: string) => void
    onError?: (error: Error) => void
    onToolCall?: (name: string, args: unknown) => void
    onToolResult?: (name: string, result: unknown) => void
  }

  export async function stream(messages: Message[], callbacks: StreamCallbacks, modelID?: string, signal?: AbortSignal) {
    const model = await AIProvider.getModel(modelID)
    const tools = await getChatTools()
    log.info("streaming", { model: modelID || AIProvider.DEFAULT_MODEL, messages: messages.length, toolCount: Object.keys(tools).length })

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    let full = ""

    // Create an internal AbortController that we can trigger on idle timeout
    const internalAbort = new AbortController()
    const onExternalAbort = () => {
      log.info("external abort signal received")
      internalAbort.abort()
    }
    signal?.addEventListener("abort", onExternalAbort)

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: history,
      tools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      toolChoice: "auto",
      abortSignal: internalAbort.signal,
      onStepFinish: (stepResult) => {
        log.info("onStepFinish", {
          stepNumber: stepResult.stepNumber,
          finishReason: stepResult.finishReason,
          textLength: stepResult.text?.length ?? 0,
          toolCallsCount: stepResult.toolCalls?.length ?? 0,
          toolResultsCount: stepResult.toolResults?.length ?? 0,
        })
      },
    })

    let partCount = 0
    let toolExecuting = false
    try {
      // Idle timeout: if no stream events arrive for IDLE_TIMEOUT_MS, abort.
      // Paused during tool execution (tools can take longer than 15s).
      let idleTimer: ReturnType<typeof setTimeout> | undefined
      const resetIdle = () => {
        if (idleTimer) clearTimeout(idleTimer)
        if (toolExecuting) return // Don't start timer while tool is running
        idleTimer = setTimeout(() => {
          log.info("IDLE TIMEOUT FIRED", { partCount, fullLength: full.length })
          internalAbort.abort()
        }, IDLE_TIMEOUT_MS)
      }
      resetIdle()

      for await (const part of result.fullStream) {
        partCount++
        if (internalAbort.signal.aborted) {
          log.info("abort detected in loop, breaking", { partCount })
          break
        }
        resetIdle()

        switch (part.type) {
          case "text-delta": {
            const delta = (part as any).text ?? (part as any).textDelta ?? ""
            if (delta) { full += delta; callbacks.onToken?.(delta) }
            break
          }
          case "tool-call": {
            log.info("tool-call", { toolName: (part as any).toolName, partCount })
            // Pause idle timer — tool execution happens between tool-call and tool-result
            toolExecuting = true
            if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined }
            callbacks.onToolCall?.((part as any).toolName, (part as any).input ?? (part as any).args)
            break
          }
          case "tool-result": {
            log.info("tool-result", { toolName: (part as any).toolName, partCount })
            toolExecuting = false
            callbacks.onToolResult?.((part as any).toolName, (part as any).output ?? (part as any).result ?? {})
            break
          }
          case "tool-error" as any: {
            log.error("tool-error", { toolName: (part as any).toolName, error: String((part as any).error).slice(0, 500) })
            toolExecuting = false
            break
          }
          case "error": {
            const msg = (part as any).error instanceof Error ? (part as any).error.message : String((part as any).error)
            log.error("stream part error", { error: msg })
            callbacks.onError?.((part as any).error instanceof Error ? (part as any).error : new Error(msg))
            break
          }
          default:
            break
        }
      }

      if (idleTimer) clearTimeout(idleTimer)
      log.info("for-await loop exited normally", { partCount, fullLength: full.length })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      log.info("catch block entered", { name: error.name, message: error.message.slice(0, 200), partCount })
      // Don't treat abort as a real error
      if (error.name !== "AbortError") {
        log.error("stream error (non-abort)", { error: error.message })
        if (callbacks.onError) callbacks.onError(error)
        else throw error
      } else {
        log.info("AbortError caught — treating as normal completion")
      }
      // On abort or error, still call onFinish so UI cleans up
      log.info("calling onFinish from catch", { fullLength: full.length })
      callbacks.onFinish?.(full || "(No response)")
      return full
    } finally {
      log.info("finally block", { partCount, fullLength: full.length })
      signal?.removeEventListener("abort", onExternalAbort)
    }

    log.info("calling onFinish from normal path", { fullLength: full.length })
    callbacks.onFinish?.(full || "(No response)")
    return full
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

Respond in this exact JSON format:
{
  "title": "...",
  "content": "... (markdown)",
  "tags": ["tag1", "tag2"],
  "summary": "..."
}`

    const raw = await generate(prompt, modelID)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("AI did not return valid JSON")
    return JSON.parse(jsonMatch[0])
  }
}
