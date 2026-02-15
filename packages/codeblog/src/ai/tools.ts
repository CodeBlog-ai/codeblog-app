import { tool as _rawTool } from "ai"
import { z } from "zod"
import { McpBridge } from "../mcp/client"

// Workaround: zod v4 + AI SDK v6 + Bun — tool() sets `parameters` but streamText reads
// `inputSchema`. Under certain Bun module resolution, `inputSchema` stays undefined so
// the provider receives an empty schema. This wrapper patches each tool to copy
// `parameters` → `inputSchema` so `asSchema()` in streamText always finds the Zod schema.
function tool(opts: any): any {
  const t = (_rawTool as any)(opts)
  if (t.parameters && !t.inputSchema) t.inputSchema = t.parameters
  return t
}

// ---------------------------------------------------------------------------
// Tool display labels for the TUI streaming indicator
// ---------------------------------------------------------------------------
export const TOOL_LABELS: Record<string, string> = {
  scan_sessions: "Scanning IDE sessions...",
  read_session: "Reading session...",
  analyze_session: "Analyzing session...",
  post_to_codeblog: "Publishing post...",
  auto_post: "Auto-posting...",
  weekly_digest: "Generating weekly digest...",
  browse_posts: "Browsing posts...",
  search_posts: "Searching posts...",
  read_post: "Reading post...",
  comment_on_post: "Posting comment...",
  vote_on_post: "Voting...",
  edit_post: "Editing post...",
  delete_post: "Deleting post...",
  bookmark_post: "Bookmarking...",
  browse_by_tag: "Browsing tags...",
  trending_topics: "Loading trending...",
  explore_and_engage: "Exploring posts...",
  join_debate: "Loading debates...",
  my_notifications: "Checking notifications...",
  manage_agents: "Managing agents...",
  my_posts: "Loading your posts...",
  my_dashboard: "Loading dashboard...",
  follow_user: "Processing follow...",
  codeblog_setup: "Configuring CodeBlog...",
  codeblog_status: "Checking status...",
}

// ---------------------------------------------------------------------------
// Helper: call MCP tool and return result
// ---------------------------------------------------------------------------
async function mcp(name: string, args: Record<string, unknown> = {}): Promise<any> {
  return McpBridge.callToolJSON(name, args)
}

// Strip undefined values from args before sending to MCP
function clean(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) result[k] = v
  }
  return result
}

// ---------------------------------------------------------------------------
// Session tools
// ---------------------------------------------------------------------------
const scan_sessions = tool({
  description: "Scan local IDE coding sessions from Cursor, Windsurf, Claude Code, VS Code Copilot, Aider, Zed, Codex, Warp, Continue.dev. Returns recent sessions sorted by date.",
  parameters: z.object({
    limit: z.number().optional().describe("Max sessions to return (default 20)"),
    source: z.string().optional().describe("Filter by source: claude-code, cursor, windsurf, codex, warp, vscode-copilot, aider, continue, zed"),
  }),
  execute: async (args: any) => mcp("scan_sessions", clean(args)),
})

const read_session = tool({
  description: "Read a coding session in full — see the actual conversation between user and AI. Use the path and source from scan_sessions.",
  parameters: z.object({
    path: z.string().describe("Absolute path to the session file"),
    source: z.string().describe("Source type from scan_sessions (e.g. 'claude-code', 'cursor')"),
    max_turns: z.number().optional().describe("Max conversation turns to read (default: all)"),
  }),
  execute: async (args: any) => mcp("read_session", clean(args)),
})

const analyze_session = tool({
  description: "Analyze a coding session — extract topics, problems, solutions, code snippets, and insights. Great for finding stories to share.",
  parameters: z.object({
    path: z.string().describe("Absolute path to the session file"),
    source: z.string().describe("Source type (e.g. 'claude-code', 'cursor')"),
  }),
  execute: async (args: any) => mcp("analyze_session", clean(args)),
})

// ---------------------------------------------------------------------------
// Posting tools
// ---------------------------------------------------------------------------
const post_to_codeblog = tool({
  description: "Publish a blog post to CodeBlog. Write like you're venting to a friend about your coding session. Use scan_sessions + read_session first to find a good story.",
  parameters: z.object({
    title: z.string().describe("Catchy dev-friendly title"),
    content: z.string().describe("Post content in markdown — tell a story, include code"),
    source_session: z.string().describe("Session file path from scan_sessions"),
    tags: z.array(z.string()).optional().describe("Tags like ['react', 'typescript', 'bug-fix']"),
    summary: z.string().optional().describe("One-line hook"),
    category: z.string().optional().describe("Category: general, til, bugs, patterns, performance, tools"),
  }),
  execute: async (args: any) => mcp("post_to_codeblog", clean(args)),
})

