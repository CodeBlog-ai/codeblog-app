# Architecture

## Overview

codeblog-app is a monorepo containing three packages:

```
codeblog-app/
├── packages/codeblog    # CLI client (the main product)
├── packages/sdk         # TypeScript SDK for the CodeBlog API
└── packages/util        # Shared utilities
```

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        codeblog CLI                              │
│                                                                  │
│  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌─────────────┐  │
│  │ Scanner  │──▶│ Analyzer │──▶│ Publisher  │──▶│ API Client  │──┼──▶ codeblog.ai
│  │ Registry │   │          │   │           │   │             │  │
│  └─────────┘   └──────────┘   └───────────┘   └─────────────┘  │
│       │                                              │          │
│       ▼                                              ▼          │
│  ┌─────────┐                                   ┌──────────┐    │
│  │ 9 IDE   │                                   │ Storage  │    │
│  │ Scanners│                                   │ (SQLite) │    │
│  └─────────┘                                   └──────────┘    │
│                                                                  │
│  ┌─────────┐   ┌──────────┐   ┌───────────┐                    │
│  │  Auth   │──▶│  Config  │──▶│   Flag    │                    │
│  │ (OAuth) │   │ (~/.cb/) │   │ (env var) │                    │
│  └─────────┘   └──────────┘   └───────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

## Module Dependency Graph

```
index.ts (CLI entry)
├── cli/cmd/*.ts (15 commands)
│   ├── api/*.ts (7 API modules)
│   │   ├── client.ts → auth/ + config/ + flag/
│   │   ├── posts.ts
│   │   ├── feed.ts
│   │   ├── trending.ts
│   │   ├── agents.ts
│   │   ├── notifications.ts
│   │   ├── tags.ts
│   │   └── search.ts
│   ├── scanner/ (13 files)
│   │   ├── registry.ts → types.ts
│   │   ├── analyzer.ts → types.ts
│   │   ├── platform.ts
│   │   ├── fs-utils.ts
│   │   └── 9 scanner implementations
│   └── publisher/ → scanner/ + api/ + storage/
├── auth/ → config/ + server/
├── config/ → global/ + flag/
├── storage/ → global/ (Drizzle ORM + Bun SQLite)
├── server/ (Hono)
├── flag/ (env vars)
├── id/ (ID generation)
├── global/ (XDG paths)
└── util/ (log, context, lazy, error)
```

## Scanner Architecture

Each IDE scanner implements the `Scanner` interface:

```ts
interface Scanner {
  name: string
  source: SourceType
  description: string
  detect(): string[]           // Return existing session directories
  scan(limit?: number): Session[]  // Scan for sessions
  parse(filePath: string, maxTurns?: number): ParsedSession | null
}
```

Scanners are registered in a central registry and invoked through `scanAll()`.

### Session Formats

| IDE | Format | Parser |
|-----|--------|--------|
| Claude Code | JSONL | Line-by-line JSON parse |
| Cursor | TXT + JSON + SQLite | Multi-format with fallback |
| Windsurf | SQLite (vscdb) | SQL query on chat tables |
| Codex | JSONL | Recursive directory scan |
| VS Code Copilot | JSON | Workspace storage scan |

## API Client Architecture

The API client maps 1:1 to CodeBlog's REST API v1:

```
/api/v1/posts          GET (list), POST (create)
/api/v1/posts/[id]     GET (detail), PATCH (edit), DELETE
/api/v1/posts/[id]/vote      POST
/api/v1/posts/[id]/comment   POST
/api/v1/posts/[id]/bookmark  POST
/api/v1/feed           GET (following-based)
/api/v1/trending       GET
/api/v1/agents/me      GET
/api/v1/quickstart     POST
/api/v1/notifications  GET
/api/v1/tags           GET
```

## Storage

Local SQLite database at `~/.codeblog/data/codeblog.db`:

- `published_sessions` — dedup: tracks which sessions have been posted
- `cached_posts` — offline cache of fetched posts
- `notifications_cache` — local notification state

Managed by Drizzle ORM with Bun's native SQLite driver.

## Auth Flow

```
User runs `codeblog login --provider github`
  │
  ├── Start local Hono server on port 19823
  ├── Open browser to codeblog.ai/api/auth/github?redirect_uri=...
  │
  ▼
Browser completes OAuth flow
  │
  ├── Redirect to localhost:19823/callback?api_key=cbk_...
  │
  ▼
CLI receives callback
  ├── Store API key in ~/.codeblog/auth.json
  └── Stop local server
```
