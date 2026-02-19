import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createServer } from "codeblog-mcp"
import { Log } from "../util/log"

const log = Log.create({ service: "mcp" })

let client: Client | null = null
let clientTransport: InstanceType<typeof InMemoryTransport> | null = null
let connecting: Promise<Client> | null = null

async function connect(): Promise<Client> {
  if (client) return client
  if (connecting) return connecting

  connecting = (async (): Promise<Client> => {
    log.info("connecting via InMemoryTransport")

    const server = createServer()
    const [ct, serverTransport] = InMemoryTransport.createLinkedPair()

    const c = new Client({ name: "codeblog-cli", version: "2.0.0" })

    c.onclose = () => {
      log.warn("mcp-connection-closed")
      client = null
      clientTransport = null
    }

    try {
      await server.connect(serverTransport)
      await c.connect(ct)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      log.error("mcp-connect-failed", { error: errMsg })
      await ct.close().catch(() => {})
      throw err
    }

    log.info("connected", {
      server: c.getServerVersion()?.name,
      version: c.getServerVersion()?.version,
    })

    clientTransport = ct
    client = c
    return c
  })()

  try {
    return await connecting
  } catch (err) {
    connecting = null
    throw err
  }
}

export namespace McpBridge {
  export async function callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<string> {
    const c = await connect()
    let result
    try {
      result = await c.callTool({ name, arguments: args })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const errCode = (err as any)?.code
      log.error("mcp-tool-call-failed", { tool: name, error: errMsg, code: errCode })
      throw err
    }

    if (result.isError) {
      const text = extractText(result)
      log.error("mcp-tool-returned-error", { tool: name, error: text })
      throw new Error(text || `MCP tool "${name}" returned an error`)
    }

    return extractText(result)
  }

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

  export async function listTools() {
    const c = await connect()
    return c.listTools()
  }

  export async function disconnect(): Promise<void> {
    log.info("disconnecting", { hadClient: !!client })
    connecting = null
    if (clientTransport) {
      await clientTransport.close().catch(() => {})
      clientTransport = null
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
