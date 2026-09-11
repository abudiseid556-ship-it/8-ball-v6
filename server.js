const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

/* =========================================================
   STATIC FILES
   ========================================================= */

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');

app.use(express.static(PUBLIC_DIR));
app.use('/admin', express.static(ADMIN_DIR));


/* =========================================================
   IN-MEMORY DATA
   ========================================================= */

let rounds = [
  {
    id: 'round_1',
    round_no: 1,
    ticket_price: 200,
    max_numbers: 100,
    status: 'active',

    first_prize: 50000,
    second_prize: 10000,
    third_prize: 5000,

    first_winner: '',
    second_winner: '',
    third_winner: '',

    started_at: new Date().toISOString(),
    closed_at: null,
    created_at: new Date().toISOString()
  }
];

let takenNumbers = {
  round_1: {
    3: true,
    7: true
  }
};

let users = [];

let specialNotice = {
  active: true,
  message:
    'ከፍ ያለ ሽልማት የሚታወጅበት ልዩ እጣ ሊጀመር ነው። የዕድሉ ተሳታፊ ለመሆን ዛሬውኑ ይዘጋጁ!'
};


/* =========================================================
   BASIC HEALTH CHECK
   ========================================================= */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: '8 BALL እጣ',
    server: true
  });
});


/* =========================================================
   PUBLIC API
   ========================================================= */

/* Today's / active rounds */
app.get('/api/rounds/today', (req, res) => {

  const activeRounds = rounds.filter(
    r => r.status === 'active' || r.status === 'pending'
  );

  res.json({
    rounds: activeRounds.length > 0 ? activeRounds : rounds
  });
});


/* Round state / taken numbers */
app.get('/api/rounds/:id/state', (req, res) => {

  const roundId = req.params.id;

  const round = rounds.find(r => r.id === roundId);

  if (!round) {
    return res.status(404).json({
      error: 'ዙሩ አልተገኘም'
    });
  }

  res.json({
    round,
    taken: takenNumbers[roundId] || {}
  });
});


/* User registration */
app.post('/api/users/register', (req, res) => {

  const { name, phone } = req.body;

  if (!name || !phone) {
    return res.status(400).json({
      error: 'ስም እና ስልክ ቁጥር ያስፈልጋል'
    });
  }

  const user = {
    id: 'user_' + Date.now(),
    name: String(name).trim(),
    phone: String(phone).trim(),
    created_at: new Date().toISOString()
  };

  users.push(user);

  res.json({
    ok: true,
    token: 'user-token-' + user.id,
    user
  });
});


/* Take / reserve ticket */
app.post('/api/take', (req, res) => {

  const { roundId, number } = req.body;

  if (!roundId || number === undefined) {
    return res.status(400).json({
      error: 'ዙር እና ትኬት ቁጥር ያስፈልጋል'
    });
  }

  const round = rounds.find(r => r.id === roundId);

  if (!round) {
    return res.status(404).json({
      error: 'ዙሩ አልተገኘም'
    });
  }

  if (round.status !== 'active') {
    return res.status(400).json({
      error: 'ይህ ዙር አሁን ክፍት አይደለም'
    });
  }

  const ticketNumber = Number(number);

  if (
    !Number.isInteger(ticketNumber) ||
    ticketNumber < 1 ||
    ticketNumber > round.max_numbers
  ) {
    return res.status(400).json({
      error: 'የተሳሳተ ትኬት ቁጥር'
    });
  }

  if (!takenNumbers[roundId]) {
    takenNumbers[roundId] = {};
  }

  if (takenNumbers[roundId][ticketNumber]) {
    return res.status(400).json({
      error: 'ይህ ቁጥር አስቀድሞ ተይዟል!'
    });
  }

  takenNumbers[roundId][ticketNumber] = true;

  res.json({
    ok: true,
    roundId,
    number: ticketNumber,
    message: 'ትኬቱ ተይዟል'
  });
});


/* Special announcement */
app.get('/api/announcements/special', (req, res) => {
  res.json(specialNotice);
});


/* =========================================================
   USER TICKETS
   ========================================================= */

app.get('/api/me/tickets', (req, res) => {

  const tickets = [];

  Object.keys(takenNumbers).forEach(roundId => {

    const roundTickets = takenNumbers[roundId] || {};

    Object.keys(roundTickets).forEach(number => {

      tickets.push({
        roundId,
        number: Number(number),
        status: 'reserved'
      });

    });
  });

  res.json({
    tickets
  });
});


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

const ADMIN_PASSWORD = 'admin123';

app.post('/api/admin/login', (req, res) => {

  const { password } = req.body;

  if (
    password === ADMIN_PASSWORD ||
    password === '1234'
  ) {
    return res.json({
      ok: true,
      token: 'admin-secret-token-123'
    });
  }

  return res.status(401).json({
    ok: false,
    error: 'የተሳሳተ የይለፍ ቃል!'
  });
});


