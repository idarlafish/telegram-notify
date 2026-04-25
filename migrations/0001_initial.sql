-- Users: telegram user → bot chat mapping.
CREATE TABLE users (
  id INTEGER PRIMARY KEY,                                                -- telegram user_id
  chat_id INTEGER NOT NULL,                                              -- where to send notifications
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

-- Notifications: one per scheduled reminder. next_fire_at is the UTC
-- millisecond timestamp of the next time this should fire; the cron
-- trigger queries WHERE next_fire_at <= now() to find due items.
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,                                                   -- uuid
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time TEXT NOT NULL,                                                    -- "HH:MM" local
  timezone TEXT NOT NULL,                                                -- IANA tz, e.g. "Europe/Moscow"
  message TEXT NOT NULL,
  next_fire_at INTEGER NOT NULL,                                         -- UTC ms
  last_sent_at INTEGER,                                                  -- UTC ms; nullable
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE INDEX idx_notifications_next_fire ON notifications(next_fire_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
