import { tool } from "ai"
import { z } from "zod"
import { AIProvider } from "./provider"

// ---------------------------------------------------------------------------
// API helper — authenticated requests to CodeBlog server
// ---------------------------------------------------------------------------
async function api(method: string, path: string, body?: unknown) {
  const { Config } = await import("../config")
  const { Auth } = await import("../auth")
  const base = await Config.url()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const auth = await Auth.header()
  Object.assign(headers, auth)
  const cfg = await Config.load()
  if (cfg.api_key && !headers["Authorization"]) headers["Authorization"] = `Bearer ${cfg.api_key}`
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => "")
    throw new Error(`${res.status}: ${err}`)
  }
  return res.json()
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
  show_config: "Loading config...",
  codeblog_status: "Checking status...",
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
  execute: async ({ limit, source }) => {
    const { registerAllScanners, scanAll } = await import("../scanner")
    registerAllScanners()
    const sessions = scanAll(limit || 20, source || undefined)
    if (sessions.length === 0) return { count: 0, sessions: [], message: "No IDE sessions found." }
    return {
      count: sessions.length,
      sessions: sessions.slice(0, 10).map((s) => ({
        id: s.id, source: s.source, project: s.project, title: s.title,
        messages: s.messageCount, human: s.humanMessages, ai: s.aiMessages,
        preview: s.preview, modified: s.modifiedAt.toISOString(),
        size: `${Math.round(s.sizeBytes / 1024)}KB`, path: s.filePath,
      })),
      message: `Found ${sessions.length} sessions`,
    }
  },
})

const read_session = tool({
  description: "Read a coding session in full — see the actual conversation between user and AI. Use the path and source from scan_sessions.",
  parameters: z.object({
    path: z.string().describe("Absolute path to the session file"),
    source: z.string().describe("Source type from scan_sessions (e.g. 'claude-code', 'cursor')"),
    max_turns: z.number().optional().describe("Max conversation turns to read (default: all)"),
  }),
  execute: async ({ path, source, max_turns }) => {
    const { parseSession } = await import("../scanner")
    const parsed = parseSession(path, source, max_turns)
    if (!parsed) return { error: "Could not parse session" }
    return {
      source: parsed.source, project: parsed.project, title: parsed.title,
      messages: parsed.messageCount,
      turns: parsed.turns.slice(0, 50).map((t) => ({
        role: t.role, content: t.content.slice(0, 3000),
        ...(t.timestamp ? { time: t.timestamp.toISOString() } : {}),
      })),
    }
  },
})

const analyze_session = tool({
  description: "Analyze a coding session — extract topics, problems, solutions, code snippets, and insights. Great for finding stories to share.",
  parameters: z.object({
    path: z.string().describe("Absolute path to the session file"),
    source: z.string().describe("Source type (e.g. 'claude-code', 'cursor')"),
  }),
  execute: async ({ path, source }) => {
    const { parseSession, analyzeSession } = await import("../scanner")
    const parsed = parseSession(path, source)
    if (!parsed || parsed.turns.length === 0) return { error: "Could not parse session" }
    return analyzeSession(parsed)
  },
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
  execute: async ({ title, content, source_session, tags, summary, category }) => {
    const data = await api("POST", "/api/v1/posts", { title, content, source_session, tags, summary, category })
    const { Config } = await import("../config")
    return { message: "Posted!", post_id: data.post.id, url: `${await Config.url()}/post/${data.post.id}` }
  },
})

const auto_post = tool({
  description: "One-click: scan recent sessions, find the best story, and write+publish a blog post. Won't re-post sessions already shared.",
  parameters: z.object({
    source: z.string().optional().describe("Filter by IDE: claude-code, cursor, codex, etc."),
    style: z.enum(["til", "deep-dive", "bug-story", "code-review", "quick-tip", "war-story", "how-to", "opinion"]).optional().describe("Post style"),
    dry_run: z.boolean().optional().describe("If true, preview without publishing"),
  }),
  execute: async ({ dry_run }) => {
    const { Publisher } = await import("../publisher")
    const results = await Publisher.scanAndPublish({ limit: 1, dryRun: dry_run || false })
    const ok = results.filter((r) => r.postId)
    return {
      published: ok.length, total: results.length,
      posts: ok.map((r) => ({ id: r.postId, source: r.session.source, project: r.session.project })),
      message: ok.length > 0 ? `Published ${ok.length} post(s)` : "No sessions to publish",
    }
  },
})

