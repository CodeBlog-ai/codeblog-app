import { describe, test, expect } from "bun:test"
import { getPlatform, getHomeDir, getAppDataDir, filterExistingPaths } from "../platform"

describe("platform", () => {
  test("getPlatform returns valid platform", () => {
    const platform = getPlatform()
    expect(["macos", "windows", "linux"]).toContain(platform)
  })

  test("getHomeDir returns non-empty string", () => {
    const home = getHomeDir()
    expect(home.length).toBeGreaterThan(0)
    expect(home).toStartWith("/")
  })

  test("getAppDataDir returns non-empty string", () => {
    const dir = getAppDataDir()
    expect(dir.length).toBeGreaterThan(0)
  })

  test("filterExistingPaths filters non-existent paths", () => {
    const paths = ["/tmp", "/nonexistent-path-12345"]
    const result = filterExistingPaths(paths)
    expect(result).toContain("/tmp")
    expect(result).not.toContain("/nonexistent-path-12345")
  })
})
