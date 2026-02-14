import { describe, test, expect } from "bun:test"
import { analyzeSession } from "../analyzer"
import type { ParsedSession } from "../types"

describe("analyzer", () => {
  const session: ParsedSession = {
    id: "test-1",
    source: "claude-code" as any,
    project: "my-app",
    projectPath: "/home/user/my-app",
    turns: [
      {
        role: "human",
        content: "I have a bug in my React component. The useEffect cleanup is not running properly.",
        timestamp: new Date("2025-01-01T10:00:00Z"),
      },
      {
        role: "assistant",
        content:
          "The issue is that your useEffect dependency array is missing the `count` variable. Here's the fix:\n\n```typescript\nuseEffect(() => {\n  const timer = setInterval(() => setCount(c => c + 1), 1000)\n  return () => clearInterval(timer)\n}, [count])\n```\n\nThis ensures the cleanup runs when `count` changes.",
        timestamp: new Date("2025-01-01T10:01:00Z"),
      },
      {
        role: "human",
        content: "That fixed it! But now I'm getting a TypeScript error on the setCount call.",
        timestamp: new Date("2025-01-01T10:02:00Z"),
      },
      {
        role: "assistant",
        content:
          "The TypeScript error is because `setCount` expects a `number` but you're passing a function. You need to type the state:\n\n```typescript\nconst [count, setCount] = useState<number>(0)\n```\n\nOr use the updater function signature:\n```typescript\nsetCount((prev: number) => prev + 1)\n```",
        timestamp: new Date("2025-01-01T10:03:00Z"),
      },
    ],
  }

  test("generates a summary", () => {
    const analysis = analyzeSession(session)
    expect(analysis.summary.length).toBeGreaterThan(0)
  })

  test("detects languages", () => {
    const analysis = analyzeSession(session)
    expect(analysis.languages).toContain("typescript")
  })

  test("extracts code snippets", () => {
    const analysis = analyzeSession(session)
    expect(analysis.codeSnippets.length).toBeGreaterThan(0)
    expect(analysis.codeSnippets[0].language).toBe("typescript")
  })

  test("suggests a title", () => {
    const analysis = analyzeSession(session)
    expect(analysis.suggestedTitle.length).toBeGreaterThan(0)
  })

  test("suggests tags", () => {
    const analysis = analyzeSession(session)
    expect(analysis.suggestedTags.length).toBeGreaterThan(0)
  })

  test("extracts topics", () => {
    const analysis = analyzeSession(session)
    expect(analysis.topics.length).toBeGreaterThan(0)
  })
})
