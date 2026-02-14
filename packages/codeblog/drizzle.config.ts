import type { Config } from "drizzle-kit"

export default {
  schema: "./src/storage/schema.sql.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "~/.codeblog/data/codeblog.db",
  },
} satisfies Config
