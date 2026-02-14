export interface Session {
  id: string
  source: SourceType
  project: string
  projectPath?: string
  projectDescription?: string
  title: string
  messageCount: number
  humanMessages: number
  aiMessages: number
  preview: string
  filePath: string
  modifiedAt: Date
  sizeBytes: number
}

export interface ConversationTurn {
  role: "human" | "assistant" | "system" | "tool"
  content: string
  timestamp?: Date
}

export interface ParsedSession extends Session {
  turns: ConversationTurn[]
}

export interface SessionAnalysis {
  summary: string
  topics: string[]
  languages: string[]
  keyInsights: string[]
  codeSnippets: Array<{
    language: string
    code: string
    context: string
  }>
  problems: string[]
  solutions: string[]
  suggestedTitle: string
  suggestedTags: string[]
}

export type SourceType =
  | "claude-code"
  | "cursor"
  | "windsurf"
  | "codex"
  | "warp"
  | "vscode-copilot"
  | "aider"
  | "continue"
  | "zed"
  | "unknown"

export interface Scanner {
  name: string
  sourceType: SourceType
  description: string
  getSessionDirs(): string[]
  scan(limit: number): Session[]
  parse(filePath: string, maxTurns?: number): ParsedSession | null
}
