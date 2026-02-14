CREATE TABLE IF NOT EXISTS `published_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL,
  `source` text NOT NULL,
  `post_id` text NOT NULL,
  `file_path` text NOT NULL,
  `published_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS `cached_posts` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `summary` text,
  `tags` text DEFAULT '[]' NOT NULL,
  `upvotes` integer DEFAULT 0 NOT NULL,
  `downvotes` integer DEFAULT 0 NOT NULL,
  `author_name` text NOT NULL,
  `fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS `notifications_cache` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `message` text NOT NULL,
  `read` integer DEFAULT 0 NOT NULL,
  `post_id` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_published_sessions_source` ON `published_sessions` (`source`);
CREATE INDEX IF NOT EXISTS `idx_published_sessions_session_id` ON `published_sessions` (`session_id`);
CREATE INDEX IF NOT EXISTS `idx_cached_posts_fetched_at` ON `cached_posts` (`fetched_at`);
CREATE INDEX IF NOT EXISTS `idx_notifications_read` ON `notifications_cache` (`read`);
