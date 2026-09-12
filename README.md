# Premium Lottery V7

- User app: `/`
- Admin app: `/admin`
- Same backend + Supabase/PostgreSQL
- Admin creates any number of rounds, ticket count and ticket price.
- No manual start/end time entry. Start and close timestamps are recorded automatically when buttons are pressed.
- Prize amounts are configurable per round.
- Ticket numbers are not fixed at 100; up to 1,000,000.
- User app hides taken numbers from the available selector and refreshes every 4 seconds.
- Alerts appear at 20 and 10 remaining tickets.
- Admin can view user names and phone numbers.

IMPORTANT: The current V6 database schema is not compatible with multiple rounds. Back up production data before migrating. For a clean/test database, run schema.sql. If the current database already contains important tickets, ask for a migration script rather than dropping tables.

## Stability fix
Advertisement inserts now always provide the announcements.title value and startup migration adds/normalizes that column for existing databases.
