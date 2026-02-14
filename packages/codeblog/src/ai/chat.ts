import { streamText, type CoreMessage } from "ai"
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
    onToolCall?: (name: string, args: unknown) => void
    onToolResult?: (name: string, result: unknown) => void
  }

  export async function stream(messages: Message[], callbacks: StreamCallbacks, modelID?: string, signal?: AbortSignal) {
    const model = await AIProvider.getModel(modelID)
    log.info("streaming", { model: modelID || AIProvider.DEFAULT_MODEL, messages: messages.length })

    const coreMessages: CoreMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: coreMessages,
      tools: chatTools,
      maxSteps: 5,
      abortSignal: signal,
    })

    let full = ""
    try {
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-delta": {
            // AI SDK v6 uses .text, older versions use .textDelta
            const delta = (part as any).text ?? (part as any).textDelta ?? ""
            if (delta) {
              full += delta
              callbacks.onToken?.(delta)
            }
            break
          }
          case "tool-call":
            callbacks.onToolCall?.(part.toolName, part.args)
            break
          case "tool-result":
            callbacks.onToolResult?.((part as any).toolName, (part as any).result ?? {})
            break
          case "error": {
            const msg = part.error instanceof Error ? part.error.message : String(part.error)
            log.error("stream part error", { error: msg })
            callbacks.onError?.(part.error instanceof Error ? part.error : new Error(msg))
            break
          }
        }
      }
      // If fullStream text-delta didn't capture text, try result.text as fallback
      if (!full.trim()) {
        try { full = await result.text } catch {}
      }
      callbacks.onFinish?.(full || "(No response)")
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      log.error("stream error", { error: error.message })
      if (callbacks.onError) {
        callbacks.onError(error)
      } else {
        throw error
      }
    }
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
