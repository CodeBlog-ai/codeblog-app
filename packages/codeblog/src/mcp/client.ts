import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { resolve, dirname } from "path"
import { Log } from "../util/log"

const log = Log.create({ service: "mcp" })

const CONNECTION_TIMEOUT_MS = 30_000

let client: Client | null = null
let transport: StdioClientTransport | null = null
let connecting: Promise<Client> | null = null

function getMcpBinaryPath(): string {
  try {
    const resolved = require.resolve("codeblog-mcp/dist/index.js")
    return resolved
  } catch {
    return resolve(dirname(new URL(import.meta.url).pathname), "../../node_modules/codeblog-mcp/dist/index.js")
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

async function connect(): Promise<Client> {
  if (client) return client

  // If another caller is already connecting, reuse that promise
  if (connecting) return connecting

  connecting = (async (): Promise<Client> => {
    const mcpPath = getMcpBinaryPath()
    log.debug("connecting", { path: mcpPath })

    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v
    }

    const t = new StdioClientTransport({
      command: "node",
      args: [mcpPath],
      env,
      stderr: "pipe",
    })

    const c = new Client({ name: "codeblog-cli", version: "2.0.0" })

    try {
      await withTimeout(c.connect(t), CONNECTION_TIMEOUT_MS, "MCP connection")
    } catch (err) {
      // Clean up on failure so next call can retry
      await t.close().catch(() => {})
      throw err
    }

    log.debug("connected", {
      server: c.getServerVersion()?.name,
      version: c.getServerVersion()?.version,
    })

    // Only assign to module-level vars after successful connection
    transport = t
    client = c
    return c
  })()

  try {
    return await connecting
  } catch (err) {
    // Reset connecting so next call can retry
    connecting = null
    throw err
  }
}

export namespace McpBridge {
  /**
   * Call an MCP tool by name with arguments.
   * Returns the text content from the tool result.
   */
  export async function callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<string> {
    const c = await connect()
    const result = await c.callTool({ name, arguments: args })

    if (result.isError) {
      const text = extractText(result)
      throw new Error(text || `MCP tool "${name}" returned an error`)
    }

    return extractText(result)
  }

  /**
   * Call an MCP tool and parse the result as JSON.
   */
  export async function callToolJSON<T = unknown>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const text = await callTool(name, args)
    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  }

  /**
   * List all available MCP tools.
   */
  export async function listTools() {
    const c = await connect()
    return c.listTools()
  }

  /**
   * Disconnect the MCP client and kill the subprocess.
   */
  export async function disconnect(): Promise<void> {
    connecting = null
    if (transport) {
      await transport.close().catch(() => {})
      transport = null
    }
    client = null
  }
}

function extractText(result: unknown): string {
  const r = result as { content?: Array<{ type: string; text?: string }> }
  if (!r.content || !Array.isArray(r.content)) return ""
  return r.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n")
}
