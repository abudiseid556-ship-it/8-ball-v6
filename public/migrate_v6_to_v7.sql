-- SAFE migration from the old V6 (single 1-100 round) schema to V7.
-- IMPORTANT: take a Supabase backup/export first.
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

DO $$ BEGIN
  IF to_regclass('public.tickets') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='round_id') THEN
    CREATE TABLE tickets_v7 (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,number INTEGER NOT NULL CHECK(number>=1),user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK(status IN('pending','paid')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),paid_at TIMESTAMPTZ,UNIQUE(round_id,number));
    INSERT INTO rounds(draw_date,round_no,ticket_price,max_numbers,status,prizes,started_at,closed_at)
    SELECT CURRENT_DATE,1,100,100,CASE WHEN EXISTS(SELECT 1 FROM winners) THEN 'drawn' WHEN EXISTS(SELECT 1 FROM tickets WHERE status='paid') THEN 'closed' ELSE 'open' END,'[7000,1000,500]'::jsonb,
           MIN(created_at),CASE WHEN EXISTS(SELECT 1 FROM winners) THEN MAX(created_at) ELSE NULL END
    FROM tickets WHERE NOT EXISTS(SELECT 1 FROM rounds);
    INSERT INTO tickets_v7(round_id,number,user_id,status,created_at,paid_at)
      SELECT r.id,t.number,t.user_id,t.status,t.created_at,t.paid_at FROM tickets t CROSS JOIN LATERAL(SELECT id FROM rounds ORDER BY created_at LIMIT 1) r;
    ALTER TABLE tickets RENAME TO tickets_v6_backup;
    ALTER TABLE tickets_v7 RENAME TO tickets;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tickets_round_idx ON tickets(round_id);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);

DO $$ BEGIN
  IF to_regclass('public.winners') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='winners' AND column_name='round_id') THEN
    CREATE TABLE winners_v7 (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,place INTEGER NOT NULL CHECK(place>=1),place_label VARCHAR(40) NOT NULL,number INTEGER NOT NULL,ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,prize NUMERIC(14,2) NOT NULL CHECK(prize>=0),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(round_id,place));
    INSERT INTO winners_v7(round_id,place,place_label,number,ticket_id,user_id,prize,created_at)
      SELECT r.id,w.place,w.place_label,w.number,t.id,w.user_id,w.prize,w.created_at FROM winners w JOIN tickets t ON t.number=w.number CROSS JOIN LATERAL(SELECT id FROM rounds ORDER BY created_at LIMIT 1) r;
    ALTER TABLE winners RENAME TO winners_v6_backup;
    ALTER TABLE winners_v7 RENAME TO winners;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS winners_round_idx ON winners(round_id);
CREATE INDEX IF NOT EXISTS winners_user_idx ON winners(user_id);
