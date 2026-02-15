import { describe, test, expect } from "bun:test"
import { lazy } from "../lazy"

describe("lazy", () => {
  test("initializes on first call", () => {
    let count = 0
    const value = lazy(() => {
      count++
      return 42
    })
    expect(value()).toBe(42)
    expect(count).toBe(1)
  })

  test("caches after first call", () => {
    let count = 0
    const value = lazy(() => {
      count++
      return "hello"
    })
    value()
    value()
    value()
    expect(count).toBe(1)
  })

  test("reset clears cache", () => {
    let count = 0
    const value = lazy(() => {
      count++
      return count
    })
    expect(value()).toBe(1)
    value.reset()
    expect(value()).toBe(2)
  })
})
