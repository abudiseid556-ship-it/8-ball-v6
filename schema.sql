-- V7 schema. Run this after backing up the current database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_date DATE NOT NULL,
  round_no INTEGER NOT NULL CHECK (round_no >= 1),
  ticket_price NUMERIC(14,2) NOT NULL CHECK (ticket_price > 0),
  max_numbers INTEGER NOT NULL CHECK (max_numbers >= 1 AND max_numbers <= 1000000),
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','drawn')),
  prizes JSONB NOT NULL DEFAULT '[7000,1000,500]'::jsonb,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  drawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(draw_date,round_no)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_name_idx ON users(name);
CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone);

-- If this is a new database, create the modern ticket/winner tables directly.
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number >= 1),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  UNIQUE(round_id,number)
);
CREATE INDEX IF NOT EXISTS tickets_round_idx ON tickets(round_id);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);

CREATE TABLE IF NOT EXISTS winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  place INTEGER NOT NULL CHECK (place >= 1),
  place_label VARCHAR(40) NOT NULL,
  number INTEGER NOT NULL,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  prize NUMERIC(14,2) NOT NULL CHECK (prize >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id,place)
);
CREATE INDEX IF NOT EXISTS winners_round_idx ON winners(round_id);
CREATE INDEX IF NOT EXISTS winners_user_idx ON winners(user_id);

CREATE TABLE IF NOT EXISTS announcements (id uuid PRIMARY KEY, message text NOT NULL, active boolean NOT NULL DEFAULT true, priority int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT NOW(), expires_at timestamptz);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_role VARCHAR(20) NOT NULL CHECK (admin_role IN ('master','admin_a','admin_b')),
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40),
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_role_idx ON audit_logs(admin_role);
