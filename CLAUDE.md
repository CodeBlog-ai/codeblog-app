# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## 项目概述

CodeBlog App 是 CodeBlog 论坛的 **CLI / TUI 客户端**，用 Bun + SolidJS 构建。用户可以在终端中浏览论坛、AI 聊天、扫描 IDE 会话并发布帖子。

## 仓库协同

CodeBlog 由两个仓库组成：

| 仓库 | 本地路径 | 说明 |
|------|---------|------|
| `codeblog` | `/Users/zhaoyifei/VibeCodingWork/codeblog` | Next.js 16 Web 论坛 + MCP 服务器（后端 + 前端） |
| `codeblog-app` | `/Users/zhaoyifei/VibeCodingWork/codeblog-app` | CLI/TUI 客户端（本仓库） |

- 本仓库通过 HTTP 调用 `codeblog` 的 `/api/v1/*` 端点
- Agent 认证：`Authorization: Bearer cbk_...`
- 用户认证：JWT cookie（通过 OAuth 登录获取）
- 修改 API 接口时需要同步两个仓库

## Monorepo 结构

```
codeblog-app/
├── packages/
│   ├── codeblog/          # 主包：CLI + TUI + AI + Scanner
│   │   ├── src/
│   │   │   ├── index.ts   # 入口：yargs CLI，无参数时启动 TUI
│   │   │   ├── cli/cmd/   # 30 个 CLI 子命令（feed, post, login, scan...）
│   │   │   ├── tui/       # 终端 UI（@opentui/solid + SolidJS）
│   │   │   ├── ai/        # AI 聊天（Vercel AI SDK，多 provider）
│   │   │   ├── scanner/   # 9 个 IDE 扫描器（claude-code, cursor, windsurf...）
│   │   │   ├── auth/      # OAuth 登录 + token 管理
│   │   │   ├── api/       # HTTP 客户端（调用 codeblog 后端 API）
│   │   │   ├── storage/   # 本地 SQLite 存储（聊天历史等）
│   │   │   └── config/    # 用户配置（~/.codeblog/）
│   │   ├── bin/codeblog   # npm bin 入口（找预编译二进制或 bun fallback）
│   │   ├── bunfig.toml    # Bun preload 配置（不要删除！）
│   │   └── tsconfig.json  # jsx: preserve + jsxImportSource: solid-js
│   ├── sdk/               # @codeblog-ai/sdk — API 类型定义 + 客户端
│   └── util/              # @codeblog-ai/util — 通用工具函数
├── scripts/               # build, clean, release 脚本
├── turbo.json             # Turborepo 配置
└── package.json           # workspace root
```

## 常用命令

```bash
bun install                  # 安装依赖
bun run dev                  # 启动 TUI（--watch 热重载，改代码自动重启）
bun run dev -- --help        # 查看 CLI 帮助
bun run dev -- feed          # 直接运行 CLI 子命令
bun run dev -- tui           # 显式启动 TUI
bun run build                # 构建发布二进制
bun run typecheck            # 类型检查（turbo）
```

### 测试

```bash
cd packages/codeblog && bun test       # 主包测试
cd packages/util && bun test           # 工具包测试
```

## 关键技术栈

| 层 | 技术 |
|----|------|
| 运行时 | Bun 1.3.9 |
| CLI 框架 | yargs 18 |
| TUI 渲染 | @opentui/solid + @opentui/core（SolidJS 终端渲染器） |
| 响应式 | SolidJS 1.9（信号、Store、JSX） |
| AI | Vercel AI SDK 6（streamText、tool use，支持 20+ provider） |
| 数据库 | bun:sqlite + Drizzle ORM（本地 `~/.local/share/codeblog/codeblog.db`） |
| IDE 扫描 | 自定义 Scanner 接口（9 个 IDE：claude-code、cursor、windsurf、codex...） |
| 构建 | Bun 单文件编译（跨平台 binary） |

## 开发注意事项

### bunfig.toml（不要删除）

`packages/codeblog/bunfig.toml` 配置了 `@opentui/solid/preload` Bun 插件。这是 TUI 能运行的**必要条件**：
- Bun 1.x 忽略 `jsxImportSource`，始终把 JSX 编译为 `React.createElement()`
- 此插件用 Babel + `babel-preset-solid` 正确编译 JSX 为 `@opentui/solid` 调用
- 同时把 `solid-js/dist/server.js` 重定向到 `solid-js/dist/solid.js`

### TUI 开发

- TUI 必须在**交互式终端**中运行（Terminal.app / iTerm2 / Warp / VSCode Terminal 面板）
- TUI 入口：`src/tui/app.tsx`，使用 `@opentui/solid` 的 `render()` 全屏接管终端
- 路由：`src/tui/context/route.tsx`（SolidJS Store 驱动）
- 主题：`src/tui/context/theme.tsx`（13 个内置主题，存储在 `~/.config/codeblog/theme.json`）
- `--watch` 模式下改文件会自动重启整个进程并重新渲染 TUI

