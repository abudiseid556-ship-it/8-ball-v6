# 8 BALL LOTTERY V7 — Unified Master Secure

- User App: `/`
- Admin App: `/admin`
- Repository root is the application root.
- Build: `npm install`
- Start: `npm start`
- Web Push dependency included: `web-push`
- Web Push service worker: `public/sw.js`
- Notifications are kept out of the main premium hero layout so they do not distort the visual design.
- Admin permissions are enforced server-side.
- Do not append `/admin` to `DATABASE_URL`; the database URL must point to the PostgreSQL database itself.
