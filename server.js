const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// መረጃዎች (In-Memory Data)
let rounds = [
  { id: 'round_1', round_no: 1, ticket_price: 200, max_numbers: 25, status: 'active', first_winner: '', second_winner: '', third_winner: '' }
];
let takenNumbers = {
  'round_1': { 3: true, 7: true }
};
let specialNotice = {
  active: true,
  message: 'ከፍ ያለ ሽልማት የሚታወጅበት ልዩ እጣ ሊጀመር ነው። የዕድሉ ተሳታፊ ለመሆን ዛሬውኑ ይዘጋጁ!'
};

// ፐብሊክ ኤፒአይዎች
app.get('/api/rounds/today', (req, res) => {
  const activeRounds = rounds.filter(r => r.status === 'active' || r.status === 'pending');
  res.json({ rounds: activeRounds.length > 0 ? activeRounds : rounds });
});

app.get('/api/rounds/:id/state', (req, res) => {
  const roundId = req.params.id;
  res.json({ taken: takenNumbers[roundId] || {} });
});

app.post('/api/users/register', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'ስም እና ስልክ ቁጥር ያስፈልጋል' });
  res.json({ token: 'user-token-' + phone, name });
});

app.post('/api/take', (req, res) => {
  const { roundId, number } = req.body;
  if (!takenNumbers[roundId]) takenNumbers[roundId] = {};
  if (takenNumbers[roundId][number]) return res.status(400).json({ error: 'ይህ ቁጥር უკვე ተይዟል!' });
  takenNumbers[roundId][number] = true;
  res.json({ ok: true });
});

app.get('/api/announcements/special', (req, res) => {
  res.json(specialNotice);
});

// አድሚን ኤፒአይዎች
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123' || password === '1234') {
    return res.json({ ok: true, token: 'admin-secret-token-123' });
  }
  res.status(401).json({ ok: false, error: 'የተሳሳተ የይለፍ ቃል!' });
});

const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.includes('admin-secret-token-123')) {
    next();
  } else {
    res.status(403).json({ ok: false, error: 'ፈቃድ የለዎትም!' });
  }
};

app.get('/api/admin/rounds', verifyAdmin, (req, res) => {
  res.json({ rounds });
});

app.post('/api/admin/rounds', verifyAdmin, (req, res) => {
  const { round_no, ticket_price, max_numbers } = req.body;
  const newRound = {
    id: 'round_' + Date.now(),
    round_no: parseInt(round_no) || (rounds.length + 1),
    ticket_price: parseFloat(ticket_price) || 200,
    max_numbers: parseInt(max_numbers) || 25,
    status: 'pending',
    first_winner: '',
    second_winner: '',
    third_winner: ''
  };
  rounds.unshift(newRound);
  res.json({ ok: true, round: newRound });
});

app.post('/api/admin/rounds/start/:id', verifyAdmin, (req, res) => {
  const roundId = req.params.id;
  rounds.forEach(r => { if (r.id === roundId) r.status = 'active'; });
  res.json({ ok: true });
});

app.post('/api/admin/rounds/close/:id', verifyAdmin, (req, res) => {
  const roundId = req.params.id;
  rounds.forEach(r => { if (r.id === roundId) r.status = 'closed'; });
  res.json({ ok: true });
});

app.post('/api/admin/rounds/winners', verifyAdmin, (req, res) => {
  const { roundId, firstWinner, secondWinner, thirdWinner } = req.body;
  rounds.forEach(r => {
    if (r.id === roundId) {
      r.first_winner = firstWinner || '';
      r.second_winner = secondWinner || '';
      r.third_winner = thirdWinner || '';
      r.status = 'completed';
    }
  });
  res.json({ ok: true });
});

app.post('/api/admin/announcements/special', verifyAdmin, (req, res) => {
  const { active, message } = req.body;
  specialNotice = { active, message };
  res.json({ ok: true });
});

// Render የሚሰጠውን ፖርት በራስ-ሰር እንዲቀበል ማድረግ
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
