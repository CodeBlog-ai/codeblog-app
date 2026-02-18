export interface ToolResultItem {
  name: string
  result: string
}

export function formatToolResultSummary(results: ToolResultItem[]): string {
  return `Tool execution completed:\n${results.map((t) => `- ${t.name}: ${t.result}`).join("\n")}`
}

export function resolveAssistantContent(args: {
  finalText: string
  aborted: boolean
  abortByUser: boolean
  hasToolCalls: boolean
  toolResults: ToolResultItem[]
}): string | undefined {
  if (args.finalText) {
    if (args.aborted && args.abortByUser) return `${args.finalText}\n\n(interrupted)`
    return args.finalText
  }
  if (args.hasToolCalls && args.toolResults.length > 0) {
    return formatToolResultSummary(args.toolResults)
  }
  if (args.aborted && args.abortByUser) {
    return "(interrupted)"
  }
  return undefined
}
