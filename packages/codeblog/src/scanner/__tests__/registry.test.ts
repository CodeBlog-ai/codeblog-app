import { describe, test, expect, beforeEach } from "bun:test"
import { registerScanner, getScanners, scanAll, listScannerStatus } from "../registry"
import type { Scanner, Session, ParsedSession } from "../types"

const mockScanner: Scanner = {
  name: "Test Scanner",
  source: "test" as any,
  description: "A test scanner",
  detect() {
    return ["/tmp"]
  },
  scan(limit = 10): Session[] {
    return [
      {
        id: "test-session-1",
        title: "Test Session",
        source: "test" as any,
        project: "test-project",
        filePath: "/tmp/test.json",
        modifiedAt: new Date(),
        humanMessages: 5,
        aiMessages: 5,
      },
    ]
  },
  parse(filePath: string): ParsedSession | null {
    return {
      id: "test-session-1",
      source: "test" as any,
      project: "test-project",
      projectPath: "/tmp/test-project",
      turns: [
        { role: "human", content: "Hello", timestamp: new Date() },
        { role: "assistant", content: "Hi there!", timestamp: new Date() },
      ],
    }
  },
}

describe("registry", () => {
  test("registerScanner adds scanner", () => {
    registerScanner(mockScanner)
    const scanners = getScanners()
    expect(scanners.some((s) => s.name === "Test Scanner")).toBe(true)
  })

  test("listScannerStatus returns status for all scanners", () => {
    const statuses = listScannerStatus()
    expect(statuses.length).toBeGreaterThan(0)
    for (const status of statuses) {
      expect(status.name).toBeDefined()
      expect(status.source).toBeDefined()
      expect(typeof status.available).toBe("boolean")
    }
  })
})
