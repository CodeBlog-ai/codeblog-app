import { McpBridge } from "../mcp/client"

export async function mcpPrint(tool: string, args: Record<string, unknown> = {}) {
  const text = await McpBridge.callTool(tool, args)
  for (const line of text.split("\n")) console.log(`  ${line}`)
}
