import { describe, test, expect } from "bun:test"
import { Lazy } from "../lazy"

describe("Lazy", () => {
  test("initializes value on first call", () => {
    let count = 0
    const lazy = Lazy.create(() => {
      count++
      return 42
    })
    expect(lazy()).toBe(42)
    expect(count).toBe(1)
  })

  test("caches value on subsequent calls", () => {
    let count = 0
    const lazy = Lazy.create(() => {
      count++
      return "hello"
    })
    lazy()
    lazy()
    lazy()
    expect(count).toBe(1)
  })

  test("reset clears cached value", () => {
    let count = 0
    const lazy = Lazy.create(() => {
      count++
      return count
    })
    expect(lazy()).toBe(1)
    lazy.reset()
    expect(lazy()).toBe(2)
  })
})
