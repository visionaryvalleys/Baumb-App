-- BAUMB schema for Postgres (Neon). Applied automatically on first connection. Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sign_in_at TIMESTAMPTZ,
  age_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  ai_consent_at   TIMESTAMPTZ
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_consent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions (user_id);

-- Profile, plans, workouts, meals, weigh-ins and the rest of a user's app data, one JSON document.
-- Revision increments on every save so two devices can't silently overwrite each other.
-- Progress photos are not stored here; their bytes live in object storage and this document keeps the key.
CREATE TABLE IF NOT EXISTS user_data (
  user_id    UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  state_json JSONB NOT NULL,
  revision   INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS foods (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  aliases       TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL,
  calories      NUMERIC(7, 1) NOT NULL,
  protein_g     NUMERIC(6, 2) NOT NULL,
  carbs_g       NUMERIC(6, 2) NOT NULL,
  fat_g         NUMERIC(6, 2) NOT NULL,
  fiber_g       NUMERIC(6, 2) NOT NULL,
  servings_json TEXT NOT NULL DEFAULT '[]',
  source        TEXT NOT NULL,
  priority      SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS food_keys (
  key_text   TEXT PRIMARY KEY,
  food_id    TEXT REFERENCES foods (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS food_keys_food_id ON food_keys (food_id);

-- Public workout counts for the shared board. The journal itself stays in user_data.
CREATE TABLE IF NOT EXISTS board_scores (
  user_id       UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  workout_count INT NOT NULL DEFAULT 0,
  workout_days  INT NOT NULL DEFAULT 0,
  eligible      BOOLEAN NOT NULL DEFAULT FALSE,
  g_balance     INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_award (
  id              INT PRIMARY KEY CHECK (id = 1),
  winner_user_id  UUID,
  winner_name     TEXT,
  workout_count   INT NOT NULL DEFAULT 0,
  announced_at    TIMESTAMPTZ
);
INSERT INTO board_award (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Gallery is a follow-based feed. A post is visible to its author and to people who follow that author.
-- Private progress photos stay in user_data. Media bytes live in gallery_media unless object storage is configured.
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_id ON follows (following_id);

CREATE TABLE IF NOT EXISTS gallery_posts (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('daily', 'quarter', 'reel')),
  quarter      SMALLINT CHECK (quarter IS NULL OR (quarter BETWEEN 1 AND 4)),
  year         SMALLINT,
  caption      TEXT NOT NULL DEFAULT '',
  object_key   TEXT,
  content_type TEXT,
  duration_sec NUMERIC(5, 1),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_posts_user_created ON gallery_posts (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS gallery_posts_one_quarter
  ON gallery_posts (user_id, year, quarter)
  WHERE kind = 'quarter';

CREATE TABLE IF NOT EXISTS gallery_media (
  post_id      UUID PRIMARY KEY REFERENCES gallery_posts (id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  bytes        BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery_comments (
  id         UUID PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES gallery_posts (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_comments_post_created ON gallery_comments (post_id, created_at);
