# 🎱 8 BALL እጣ — V7 FINAL STABLE

## Structure
- `/` — User/Public App
- `/admin` — Admin App
- `server.js` — single backend
- `schema.sql` — clean V7 database schema
- `migrate_v6_to_v7.sql` — migration reference

## Render
- Root Directory: blank
- Build Command: `npm install`
- Start Command: `npm start`

## Required Environment Variables
`DATABASE_URL`, `JWT_SECRET`, `ADMIN_PIN`, `ADMIN_A_PIN`, `ADMIN_B_PIN`

Optional push variables: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**Environment variable names are case-sensitive.** Use exactly `ADMIN_A_PIN` and `ADMIN_B_PIN`.

## Security
Admin roles and permissions are enforced by the server. Master can manage A/B permissions. User and admin routes are separate.

## Important
For an existing production database, do not drop tables. Let the startup compatibility migrations run, and keep a Supabase backup before major schema changes.


## V7 FINAL RULES update — 2026-09-13
- Notification bell has no badge when there are no unread notifications; unread count shows a red pulsing badge and opening the panel marks notifications read.
- Front-page Advertisement remains separate from the existing Notice.
- Round/payment lifecycle supports `DRAFT → OPEN → CLOSED → DRAW → COMPLETED` and `CLOSED → REFUND REQUIRED → REFUNDED`; Refund Required/Refunded rounds cannot be drawn.
- Start/close/draw timestamps are server-generated.
- Only the three configured prize positions are displayed/drawn.
- Admin permissions remain server-enforced; Master can toggle Admin A/B permissions.
- Existing User/Admin separation, ticket locking, payment pending/confirmed, histories, push/in-app notifications, and grouped user tickets are preserved.


## Customer Growth & Trust Strategy
- Pilot target: at least 100 initial customers.
- Official Telegram channel + discussion/support group.
- Private Telegram support for receipt number + lottery number verification.
- Pilot payment verification: Telebirr receipt is checked against the income/payment display in the app; direct Telebirr API verification is a later integration step.
- Public winner display: winner name + last 3 phone digits only; full phone numbers remain private.
- Weekly Big Draw campaign can be promoted through the Admin Advertisement area and Telegram, using only real configured round/prize information.
- Keep the existing animated Notice separate from the front-page Advertisement.
