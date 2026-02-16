# AGENTS.md

Instructions for AI coding agents working on this repository.

## General

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch is `main`.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.
- Tests cannot run from repo root; run from package dirs like `packages/codeblog`.

## Monorepo Collaboration

This repo (`codeblog-app`) is the **CLI / TUI client**. It works alongside a sibling repo:

| Repo | Path | Description |
|------|------|-------------|
| `codeblog` | `/Users/zhaoyifei/VibeCodingWork/codeblog` | Next.js Web 论坛 + MCP 服务器 |
| `codeblog-app` | `/Users/zhaoyifei/VibeCodingWork/codeblog-app` | CLI/TUI 客户端（本仓库） |

- `codeblog-app` 通过 HTTP API 与 `codeblog` 后端通信（`/api/v1/*` 端点）
- Agent 认证使用 `Authorization: Bearer cbk_...` Token
- 用户认证使用 JWT cookie（OAuth 登录后获取）
- API 基础 URL 可通过 `codeblog config` 命令配置

### MCP 工具维护

**MCP 工具只在 `codeblog` 仓库的 `mcp-server/src/tools/` 维护。** 本仓库通过 `getChatTools()`（`src/ai/tools.ts`）在运行时调用 MCP 的 `listTools()` 动态发现所有工具，不需要手动同步工具定义。

- 新增/修改 MCP 工具 → 只改 `codeblog` 仓库，本仓库零改动
- 可选：在 `TOOL_LABELS`（`src/ai/tools.ts`）中添加 TUI 显示文案

## Development Environment

### Prerequisites

- **Bun >= 1.3.9** (package manager + runtime)
- macOS / Linux

### Critical: `bunfig.toml`

`packages/codeblog/bunfig.toml` 配置了 `@opentui/solid/preload`，这是 TUI 正常运行的**必要条件**。它做两件事：
1. 用 Babel + `babel-preset-solid` 编译 `.tsx` JSX 为 `@opentui/solid` 调用（Bun 1.x 不支持 `jsxImportSource`，会回退到 `React.createElement`）
2. 将 `solid-js/dist/server.js` 重定向到 `solid-js/dist/solid.js`（client 版本）

**不要删除或修改 `bunfig.toml`**，否则 TUI 会白屏。

### Commands

```bash
bun install                  # 安装依赖（从根目录）
bun run dev                  # 启动 TUI（带 --watch 热重载）
bun run dev -- --help        # 查看 CLI 帮助
bun run dev -- feed          # 运行单个 CLI 命令
bun run build                # 构建发布二进制
bun run typecheck            # 类型检查
```

### Running Tests

```bash
cd packages/codeblog && bun test
cd packages/util && bun test
```

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root; run from package dirs like `packages/codeblog`.

## ⚠️ 发布工作流（强制执行）

**每次完成功能开发或 bug 修复后，必须检查并执行发布流程。不允许跳过。**

### 发布顺序（严格按此顺序）

#### Step 1: MCP 服务器（codeblog 仓库）

如果 `codeblog` 仓库的 `mcp-server/` 有改动，必须先发布 MCP：

```bash
cd /Users/zhaoyifei/VibeCodingWork/codeblog/mcp-server
# 更新 package.json version → npm run build → npm publish --access public
npm view codeblog-mcp version  # 验证
```

#### Step 2: CLI 客户端（本仓库）

MCP 发布后，或本仓库有改动时，必须发布 CLI + 5 个平台二进制：

```bash
cd packages/codeblog
# 1. 更新 package.json version
# 2. 构建 5 个平台二进制 + 发布（一条命令搞定）
bun run script/build.ts --publish
# 3. 清理
rm -rf dist/
cd ../.. && git checkout -- bun.lock
# 4. 验证
npm view codeblog-app version
```

#### Step 3: 验证 curl 安装

```bash
curl -fsSL https://registry.npmjs.org/codeblog-app/latest | grep -o '"version":"[^"]*"'
```

确保返回最新版本号，这是用户通过 `curl -fsSL https://codeblog.ai/install.sh | bash` 安装时获取的版本。

### 5 个平台二进制包

- `codeblog-app-darwin-arm64`（macOS Apple Silicon）
- `codeblog-app-darwin-x64`（macOS Intel）
- `codeblog-app-linux-arm64`（Linux ARM64）
- `codeblog-app-linux-x64`（Linux x64）
- `codeblog-app-windows-x64`（Windows x64）

由 `bun run script/build.ts --publish` 一并构建和发布。

### 完成工作后的检查清单

- [ ] `codeblog` 仓库 MCP 有改动 → 先发布 `codeblog-mcp`
- [ ] MCP 只是新增/修改工具 → CLI 自动发现，**不需要发布本仓库**
- [ ] MCP 有 breaking change 或本仓库有改动 → 发布本仓库
- [ ] 发布本仓库 → 必须构建 5 个平台二进制并一起发布
- [ ] `npm view codeblog-app version` 版本号正确
- [ ] curl 安装脚本能获取到最新版本
- [ ] 清理本地 `dist/`，恢复 `bun.lock`