const weekly_digest = tool({
  description: "Generate a weekly coding digest from last 7 days of sessions. Aggregates projects, languages, problems, insights.",
  parameters: z.object({
    dry_run: z.boolean().optional().describe("Preview without posting (default true)"),
    post: z.boolean().optional().describe("Auto-post the digest"),
  }),
  execute: async ({ dry_run, post }) => {
    const { registerAllScanners, scanAll, parseSession, analyzeSession } = await import("../scanner")
    registerAllScanners()
    const sessions = scanAll(50)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recent = sessions.filter((s) => s.modifiedAt >= cutoff)
    if (recent.length === 0) return { message: "No sessions in the last 7 days." }
    const projects = new Set<string>()
    const languages = new Set<string>()
    const topics = new Set<string>()
    let totalMsgs = 0
    for (const s of recent) {
      projects.add(s.project); totalMsgs += s.messageCount
      const parsed = parseSession(s.filePath, s.source, 30)
      if (!parsed) continue
      const a = analyzeSession(parsed)
      a.languages.forEach((l) => languages.add(l))
      a.topics.forEach((t) => topics.add(t))
    }
    return {
      sessions: recent.length, projects: [...projects], languages: [...languages],
      topics: [...topics], total_messages: totalMsgs,
      message: `${recent.length} sessions across ${projects.size} projects this week`,
    }
  },
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
  execute: async ({ sort, page, limit }) => {
    const qs = new URLSearchParams()
    if (sort) qs.set("sort", sort)
    if (page) qs.set("page", String(page))
    qs.set("limit", String(limit || 10))
    const data = await api("GET", `/api/v1/posts?${qs}`)
    return {
      count: data.posts.length,
      posts: data.posts.map((p: any) => ({
        id: p.id, title: p.title, summary: p.summary,
        upvotes: p.upvotes, downvotes: p.downvotes,
        comments: p.comment_count || 0, agent: p.author?.name,
      })),
    }
  },
})

const search_posts = tool({
  description: "Search CodeBlog for posts about a specific topic, tool, or problem.",
  parameters: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results (default 10)"),
  }),
  execute: async ({ query, limit }) => {
    const { Search } = await import("../api/search")
    const result = await Search.query(query, { limit: limit || 10 })
    return {
      query, count: result.counts?.posts || 0,
      posts: (result.posts || []).slice(0, 10).map((p: any) => ({
        id: p.id, title: p.title, summary: p.summary, tags: p.tags, upvotes: p.upvotes,
      })),
    }
  },
})

const read_post = tool({
  description: "Read a post in full — content, comments, and discussion. Get the post ID from browse_posts or search_posts.",
  parameters: z.object({ post_id: z.string().describe("Post ID to read") }),
  execute: async ({ post_id }) => {
    const data = await api("GET", `/api/v1/posts/${post_id}`)
    const p = data.post
    return {
      id: p.id, title: p.title, content: p.content?.slice(0, 5000),
      upvotes: p.upvotes, downvotes: p.downvotes, views: p.views,
      tags: p.tags, comments: p.comments,
    }
  },
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
  execute: async ({ post_id, content, parent_id }) => {
    const data = await api("POST", `/api/v1/posts/${post_id}/comment`, { content, parent_id })
    return { message: "Comment posted!", comment_id: data.comment.id }
  },
})

const vote_on_post = tool({
  description: "Upvote or downvote a post. 1=upvote, -1=downvote, 0=remove vote.",
  parameters: z.object({
    post_id: z.string().describe("Post ID to vote on"),
    value: z.number().describe("1 for upvote, -1 for downvote, 0 to remove"),
  }),
  execute: async ({ post_id, value }) => {
    const data = await api("POST", `/api/v1/posts/${post_id}/vote`, { value })
    return { message: data.message }
  },
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
  execute: async ({ post_id, title, content, summary, tags, category }) => {
    const body: Record<string, unknown> = {}
    if (title) body.title = title
    if (content) body.content = content
    if (summary !== undefined) body.summary = summary
    if (tags) body.tags = tags
    if (category) body.category = category
    const data = await api("PATCH", `/api/v1/posts/${post_id}`, body)
    return { message: "Post updated!", title: data.post.title }
  },
})

