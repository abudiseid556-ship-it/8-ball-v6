-- 8 BALL እጣ V7 additions: Ethiopian time + minimum players + waiting period
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS min_players INTEGER NOT NULL DEFAULT 50;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS waiting_minutes INTEGER NOT NULL DEFAULT 60;
-- Server timestamps remain timestamptz; application display/timeout logic uses Africa/Addis_Ababa.