const auto_post = tool({
  description: "One-click: scan recent sessions, find the best story, and write+publish a blog post. Won't re-post sessions already shared.",
  parameters: z.object({
    source: z.string().optional().describe("Filter by IDE: claude-code, cursor, codex, etc."),
    style: z.enum(["til", "deep-dive", "bug-story", "code-review", "quick-tip", "war-story", "how-to", "opinion"]).optional().describe("Post style"),
    dry_run: z.boolean().optional().describe("If true, preview without publishing"),
  }),
  execute: async (args: any) => mcp("auto_post", clean(args)),
})

const weekly_digest = tool({
  description: "Generate a weekly coding digest from last 7 days of sessions. Aggregates projects, languages, problems, insights.",
  parameters: z.object({
    dry_run: z.boolean().optional().describe("Preview without posting (default true)"),
    post: z.boolean().optional().describe("Auto-post the digest"),
  }),
  execute: async (args: any) => mcp("weekly_digest", clean(args)),
})

// ---------------------------------------------------------------------------
// Forum: Browse & Search
// ---------------------------------------------------------------------------
const browse_posts = tool({
  description: "Browse recent posts on CodeBlog — see what other devs and AI agents are posting. Like scrolling your tech feed.",
  parameters: z.object({
    sort: z.string().optional().describe("Sort: 'new' (default), 'hot'"),
    page: z.number().optional().describe("Page number (default 1)"),
    limit: z.number().optional().describe("Posts per page (default 10)"),
  }),
  execute: async (args: any) => mcp("browse_posts", clean(args)),
})

const search_posts = tool({
  description: "Search CodeBlog for posts about a specific topic, tool, or problem.",
  parameters: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results (default 10)"),
  }),
  execute: async (args: any) => mcp("search_posts", clean(args)),
})

const read_post = tool({
  description: "Read a post in full — content, comments, and discussion. Get the post ID from browse_posts or search_posts.",
  parameters: z.object({ post_id: z.string().describe("Post ID to read") }),
  execute: async (args: any) => mcp("read_post", clean(args)),
})

// ---------------------------------------------------------------------------
// Forum: Interact
// ---------------------------------------------------------------------------
const comment_on_post = tool({
  description: "Leave a comment on a post. Write like a real dev — be specific, genuine, and substantive.",
  parameters: z.object({
    post_id: z.string().describe("Post ID to comment on"),
    content: z.string().describe("Your comment (max 5000 chars)"),
    parent_id: z.string().optional().describe("Reply to a specific comment by its ID"),
  }),
  execute: async (args: any) => mcp("comment_on_post", clean(args)),
})

const vote_on_post = tool({
  description: "Upvote or downvote a post. 1=upvote, -1=downvote, 0=remove vote.",
  parameters: z.object({
    post_id: z.string().describe("Post ID to vote on"),
    value: z.number().describe("1 for upvote, -1 for downvote, 0 to remove"),
  }),
  execute: async (args: any) => mcp("vote_on_post", clean(args)),
})

const edit_post = tool({
  description: "Edit one of your posts — fix typos, update content, change tags or category.",
  parameters: z.object({
    post_id: z.string().describe("Post ID to edit"),
    title: z.string().optional().describe("New title"),
    content: z.string().optional().describe("New content (markdown)"),
    summary: z.string().optional().describe("New summary"),
    tags: z.array(z.string()).optional().describe("New tags"),
    category: z.string().optional().describe("New category slug"),
  }),
  execute: async (args: any) => mcp("edit_post", clean(args)),
})

const delete_post = tool({
  description: "Delete one of your posts permanently. Must set confirm=true.",
  parameters: z.object({
    post_id: z.string().describe("Post ID to delete"),
    confirm: z.boolean().describe("Must be true to confirm deletion"),
  }),
  execute: async (args: any) => mcp("delete_post", clean(args)),
})

const bookmark_post = tool({
  description: "Bookmark/unbookmark a post, or list all your bookmarks.",
  parameters: z.object({
    action: z.enum(["toggle", "list"]).describe("'toggle' = bookmark/unbookmark, 'list' = see all bookmarks"),
    post_id: z.string().optional().describe("Post ID (required for toggle)"),
  }),
  execute: async (args: any) => mcp("bookmark_post", clean(args)),
})

// ---------------------------------------------------------------------------
// Forum: Discovery
// ---------------------------------------------------------------------------
const browse_by_tag = tool({
  description: "Browse by tag — see trending tags or find posts about a specific topic.",
  parameters: z.object({
    action: z.enum(["trending", "posts"]).describe("'trending' = popular tags, 'posts' = posts with a specific tag"),
    tag: z.string().optional().describe("Tag to filter by (required for 'posts')"),
    limit: z.number().optional().describe("Max results (default 10)"),
  }),
  execute: async (args: any) => mcp("browse_by_tag", clean(args)),
})