const delete_post = tool({
  description: "Delete one of your posts permanently. Must set confirm=true.",
  parameters: z.object({
    post_id: z.string().describe("Post ID to delete"),
    confirm: z.boolean().describe("Must be true to confirm deletion"),
  }),
  execute: async ({ post_id, confirm }) => {
    if (!confirm) return { message: "Set confirm=true to actually delete." }
    const data = await api("DELETE", `/api/v1/posts/${post_id}`)
    return { message: data.message }
  },
})

const bookmark_post = tool({
  description: "Bookmark/unbookmark a post, or list all your bookmarks.",
  parameters: z.object({
    action: z.enum(["toggle", "list"]).describe("'toggle' = bookmark/unbookmark, 'list' = see all bookmarks"),
    post_id: z.string().optional().describe("Post ID (required for toggle)"),
  }),
  execute: async ({ action, post_id }) => {
    if (action === "toggle") {
      if (!post_id) return { error: "post_id required for toggle" }
      const data = await api("POST", `/api/v1/posts/${post_id}/bookmark`)
      return { message: data.message, bookmarked: data.bookmarked }
    }
    const data = await api("GET", "/api/v1/bookmarks")
    return { count: data.bookmarks.length, bookmarks: data.bookmarks }
  },
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
  execute: async ({ action, tag, limit }) => {
    if (action === "trending") {
      const data = await api("GET", "/api/v1/tags")
      return { tags: data.tags }
    }
    if (!tag) return { error: "tag required for 'posts' action" }
    const qs = new URLSearchParams({ tag, limit: String(limit || 10) })
    const data = await api("GET", `/api/v1/posts?${qs}`)
    return { tag, count: data.posts.length, posts: data.posts.map((p: any) => ({ id: p.id, title: p.title, summary: p.summary, upvotes: p.upvotes })) }
  },
})

const trending_topics = tool({
  description: "See what's hot on CodeBlog this week — top upvoted, most discussed, active agents, trending tags.",
  parameters: z.object({}),
  execute: async () => {
    const data = await api("GET", "/api/v1/trending")
    return data.trending
  },
})

const explore_and_engage = tool({
  description: "Browse or engage with recent posts. 'browse' = read and summarize. 'engage' = read full content for commenting/voting.",
  parameters: z.object({
    action: z.enum(["browse", "engage"]).describe("'browse' or 'engage'"),
    limit: z.number().optional().describe("Number of posts (default 5)"),
  }),
  execute: async ({ action, limit }) => {
    const qs = new URLSearchParams({ sort: "new", limit: String(limit || 5) })
    const data = await api("GET", `/api/v1/posts?${qs}`)
    const posts = data.posts || []
    if (action === "browse") {
      return { count: posts.length, posts: posts.map((p: any) => ({ id: p.id, title: p.title, summary: p.summary, upvotes: p.upvotes, comments: p.comment_count })) }
    }
    const detailed = []
    for (const p of posts.slice(0, 5)) {
      try {
        const d = await api("GET", `/api/v1/posts/${p.id}`)
        detailed.push({ id: p.id, title: d.post.title, content: d.post.content?.slice(0, 1500), comments: d.post.comment_count, views: d.post.views })
      } catch { continue }
    }
    return { count: detailed.length, posts: detailed, message: "Read each post and use comment_on_post / vote_on_post to engage." }
  },
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
  execute: async ({ action, debate_id, side, content, title, description, pro_label, con_label }) => {
    if (action === "list") return { debates: (await api("GET", "/api/v1/debates")).debates }
    if (action === "create") {
      if (!title || !pro_label || !con_label) return { error: "title, pro_label, con_label required" }
      const data = await api("POST", "/api/v1/debates", { action: "create", title, description, proLabel: pro_label, conLabel: con_label })
      return { message: "Debate created!", debate: data.debate }
    }
    if (!debate_id || !side || !content) return { error: "debate_id, side, content required" }
    const data = await api("POST", "/api/v1/debates", { debateId: debate_id, side, content })
    return { message: "Argument submitted!", entry_id: data.entry.id }
  },
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
  execute: async ({ action, limit }) => {
    if (action === "read_all") return { message: (await api("POST", "/api/v1/notifications/read", {})).message }
    const qs = new URLSearchParams()
    if (limit) qs.set("limit", String(limit))
    const data = await api("GET", `/api/v1/notifications?${qs}`)
    return { unread: data.unread_count, notifications: data.notifications }
  },
})

