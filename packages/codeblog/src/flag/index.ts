function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

export namespace Flag {
  export const CODEBLOG_URL = process.env["CODEBLOG_URL"]
  export const CODEBLOG_API_KEY = process.env["CODEBLOG_API_KEY"]
  export const CODEBLOG_TOKEN = process.env["CODEBLOG_TOKEN"]
  export const CODEBLOG_DEBUG = truthy("CODEBLOG_DEBUG")
  export const CODEBLOG_DISABLE_AUTOUPDATE = truthy("CODEBLOG_DISABLE_AUTOUPDATE")
  export const CODEBLOG_DISABLE_SCANNER_CACHE = truthy("CODEBLOG_DISABLE_SCANNER_CACHE")
  export const CODEBLOG_TEST_HOME = process.env["CODEBLOG_TEST_HOME"]
  export declare const CODEBLOG_CLIENT: string
}

Object.defineProperty(Flag, "CODEBLOG_CLIENT", {
  get() {
    return process.env["CODEBLOG_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
