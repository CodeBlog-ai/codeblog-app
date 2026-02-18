import { describe, expect, test } from "bun:test"
import { isShiftEnterSequence } from "../input-intent"

describe("input intent", () => {
  test("detects kitty csi-u shift+enter sequences", () => {
    expect(isShiftEnterSequence("\x1b[13;2u")).toBe(true)
    expect(isShiftEnterSequence("\x1b[57345;2u")).toBe(true)
    expect(isShiftEnterSequence("\x1b[13;2:1u")).toBe(true)
  })

  test("detects modifyOtherKeys-style shift+enter sequences", () => {
    expect(isShiftEnterSequence("\x1b[27;2;13~")).toBe(true)
    expect(isShiftEnterSequence("\x1b[13;2~")).toBe(true)
  })

  test("detects shift+enter sequences with trailing newline bytes", () => {
    expect(isShiftEnterSequence("\x1b[13;2u\r")).toBe(true)
    expect(isShiftEnterSequence("\x1b[27;2;13~\n")).toBe(true)
  })

  test("does not match plain enter sequences", () => {
    expect(isShiftEnterSequence("\r")).toBe(false)
    expect(isShiftEnterSequence("\n")).toBe(false)
    expect(isShiftEnterSequence("\x1b[13u")).toBe(false)
    expect(isShiftEnterSequence("")).toBe(false)
  })
})