### CLI 命令

- 每个子命令在 `src/cli/cmd/` 下一个文件
- 格式：导出 yargs CommandModule（`export const XxxCommand = { ... }`）
- 在 `src/index.ts` 中注册：`.command(XxxCommand)`

### AI 集成

- 多 provider 支持（OpenAI、Anthropic、Google、Groq、xAI 等 20+）
- 配置存储在 `~/.codeblog/config.json`
- **工具动态发现**：`src/ai/tools.ts` 的 `getChatTools()` 在运行时调用 MCP 服务器的 `listTools()` 自动获取所有工具定义（名称、描述、参数 schema），无需手动维护工具列表
- `TOOL_LABELS`（同文件）是 TUI 中工具执行时的显示文案，作为静态 fallback 保留。新工具未配置 label 时会 fallback 显示工具名
- 工具通过 Vercel AI SDK 的 `jsonSchema()` 包装 MCP 返回的 JSON Schema，再传给 `streamText()`

### Scanner（IDE 扫描器）

- 9 个扫描器在 `src/scanner/` 下，每个实现 `Scanner` 接口
- 通过 `src/scanner/registry.ts` 注册
- `src/scanner/analyzer.ts` 分析扫描结果生成摘要

## MCP 工具维护规范

**MCP 工具（新增/修改/删除）只需要改 `codeblog` 仓库的 `mcp-server/src/tools/`，本仓库不需要任何代码改动。**

CLI 通过 `getChatTools()` 在运行时调用 MCP 的 `listTools()` 动态发现所有工具。工具的名称、描述、参数 schema 全部来自 MCP 服务器，不在本仓库维护。

### 什么时候需要改本仓库

- MCP 工具相关：**不需要改**（自动发现）
- 可选：在 `src/ai/tools.ts` 的 `TOOL_LABELS` 中为新工具添加 TUI 显示文案（不加也能正常工作）
- API 接口变更（`/api/v1/*`）：需要同步改 `src/api/` 下的 HTTP 客户端
- CLI 命令、TUI 界面、AI 提示词等：正常在本仓库改

## ⚠️ 发布工作流（必须遵守）

CodeBlog 由两个仓库组成，发布有严格的先后顺序。**每次完成功能开发后，必须检查并执行发布流程。**

### 仓库关系

| 仓库 | 本地路径 | npm 包名 |
|------|---------|----------|
| `codeblog` | `/Users/zhaoyifei/VibeCodingWork/codeblog` | `codeblog-mcp`（MCP 服务器） |
| `codeblog-app` | `/Users/zhaoyifei/VibeCodingWork/codeblog-app` | `codeblog-app` + 5 个平台二进制包 |

### 发布顺序（必须按此顺序）

1. **MCP 服务器先发布**（`codeblog` 仓库）
   ```bash
   cd /Users/zhaoyifei/VibeCodingWork/codeblog/mcp-server
   # 更新 version → npm run build → npm publish --access public
   npm view codeblog-mcp version  # 验证
   ```

2. **CLI 客户端后发布**（本仓库）
   ```bash
   cd packages/codeblog
   # 1. 更新 package.json version
   # 2. 构建 5 个平台二进制 + 发布（一条命令）
   bun run script/build.ts --publish
   # 3. 清理构建产物
   rm -rf dist/
   # 4. 恢复 bun.lock
   cd ../.. && git checkout -- bun.lock
   ```
   发布后验证：`npm view codeblog-app version`

3. **验证 curl 安装**
   ```bash
   curl -fsSL https://registry.npmjs.org/codeblog-app/latest | grep -o '"version":"[^"]*"'
   ```

### 5 个平台二进制包

CLI 通过 `curl -fsSL https://codeblog.ai/install.sh | bash` 安装，依赖以下 npm 平台包：

- `codeblog-app-darwin-arm64`（macOS Apple Silicon）
- `codeblog-app-darwin-x64`（macOS Intel）
- `codeblog-app-linux-arm64`（Linux ARM64）
- `codeblog-app-linux-x64`（Linux x64）
- `codeblog-app-windows-x64`（Windows x64）

**由 `bun run script/build.ts --publish` 一并构建和发布，不要遗漏。**

### 完成工作后的检查清单

- [ ] 如果 `codeblog` 仓库的 MCP 有改动 → 先发布 `codeblog-mcp`
- [ ] 如果 MCP 只是新增/修改工具 → CLI 自动发现，**不需要发布本仓库**
- [ ] 如果 MCP 有 breaking change（如 SDK 大版本升级）或本仓库有改动 → 发布本仓库
- [ ] 发布本仓库时 → 必须构建 5 个平台二进制并一起发布
- [ ] 验证 `npm view codeblog-app version` 版本号正确
- [ ] 验证 curl 安装脚本能获取到最新版本
- [ ] 清理本地 `dist/`，恢复 `bun.lock`
