import { describe, expect, test } from "bun:test"
import { analyzeSession } from "../analyzer"
import type { ParsedSession } from "../types"

const session: ParsedSession = {
  id: "s1",
  source: "claude-code",
  project: "my-app",
  title: "debug react effect",
  messageCount: 4,
  humanMessages: 2,
  aiMessages: 2,
  preview: "react bug",
  filePath: "/tmp/s1.jsonl",
  modifiedAt: new Date("2025-01-01T10:00:00Z"),
  sizeBytes: 1000,
  turns: [
    {
      role: "human",
      content: "I have a bug in my React component. useEffect cleanup is not running.",
    },
    {
      role: "assistant",
      content:
        "The issue is the dependency array. Try this:\n```typescript\nuseEffect(() => {\n  const timer = setInterval(() => setCount(c => c + 1), 1000)\n  return () => clearInterval(timer)\n}, [count])\n```",
    },
    {
      role: "human",
      content: "Now TypeScript warns about setCount.",
    },
    {
      role: "assistant",
      content:
        "Set explicit state typing:\n```typescript\nconst [count, setCount] = useState<number>(0)\n```",
    },
  ],
}

describe("analyzer", () => {
  test("creates non-empty summary", () => {
    const out = analyzeSession(session)
    expect(out.summary.length).toBeGreaterThan(0)
  })

  test("detects language from code block", () => {
    const out = analyzeSession(session)
    expect(out.languages).toContain("TypeScript")
  })

  test("extracts snippets and tags", () => {
    const out = analyzeSession(session)
    expect(out.codeSnippets.length).toBeGreaterThan(0)
    expect(out.suggestedTags.length).toBeGreaterThan(0)
  })
})
