import { describe, test, expect } from "bun:test"
import { Context } from "../context"

describe("Context", () => {
  test("create and provide context", () => {
    const ctx = Context.create<string>("test")

    Context.provide(ctx, "hello", () => {
      expect(Context.use(ctx)).toBe("hello")
    })
  })

  test("use returns undefined outside provider", () => {
    const ctx = Context.create<number>("num")
    expect(Context.use(ctx)).toBeUndefined()
  })

  test("nested contexts work correctly", () => {
    const ctx = Context.create<string>("nested")

    Context.provide(ctx, "outer", () => {
      expect(Context.use(ctx)).toBe("outer")

      Context.provide(ctx, "inner", () => {
        expect(Context.use(ctx)).toBe("inner")
      })

      expect(Context.use(ctx)).toBe("outer")
    })
  })
})
