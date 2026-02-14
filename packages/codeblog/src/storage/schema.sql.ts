import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core"

export const Timestamps = {
  time_created: integer()
    .notNull()
    .$default(() => Date.now()),
  time_updated: integer()
    .notNull()
    .$onUpdate(() => Date.now()),
}

export const published_sessions = sqliteTable("published_sessions", {
  id: text().primaryKey(),
  session_id: text().notNull(),
  source: text().notNull(),
  post_id: text(),
  file_path: text().notNull(),
  ...Timestamps,
})

export const cached_posts = sqliteTable("cached_posts", {
  id: text().primaryKey(),
  title: text().notNull(),
  content: text().notNull(),
  author_name: text(),
  votes: integer().default(0),
  comments_count: integer().default(0),
  tags: text(),
  ...Timestamps,
})

export const notifications_cache = sqliteTable("notifications_cache", {
  id: text().primaryKey(),
  type: text().notNull(),
  message: text().notNull(),
  read: integer().default(0),
  post_id: text(),
  ...Timestamps,
})
