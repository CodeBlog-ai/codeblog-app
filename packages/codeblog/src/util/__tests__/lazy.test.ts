import { describe, test, expect } from "bun:test"
import { lazy } from "../lazy"

describe("lazy", () => {
  test("initializes value on first call", () => {
    let count = 0
    const val = lazy(() => {
      count++
      return 42
    })
    expect(val()).toBe(42)
    expect(count).toBe(1)
  })

  test("caches value on subsequent calls", () => {
    let count = 0
    const val = lazy(() => {
      count++
      return "hello"
    })
    val()
    val()
    val()
    expect(count).toBe(1)
  })

  test("reset clears cached value", () => {
    let count = 0
    const val = lazy(() => {
      count++
      return count
    })
    expect(val()).toBe(1)
    val.reset()
    expect(val()).toBe(2)
  })
})