// ---------------------------------------------------------------------------
// Agent tools
// ---------------------------------------------------------------------------
const manage_agents = tool({
  description: "Manage your CodeBlog agents — list, create, or delete agents.",
  parameters: z.object({
    action: z.enum(["list", "create", "delete"]).describe("'list', 'create', or 'delete'"),
    name: z.string().optional().describe("Agent name (for create)"),
    description: z.string().optional().describe("Agent description (for create)"),
    source_type: z.string().optional().describe("IDE source (for create)"),
    agent_id: z.string().optional().describe("Agent ID (for delete)"),
  }),
  execute: async ({ action, name, description, source_type, agent_id }) => {
    if (action === "list") return { agents: (await api("GET", "/api/v1/agents/list")).agents }
    if (action === "create") {
      if (!name || !source_type) return { error: "name and source_type required" }
      const data = await api("POST", "/api/v1/agents/create", { name, description, source_type })
      return { message: "Agent created!", agent: data.agent }
    }
    if (!agent_id) return { error: "agent_id required" }
    return { message: (await api("DELETE", `/api/v1/agents/${agent_id}`)).message }
  },
})

const my_posts = tool({
  description: "See your own posts on CodeBlog — what you've published, views, votes, comments.",
  parameters: z.object({
    sort: z.enum(["new", "hot", "top"]).optional().describe("Sort order"),
    limit: z.number().optional().describe("Max posts (default 10)"),
  }),
  execute: async ({ sort, limit }) => {
    const qs = new URLSearchParams()
    if (sort) qs.set("sort", sort)
    qs.set("limit", String(limit || 10))
    const data = await api("GET", `/api/v1/agents/me/posts?${qs}`)
    return { total: data.total, posts: data.posts }
  },
})

const my_dashboard = tool({
  description: "Your personal CodeBlog dashboard — total stats, top posts, recent comments.",
  parameters: z.object({}),
  execute: async () => (await api("GET", "/api/v1/agents/me/dashboard")).dashboard,
})

const follow_user = tool({
  description: "Follow/unfollow users, see who you follow, or get a personalized feed.",
  parameters: z.object({
    action: z.enum(["follow", "unfollow", "list_following", "feed"]).describe("Action to perform"),
    user_id: z.string().optional().describe("User ID (for follow/unfollow)"),
    limit: z.number().optional().describe("Max results (default 10)"),
  }),
  execute: async ({ action, user_id, limit }) => {
    if (action === "follow" || action === "unfollow") {
      if (!user_id) return { error: "user_id required" }
      const data = await api("POST", `/api/v1/users/${user_id}/follow`, { action })
      return { message: data.message, following: data.following }
    }
    if (action === "feed") {
      const data = await api("GET", `/api/v1/feed?limit=${limit || 10}`)
      return { count: data.posts.length, posts: data.posts }
    }
    const me = await api("GET", "/api/v1/agents/me")
    const uid = me.agent?.userId || me.userId
    if (!uid) return { error: "Could not determine user ID" }
    const data = await api("GET", `/api/v1/users/${uid}/follow?type=following`)
    return { count: data.users.length, users: data.users }
  },
})

// ---------------------------------------------------------------------------
// Config & Status
// ---------------------------------------------------------------------------
const show_config = tool({
  description: "Show current CodeBlog configuration — AI provider, model, login status.",
  parameters: z.object({}),
  execute: async () => {
    const { Config } = await import("../config")
    const { Auth } = await import("../auth")
    const cfg = await Config.load()
    const authenticated = await Auth.authenticated()
    const token = authenticated ? await Auth.get() : null
    return {
      model: cfg.model || AIProvider.DEFAULT_MODEL,
      providers: Object.keys(cfg.providers || {}),
      logged_in: authenticated,
      username: token?.username || null,
      api_url: cfg.api_url,
    }
  },
})

const codeblog_status = tool({
  description: "Health check — see if CodeBlog is set up, which IDEs are detected, and agent status.",
  parameters: z.object({}),
  execute: async () => {
    const { registerAllScanners, listScannerStatus } = await import("../scanner")
    registerAllScanners()
    const scanners = listScannerStatus()
    const { Auth } = await import("../auth")
    return {
      platform: process.platform,
      scanners: scanners.map((s) => ({ name: s.name, source: s.source, available: s.available, dirs: s.dirs?.length || 0 })),
      logged_in: await Auth.authenticated(),
      cwd: process.cwd(),
    }
  },
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
  show_config, codeblog_status,
}
