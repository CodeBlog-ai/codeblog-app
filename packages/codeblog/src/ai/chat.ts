import { stepCountIs, streamText, type ModelMessage } from "ai"
import { AIProvider } from "./provider"
import { chatTools } from "./tools"
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

export namespace AIChat {
  export interface Message {
    role: "user" | "assistant" | "system"
    content: string
  }

  export interface StreamCallbacks {
    onToken?: (token: string) => void
    onFinish?: (text: string) => void
    onError?: (error: Error) => void
    onToolCall?: (name: string, args: unknown, toolCallId: string) => void
    onToolResult?: (name: string, result: unknown, toolCallId: string) => void
  }

  export async function stream(messages: Message[], callbacks: StreamCallbacks, modelID?: string, signal?: AbortSignal) {
    const model = await AIProvider.getModel(modelID)
    log.info("streaming", { model: modelID || "configured-model", messages: messages.length })

    // Build history: only user/assistant text (tool context is added per-step below).
    const history: ModelMessage[] = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    let final = ""
    let usedTool = false

    for (let step = 0; step < 5; step++) {
      if (signal?.aborted) break

      const result = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: history,
        tools: chatTools,
        stopWhen: stepCountIs(1),
        abortSignal: signal,
      })

      const calls = new Map<string, { id: string; name: string; input: unknown; output?: unknown }>()
      const callOrder: string[] = []
      let done = false
      let usedStepTool = false
      let stepText = ""
      let sawDelta = false

      try {
        for await (const part of result.fullStream) {
          if (signal?.aborted) break
          switch (part.type) {
            case "text-delta": {
              const delta = part.text ?? ""
              if (!delta) break
              stepText += delta
              sawDelta = true
              break
            }
            case "tool-call": {
              usedTool = true
              usedStepTool = true
              callbacks.onToolCall?.(part.toolName, part.input, part.toolCallId)
              if (!calls.has(part.toolCallId)) {
                calls.set(part.toolCallId, {
                  id: part.toolCallId,
                  name: part.toolName,
                  input: part.input,
                })
                callOrder.push(part.toolCallId)
              }
              break
            }
            case "tool-result": {
              callbacks.onToolResult?.(part.toolName, part.output, part.toolCallId)
              const call = calls.get(part.toolCallId)
              if (call) call.output = part.output
              break
            }
            case "error": {
              const msg = part.error instanceof Error ? part.error.message : String(part.error)
              log.error("stream part error", { error: msg })
              throw (part.error instanceof Error ? part.error : new Error(msg))
            }
            case "finish-step":
            case "finish":
            case "abort": {
              done = true
              break
            }
            default: {
              const type = part.type as string
              if (type.includes("finish") || type.includes("abort")) done = true
              break
            }
          }
          if (done) break
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        log.error("stream error", { error: error.message })
        if (callbacks.onError) callbacks.onError(error)
        else throw error
        return final
      }

      if (!sawDelta && !usedStepTool) {
        const fallback = await result.text.then(
          (v) => v.trim(),
          () => "",
        )
        if (fallback) stepText = fallback
      }

      if (!usedStepTool) {
        if (stepText) {
          final += stepText
          callbacks.onToken?.(stepText)
        }
        break
      }

      const orderedCalls = callOrder
        .map((id) => calls.get(id))
        .filter((call): call is { id: string; name: string; input: unknown; output?: unknown } => !!call)

      history.push({
        role: "assistant",
        content: orderedCalls.map((call) => ({
          type: "tool-call" as const,
          toolCallId: call.id,
          toolName: call.name,
          input: call.input,
        })),
      })

      history.push({
        role: "tool",
        content: orderedCalls.map((call) => ({
          type: "tool-result" as const,
          toolCallId: call.id,
          toolName: call.name,
          output: {
            type: "json" as const,
            value: toJSONValue(call.output),
          },
        })),
      })

      log.info("tool step done", { step, tools: orderedCalls.map((call) => call.name) })
    }

    const text = final.trim()
    if (text) callbacks.onFinish?.(text)
    else callbacks.onFinish?.(usedTool ? "(Tools completed, but model returned no final answer.)" : "(No response)")
    return text
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

function toJSONValue(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? null))
  } catch {
    return { error: "Non-serializable tool output" }
  }
}
