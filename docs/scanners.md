# IDE Session Scanners

## Overview

codeblog-app scans local IDE session history from 9 coding tools. Each scanner implements the `Scanner` interface and is registered in the central registry.

## Supported IDEs

### Claude Code

- **Path**: `~/.claude/projects/<project>/`
- **Format**: JSONL files (one JSON object per line)
- **Detection**: Checks for `.claude/projects/` directory
- **Session ID**: Directory name (UUID)
- **Project**: Extracted from directory path
- **Messages**: `type: "human"` and `type: "assistant"` entries

### Cursor

The most complex scanner — supports 3 different storage formats:

1. **Agent Transcripts** (`~/.cursor/projects/<project>/agent-transcripts/`)
   - Plain text files with `## Human\n` / `## Assistant\n` markers
   
2. **Chat Sessions** (`workspaceStorage/*/chatSessions/`)
   - JSON files with `messages` array
   
3. **Global Storage** (`globalStorage/state.vscdb`)
   - SQLite database with `cursorComposer/composerData` key
   - Requires `better-sqlite3` or Bun SQLite

### Windsurf (Codeium)

- **Path**: `workspaceStorage/*/state.vscdb`
- **Format**: SQLite database
- **Tables**: `ItemTable` with `cascadeChat/` prefixed keys
- **Messages**: JSON-encoded chat data with `messages` array

### Codex (OpenAI CLI)

- **Path**: `~/.codex/sessions/` and `~/.codex/archived_sessions/`
- **Format**: JSONL files in date-organized directories
- **Detection**: Recursive scan of `YYYY-MM-DD/` subdirectories
- **Messages**: `type: "message"` entries with `role` field

### VS Code Copilot Chat

- **Path**: `workspaceStorage/*/chat/`
- **Format**: JSON files
- **Messages**: `messages` array with `role: "user"` / `role: "assistant"`

### Aider

- **Path**: `~/.aider/` and project-local `.aider.chat.history.md`
- **Format**: Markdown with `#### human` / `#### assistant` markers
- **Status**: Stub — scanner ready, needs testing

### Continue.dev

- **Path**: `~/.continue/sessions/`
- **Format**: JSON session files
- **Messages**: `history` array with `role` field
- **Status**: Stub — scanner ready, needs testing

### Zed

- **Path**: Zed conversations directory (platform-specific)
- **Format**: JSON conversation files
- **Messages**: `messages` array
- **Status**: Stub — scanner ready, needs testing

### Warp Terminal

- **Status**: Not available — AI chat history is cloud-only, no local files

## Adding a New Scanner

1. Create `packages/codeblog/src/scanner/<name>.ts`
2. Implement the `Scanner` interface:

```ts
import type { Scanner, Session, ParsedSession, SourceType } from "./types"

export const myScanner: Scanner = {
  name: "My IDE",
  source: "my-ide" as SourceType,
  description: "My IDE sessions",

  detect(): string[] {
    // Return paths that exist
    return ["/path/to/sessions"].filter(existsSync)
  },

  scan(limit = 50): Session[] {
    // Return session metadata
    return []
  },

  parse(filePath: string, maxTurns = 50): ParsedSession | null {
    // Parse a session file into structured data
    return null
  },
}
```

3. Register in `packages/codeblog/src/scanner/index.ts`:

```ts
import { myScanner } from "./my-scanner"
registerScanner(myScanner)
```

4. Add tests in `packages/codeblog/src/scanner/__tests__/`
5. Update the IDE table in `README.md`
