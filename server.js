const express = require('express');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const JWT_SECRET = String(process.env.JWT_SECRET || '');
const ADMIN_PIN = String(process.env.ADMIN_PIN || '');

if (!DATABASE_URL || !JWT_SECRET || !ADMIN_PIN) {
  console.error('CONFIG_ERROR: Missing DATABASE_URL, JWT_SECRET or ADMIN_PIN');
  process.exit(1);
}

/*
  V6 connection handling:
  - Uses the Supabase Session Pooler URI exactly as supplied.
  - Does not try to split/rebuild the URI.
  - Rejects obvious malformed values early so the real problem is visible in logs.
*/
function connectionInfo(raw) {
  try {
    const u = new URL(raw);
    return {
      protocol: u.protocol,
      host: u.hostname,
      port: u.port || '(default)',
      database: u.pathname.replace(/^\//, '') || '(none)',
      hasUser: !!u.username,
      hasPassword: !!u.password
    };
  } catch (e) {
    return { invalid: true };
  }
}

const ci = connectionInfo(DATABASE_URL);
if (ci.invalid || !['postgres:', 'postgresql:'].includes(ci.protocol)) {
  console.error('CONFIG_ERROR: DATABASE_URL is not a valid PostgreSQL URI.');
  console.error('Expected a Supabase Session Pooler URI beginning with postgresql://');
  process.exit(1);
}
if (!ci.host || ci.host.toLowerCase() === 'base' || !ci.hasUser || !ci.hasPassword) {
  console.error('CONFIG_ERROR: DATABASE_URL appears malformed.');
  console.error(`Parsed host=${ci.host || '(empty)'} user=${ci.hasUser} password=${ci.hasPassword}`);
  process.exit(1);
}

console.log(`DB_CONFIG: host=${ci.host} port=${ci.port} database=${ci.database}`);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', err => console.error('DB_POOL_ERROR:', err.message));

app.use(express.static(path.join(__dirname, 'public')));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

function signUser(user) {
  return jwt.sign({ sub: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
}
function signAdmin() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
}
function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
function requireUser(req, res, next) {
  try {
    const p = jwt.verify(bearer(req), JWT_SECRET);
    if (p.role !== 'user' || !p.sub) throw new Error('role');
    req.auth = p; next();
  } catch {
    res.status(401).json({ error: 'የመግቢያ ፍቃድ አልተገኘም።' });
  }
}
function requireAdmin(req, res, next) {
  try {
    const p = jwt.verify(bearer(req), JWT_SECRET);
    if (p.role !== 'admin') throw new Error('role');
    req.auth = p; next();
  } catch {
    res.status(401).json({ error: 'የአዘጋጅ ፍቃድ አልተገኘም።' });
  }
}
function validPhone(phone) { return /^\d{10}$/.test(String(phone || '')); }
function validNumber(n) { return Number.isInteger(n) && n >= 1 && n <= 100; }

app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, database: r.rows[0].ok === 1 });
  } catch (e) {
    console.error('HEALTH_DB_ERROR:', e.message);
    res.status(503).json({ ok: false, database: false, error: 'Database connection failed' });
  }
});

app.get('/api/state', async (req, res) => {
  try {
    const [t, w] = await Promise.all([
      pool.query('SELECT number,status FROM tickets ORDER BY number'),
      pool.query('SELECT place,place_label,number,prize FROM winners ORDER BY place')
    ]);
    const taken = {};
    for (const x of t.rows) taken[String(x.number)] = { status: x.status };
    const winners = {};
    for (const x of w.rows) winners[String(x.place_label)] = { number: x.number, prize: x.prize };
    res.json({ taken, winners });
  } catch (e) {
    console.error('STATE_ERROR:', e.message);
    res.status(503).json({ error: 'Database connection failed' });
  }
});

app.post('/api/users/register', authLimiter, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();

  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'እባክዎ ትክክለኛ ስም ያስገቡ።' });
  if (!validPhone(phone)) return res.status(400).json({ error: 'ስልክ ቁጥሩ በትክክል 10 ዲጂት መሆን አለበት።' });

  try {
    let r = await pool.query('SELECT id,name,phone FROM users WHERE phone=$1', [phone]);
    let user;
    if (r.rowCount) {
      user = r.rows[0];
      if (user.name !== name) {
        r = await pool.query('UPDATE users SET name=$1 WHERE id=$2 RETURNING id,name,phone', [name, user.id]);
        user = r.rows[0];
      }
    } else {
      const id = crypto.randomUUID();
      r = await pool.query(
        'INSERT INTO users(id,name,phone) VALUES($1,$2,$3) RETURNING id,name,phone',
        [id, name, phone]
      );
      user = r.rows[0];
    }
    res.json({ user, token: signUser(user) });
  } catch (e) {
    console.error('REGISTER_ERROR:', e.message);
    if (e.code === '23505') return res.status(409).json({ error: 'ይህ ስልክ ቁጥር አስቀድሞ ተመዝግቧል።' });
    res.status(503).json({ error: 'አካውንት መክፈት አልተቻለም።' });
  }
});

