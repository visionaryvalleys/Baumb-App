-- BAUMB schema for Postgres (Neon). Applied automatically on first connection. Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sign_in_at TIMESTAMPTZ
);

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
