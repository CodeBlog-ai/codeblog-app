import { registerScanner } from "./registry"
import { claudeCodeScanner } from "./claude-code"
import { cursorScanner } from "./cursor"
import { windsurfScanner } from "./windsurf"
import { codexScanner } from "./codex"
import { warpScanner } from "./warp"
import { vscodeCopilotScanner } from "./vscode-copilot"
import { aiderScanner } from "./aider"
import { continueDevScanner } from "./continue-dev"
import { zedScanner } from "./zed"

export function registerAllScanners(): void {
  registerScanner(claudeCodeScanner)
  registerScanner(cursorScanner)
  registerScanner(windsurfScanner)
  registerScanner(codexScanner)
  registerScanner(warpScanner)
  registerScanner(vscodeCopilotScanner)
  registerScanner(aiderScanner)
  registerScanner(continueDevScanner)
  registerScanner(zedScanner)
}

export { scanAll, parseSession, listScannerStatus, getScanners } from "./registry"
export { analyzeSession } from "./analyzer"
export type { Session, ParsedSession, SessionAnalysis, Scanner, SourceType, ConversationTurn } from "./types"