app.get('/api/me', requireUser, async (req, res) => {
  try {
    const u = await pool.query('SELECT id,name,phone FROM users WHERE id=$1', [req.auth.sub]);
    if (!u.rowCount) return res.status(404).json({ error: 'አካውንቱ አልተገኘም።' });
    const t = await pool.query('SELECT number,status,created_at,paid_at FROM tickets WHERE user_id=$1 ORDER BY number', [req.auth.sub]);
    res.json({ user: u.rows[0], tickets: t.rows });
  } catch (e) {
    console.error('ME_ERROR:', e.message);
    res.status(503).json({ error: 'Database connection failed' });
  }
});

app.post('/api/take', requireUser, async (req, res) => {
  const number = Number(req.body?.number);
  if (!validNumber(number)) return res.status(400).json({ error: '1 እስከ 100 ያለ ቁጥር ይምረጡ።' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query('SELECT 1 FROM winners WHERE number=$1', [number]);
    if (w.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ይህ ቁጥር አሸናፊ ሆኗል።' });
    }

    const ins = await client.query(
      `INSERT INTO tickets(number,user_id,status) VALUES($1,$2,'pending')
       ON CONFLICT (number) DO NOTHING RETURNING number,status`,
      [number, req.auth.sub]
    );
    if (!ins.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ይህ ቁጥር ቀድሞ ተይዟል።' });
    }
    await client.query('COMMIT');
    res.json({ ok: true, ticket: ins.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('TAKE_ERROR:', e.message);
    res.status(503).json({ error: 'ቁጥር መያዝ አልተቻለም።' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/login', adminLimiter, (req, res) => {
  const pin = String(req.body?.pin || '');
  if (pin !== ADMIN_PIN) return res.status(401).json({ error: 'የአዘጋጅ PIN ተሳስቷል።' });
  res.json({ token: signAdmin() });
});

app.get('/api/admin/state', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT t.number,t.status,t.created_at,u.name AS "userName",u.phone
      FROM tickets t JOIN users u ON u.id=t.user_id
      WHERE t.status='pending' ORDER BY t.created_at ASC
    `);
    res.json({ pending: r.rows });
  } catch (e) {
    console.error('ADMIN_STATE_ERROR:', e.message);
    res.status(503).json({ error: 'Database connection failed' });
  }
});

app.post('/api/admin/confirm', requireAdmin, async (req, res) => {
  const number = Number(req.body?.number);
  if (!validNumber(number)) return res.status(400).json({ error: 'ቁጥሩ ትክክል አይደለም።' });
  try {
    const r = await pool.query(
      `UPDATE tickets SET status='paid',paid_at=NOW()
       WHERE number=$1 AND status='pending' RETURNING number,status`,
      [number]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Pending ቁጥሩ አልተገኘም።' });
    res.json({ ok: true, ticket: r.rows[0] });
  } catch (e) {
    console.error('CONFIRM_ERROR:', e.message);
    res.status(503).json({ error: 'ክፍያውን ማረጋገጥ አልተቻለም።' });
  }
});

app.post('/api/admin/release', requireAdmin, async (req, res) => {
  const number = Number(req.body?.number);
  if (!validNumber(number)) return res.status(400).json({ error: 'ቁጥሩ ትክክል አይደለም።' });
  try {
    const r = await pool.query(
      `DELETE FROM tickets WHERE number=$1 AND status='pending' RETURNING number`,
      [number]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Pending ቁጥሩ አልተገኘም።' });
    res.json({ ok: true });
  } catch (e) {
    console.error('RELEASE_ERROR:', e.message);
    res.status(503).json({ error: 'ቁጥሩን መልቀቅ አልተቻለም።' });
  }
});

app.post('/api/admin/draw', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(8008135)');
    const existing = await client.query('SELECT place FROM winners');
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'እጣው አስቀድሞ ተወጥቷል።' });
    }

    const paid = await client.query(
      'SELECT number,user_id FROM tickets WHERE status=$1 ORDER BY random() LIMIT 3',
      ['paid']
    );
    if (paid.rowCount < 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `ለእጣ ቢያንስ 3 የተከፈሉ ቁጥሮች ያስፈልጋሉ። አሁን ${paid.rowCount} አሉ።` });
    }

    const labels = ['1ኛ አሸናፊ','2ኛ አሸናፊ','3ኛ አሸናፊ'];
    const prizes = [7000,1000,500];
    const winners = {};
    for (let i=0;i<3;i++) {
      const x = paid.rows[i];
      await client.query(
        'INSERT INTO winners(place,place_label,number,user_id,prize) VALUES($1,$2,$3,$4,$5)',
        [i+1, labels[i], x.number, x.user_id, prizes[i]]
      );
      winners[labels[i]] = { number: x.number, prize: prizes[i] };
    }
    await client.query('COMMIT');
    res.json({ ok: true, winners });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('DRAW_ERROR:', e.message);
    res.status(503).json({ error: 'እጣውን ማውጣት አልተቻለም።' });
  } finally {
    client.release();
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lottery V6 listening on port ${PORT}`);
});
