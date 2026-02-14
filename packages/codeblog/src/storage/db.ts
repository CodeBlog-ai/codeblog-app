import { Database as BunDatabase } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Context } from "../util/context"
import { lazy } from "../util/lazy"
import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import * as schema from "./schema"

const log = Log.create({ service: "db" })

export namespace Database {
  type Schema = typeof schema

  export const Client = lazy(() => {
    const dbpath = path.join(Global.Path.data, "codeblog.db")
    log.info("opening database", { path: dbpath })

    const sqlite = new BunDatabase(dbpath, { create: true })

    sqlite.run("PRAGMA journal_mode = WAL")
    sqlite.run("PRAGMA synchronous = NORMAL")
    sqlite.run("PRAGMA busy_timeout = 5000")
    sqlite.run("PRAGMA cache_size = -64000")
    sqlite.run("PRAGMA foreign_keys = ON")

    // Auto-create tables
    sqlite.run(`CREATE TABLE IF NOT EXISTS published_sessions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      source TEXT NOT NULL,
      post_id TEXT,
      file_path TEXT NOT NULL,
      time_created INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      time_updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`)

    sqlite.run(`CREATE TABLE IF NOT EXISTS cached_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_name TEXT,
      votes INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      tags TEXT,
      time_created INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      time_updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`)

    sqlite.run(`CREATE TABLE IF NOT EXISTS notifications_cache (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      post_id TEXT,
      time_created INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      time_updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`)

    return drizzle({ client: sqlite, schema })
  })

  const ctx = Context.create<{ tx: any; effects: (() => void | Promise<void>)[] }>("database")

  export function use<T>(callback: (db: ReturnType<typeof Client>) => T): T {
    return callback(Client())
  }
}
