import { beforeEach, describe, expect, test } from "bun:test"
import { clearScanners, listScannerStatus, parseSession, registerScanner, scanAll } from "../registry"
import type { Scanner, Session } from "../types"

function makeSession(id: string, minutesAgo: number): Session {
  return {
    id,
    source: "codex",
    project: "proj",
    title: `title-${id}`,
    messageCount: 2,
    humanMessages: 1,
    aiMessages: 1,
    preview: "preview",
    filePath: `/tmp/${id}.jsonl`,
    modifiedAt: new Date(Date.now() - minutesAgo * 60 * 1000),
    sizeBytes: 100,
  }
}

const scanner: Scanner = {
  name: "Test Scanner",
  sourceType: "codex",
  description: "test",
  getSessionDirs() {
    return ["/tmp"]
  },
  scan(limit) {
    return [makeSession("a", 10), makeSession("b", 1)].slice(0, limit)
  },
  parse(filePath) {
    return {
      ...makeSession(filePath.includes("a") ? "a" : "b", 0),
      turns: [
        { role: "human", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    }
  },
}

describe("registry", () => {
  beforeEach(() => {
    clearScanners()
  })

  test("registerScanner + scanAll work", () => {
    registerScanner(scanner)
    const rows = scanAll(10)
    expect(rows.length).toBe(2)
    expect(rows[0]?.id).toBe("b")
    expect(rows[1]?.id).toBe("a")
  })

  test("parseSession delegates by source", () => {
    registerScanner(scanner)
    const parsed = parseSession("/tmp/a.jsonl", "codex")
    expect(parsed?.turns.length).toBe(2)
    expect(parsed?.source).toBe("codex")
  })

  test("listScannerStatus includes registered scanner", () => {
    registerScanner(scanner)
    const status = listScannerStatus()
    expect(status.length).toBe(1)
    expect(status[0]?.name).toBe("Test Scanner")
    expect(status[0]?.available).toBe(true)
  })
})
