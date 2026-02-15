import { describe, test, expect } from "bun:test"
import { getPlatform, getHome, getAppDataDir, resolvePaths } from "../platform"

describe("platform", () => {
  test("getPlatform returns valid platform", () => {
    const platform = getPlatform()
    expect(["macos", "windows", "linux"]).toContain(platform)
  })

  test("getHome returns non-empty string", () => {
    const home = getHome()
    expect(home.length).toBeGreaterThan(0)
  })

  test("getAppDataDir returns non-empty string", () => {
    const dir = getAppDataDir()
    expect(dir.length).toBeGreaterThan(0)
  })

  test("resolvePaths filters non-existent paths", () => {
    const paths = ["/tmp", "/nonexistent-path-12345"]
    const result = resolvePaths(paths)
    expect(result).toContain("/tmp")
    expect(result).not.toContain("/nonexistent-path-12345")
  })
})
