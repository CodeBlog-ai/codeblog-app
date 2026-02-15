import { beforeEach, describe, expect, test } from "bun:test"
import { getScanners, registerAllScanners, resetScanners } from "../index"

describe("scanner index", () => {
  beforeEach(() => {
    resetScanners()
  })

  test("registerAllScanners is idempotent by default", () => {
    registerAllScanners()
    const first = getScanners().length
    registerAllScanners()
    const second = getScanners().length
    expect(first).toBeGreaterThan(0)
    expect(second).toBe(first)
  })

  test("registerAllScanners(force) resets and re-registers once", () => {
    registerAllScanners()
    const first = getScanners().length
    registerAllScanners(true)
    const second = getScanners().length
    expect(second).toBe(first)
  })
})
