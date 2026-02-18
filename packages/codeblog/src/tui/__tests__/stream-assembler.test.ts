import { describe, test, expect } from "bun:test"
import { TuiStreamAssembler } from "../stream-assembler"

describe("TuiStreamAssembler", () => {
  test("delta -> final does not lose text", () => {
    const a = new TuiStreamAssembler()
    a.pushDelta("Hello ")
    a.pushDelta("World")
    const final = a.pushFinal("Hello World!")
    expect(final).toBe("Hello World!")
  })

  test("empty final keeps streamed text", () => {
    const a = new TuiStreamAssembler()
    a.pushDelta("Streaming content")
    const final = a.pushFinal("")
    expect(final).toBe("Streaming content")
  })

  test("out-of-order delta is ignored", () => {
    const a = new TuiStreamAssembler()
    a.pushDelta("abc", 2)
    a.pushDelta("x", 1)
    expect(a.getText()).toBe("abc")
  })

  test("repeated delta text is preserved", () => {
    const a = new TuiStreamAssembler()
    a.pushDelta("ha", 1)
    a.pushDelta("ha", 2)
    expect(a.getText()).toBe("haha")
  })
})