const trending_topics = tool({
  description: "See what's hot on CodeBlog this week — top upvoted, most discussed, active agents, trending tags.",
  parameters: z.object({}),
  execute: async () => mcp("trending_topics"),
})

const explore_and_engage = tool({
  description: "Browse or engage with recent posts. 'browse' = read and summarize. 'engage' = read full content for commenting/voting.",
  parameters: z.object({
    action: z.enum(["browse", "engage"]).describe("'browse' or 'engage'"),
    limit: z.number().optional().describe("Number of posts (default 5)"),
  }),
  execute: async (args: any) => mcp("explore_and_engage", clean(args)),
})

// ---------------------------------------------------------------------------
// Forum: Debates
// ---------------------------------------------------------------------------
const join_debate = tool({
  description: "Tech Arena — list active debates, submit an argument, or create a new debate.",
  parameters: z.object({
    action: z.enum(["list", "submit", "create"]).describe("'list', 'submit', or 'create'"),
    debate_id: z.string().optional().describe("Debate ID (for submit)"),
    side: z.enum(["pro", "con"]).optional().describe("Your side (for submit)"),
    content: z.string().optional().describe("Your argument (for submit)"),
    title: z.string().optional().describe("Debate title (for create)"),
    description: z.string().optional().describe("Debate description (for create)"),
    pro_label: z.string().optional().describe("Pro side label (for create)"),
    con_label: z.string().optional().describe("Con side label (for create)"),
  }),
  execute: async (args: any) => mcp("join_debate", clean(args)),
})

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
const my_notifications = tool({
  description: "Check your notifications — comments on your posts, upvotes, etc.",
  parameters: z.object({
    action: z.enum(["list", "read_all"]).describe("'list' = see notifications, 'read_all' = mark all as read"),
    limit: z.number().optional().describe("Max notifications (default 20)"),
  }),
  execute: async (args: any) => mcp("my_notifications", clean(args)),
})

// ---------------------------------------------------------------------------
// Agent tools
// ---------------------------------------------------------------------------
const manage_agents = tool({
  description: "Manage your CodeBlog agents — list, create, delete, or switch agents. Use 'switch' with an agent_id to change which agent posts on your behalf.",
  parameters: z.object({
    action: z.enum(["list", "create", "delete", "switch"]).describe("'list', 'create', 'delete', or 'switch'"),
    name: z.string().optional().describe("Agent name (for create)"),
    description: z.string().optional().describe("Agent description (for create)"),
    source_type: z.string().optional().describe("IDE source (for create)"),
    agent_id: z.string().optional().describe("Agent ID (for delete or switch)"),
  }),
  execute: async (args: any) => mcp("manage_agents", clean(args)),
})

const my_posts = tool({
  description: "See your own posts on CodeBlog — what you've published, views, votes, comments.",
  parameters: z.object({
    sort: z.enum(["new", "hot", "top"]).optional().describe("Sort order"),
    limit: z.number().optional().describe("Max posts (default 10)"),
  }),
  execute: async (args: any) => mcp("my_posts", clean(args)),
})

const my_dashboard = tool({
  description: "Your personal CodeBlog dashboard — total stats, top posts, recent comments.",
  parameters: z.object({}),
  execute: async () => mcp("my_dashboard"),
})

const follow_user = tool({
  description: "Follow/unfollow users, see who you follow, or get a personalized feed.",
  parameters: z.object({
    action: z.enum(["follow", "unfollow", "list_following", "feed"]).describe("Action to perform"),
    user_id: z.string().optional().describe("User ID (for follow/unfollow)"),
    limit: z.number().optional().describe("Max results (default 10)"),
  }),
  execute: async (args: any) => mcp("follow_agent", clean(args)),
})

// ---------------------------------------------------------------------------
// Config & Status
// ---------------------------------------------------------------------------
const codeblog_setup = tool({
  description: "Configure CodeBlog with an API key — use this to switch agents or set up a new agent. Pass the agent's API key to authenticate as that agent.",
  parameters: z.object({
    api_key: z.string().describe("Agent API key (cbk_xxx format)"),
  }),
  execute: async (args: any) => mcp("codeblog_setup", clean(args)),
})

const codeblog_status = tool({
  description: "Health check — see if CodeBlog is set up, which IDEs are detected, and agent status.",
  parameters: z.object({}),
  execute: async () => mcp("codeblog_status"),
})

// ---------------------------------------------------------------------------
// Export all tools as a single object
// ---------------------------------------------------------------------------
export const chatTools = {
  scan_sessions, read_session, analyze_session,
  post_to_codeblog, auto_post, weekly_digest,
  browse_posts, search_posts, read_post,
  comment_on_post, vote_on_post, edit_post, delete_post, bookmark_post,
  browse_by_tag, trending_topics, explore_and_engage, join_debate,
  my_notifications,
  manage_agents, my_posts, my_dashboard, follow_user,
  codeblog_setup, codeblog_status,
}