/* =========================================================
   ADMIN AUTH
   ========================================================= */

const verifyAdmin = (req, res, next) => {

  const authHeader =
    req.headers.authorization || '';

  if (
    authHeader.includes(
      'admin-secret-token-123'
    )
  ) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    error: 'ፈቃድ የለዎትም!'
  });
};


/* =========================================================
   ADMIN - ROUNDS
   ========================================================= */

app.get(
  '/api/admin/rounds',
  verifyAdmin,
  (req, res) => {

    res.json({
      rounds
    });
  }
);


/* Create new round */
app.post(
  '/api/admin/rounds',
  verifyAdmin,
  (req, res) => {

    const {
      round_no,
      ticket_price,
      max_numbers,
      first_prize,
      second_prize,
      third_prize
    } = req.body;

    const newRound = {

      id: 'round_' + Date.now(),

      round_no:
        parseInt(round_no) ||
        rounds.length + 1,

      ticket_price:
        parseFloat(ticket_price) ||
        200,

      max_numbers:
        parseInt(max_numbers) ||
        100,

      status: 'pending',

      first_prize:
        parseFloat(first_prize) || 50000,

      second_prize:
        parseFloat(second_prize) || 10000,

      third_prize:
        parseFloat(third_prize) || 5000,

      first_winner: '',
      second_winner: '',
      third_winner: '',

      started_at: null,
      closed_at: null,

      created_at:
        new Date().toISOString()
    };

    rounds.unshift(newRound);

    takenNumbers[newRound.id] = {};

    res.json({
      ok: true,
      round: newRound
    });
  }
);


/* Start round */
app.post(
  '/api/admin/rounds/start/:id',
  verifyAdmin,
  (req, res) => {

    const roundId = req.params.id;

    const round =
      rounds.find(r => r.id === roundId);

    if (!round) {
      return res.status(404).json({
        error: 'ዙሩ አልተገኘም'
      });
    }

    round.status = 'active';
    round.started_at =
      new Date().toISOString();

    if (!takenNumbers[roundId]) {
      takenNumbers[roundId] = {};
    }

    res.json({
      ok: true,
      round
    });
  }
);


/* Close round */
app.post(
  '/api/admin/rounds/close/:id',
  verifyAdmin,
  (req, res) => {

    const roundId = req.params.id;

    const round =
      rounds.find(r => r.id === roundId);

    if (!round) {
      return res.status(404).json({
        error: 'ዙሩ አልተገኘም'
      });
    }

    round.status = 'closed';
    round.closed_at =
      new Date().toISOString();

    res.json({
      ok: true,
      round
    });
  }
);


/* =========================================================
   ADMIN - WINNERS
   ========================================================= */

app.post(
  '/api/admin/rounds/winners',
  verifyAdmin,
  (req, res) => {

    const {
      roundId,
      firstWinner,
      secondWinner,
      thirdWinner
    } = req.body;

    const round =
      rounds.find(r => r.id === roundId);

    if (!round) {
      return res.status(404).json({
        error: 'ዙሩ አልተገኘም'
      });
    }

    round.first_winner =
      firstWinner || '';

    round.second_winner =
      secondWinner || '';

    round.third_winner =
      thirdWinner || '';

    round.status = 'completed';

    res.json({
      ok: true,
      round
    });
  }
);


/* =========================================================
   ADMIN - SPECIAL NOTICE
   ========================================================= */

app.post(
  '/api/admin/announcements/special',
  verifyAdmin,
  (req, res) => {

    const {
      active,
      message
    } = req.body;

    specialNotice = {
      active: Boolean(active),
      message: message || ''
    };

    res.json({
      ok: true,
      notice: specialNotice
    });
  }
);


/* =========================================================
   ADMIN - USERS
   ========================================================= */

app.get(
  '/api/admin/users',
  verifyAdmin,
  (req, res) => {

    res.json({
      users
    });
  }
);


/* =========================================================
   PUBLIC PAGE
   ========================================================= */

/*
   IMPORTANT:
   This fixes:
   "Cannot GET /"
*/

app.get('/', (req, res) => {

  res.sendFile(
    path.join(
      PUBLIC_DIR,
      'index.html'
    )
  );
});


/* =========================================================
   ADMIN PAGE
   ========================================================= */

app.get('/admin', (req, res) => {

  res.sendFile(
    path.join(
      ADMIN_DIR,
      'index.html'
    )
  );
});


/* =========================================================
   FALLBACK
   ========================================================= */

app.use((req, res) => {

  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API endpoint አልተገኘም'
    });
  }

  res.sendFile(
    path.join(
      PUBLIC_DIR,
      'index.html'
    )
  );
});


/* =========================================================
   SERVER
   ========================================================= */

const PORT =
  Number(process.env.PORT) || 10000;

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `🎱 8 BALL እጣ server is running on port ${PORT}`
    );
  }
);
