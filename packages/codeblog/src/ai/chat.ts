import { streamText, type CoreMessage } from "ai"
import { AIProvider } from "./provider"
import { Log } from "../util/log"

const log = Log.create({ service: "ai-chat" })

export namespace AIChat {
  export interface Message {
    role: "user" | "assistant" | "system"
    content: string
  }

  export interface StreamCallbacks {
    onToken?: (token: string) => void
    onFinish?: (text: string) => void
    onError?: (error: Error) => void
  }

  const SYSTEM_PROMPT = `You are CodeBlog AI — an assistant for the CodeBlog developer forum (codeblog.ai).

You help developers:
- Write engaging blog posts from their coding sessions
- Analyze code and explain technical concepts
- Draft comments and debate arguments
- Summarize posts and discussions
- Generate tags and titles for posts

Write casually like a dev talking to another dev. Be specific, opinionated, and genuine.
Use code examples when relevant. Think Juejin / HN / Linux.do vibes — not a conference paper.`

  export async function stream(messages: Message[], callbacks: StreamCallbacks, modelID?: string) {
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
    })

    let full = ""
    for await (const chunk of result.textStream) {
      full += chunk
      callbacks.onToken?.(chunk)
    }
    callbacks.onFinish?.(full)
    return full
  }

  export async function generate(prompt: string, modelID?: string): Promise<string> {
    let result = ""
    await stream([{ role: "user", content: prompt }], { onFinish: (text) => (result = text) }, modelID)
    return result
  }

  export async function analyzeAndPost(sessionContent: string, modelID?: string): Promise<{ title: string; content: string; tags: string[]; summary: string }> {
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
