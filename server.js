require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- simple JSON file "database" ----------
const DB_PATH = path.join(__dirname, 'data', 'db.json');
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { state: { meals: [], weightLog: [], items: [] }, subscriptions: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
if (!fs.existsSync(DB_PATH)) writeDB({ state: { meals: [], weightLog: [], items: [] }, subscriptions: [] });

// ---------- VAPID / web-push setup ----------
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:you@example.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn('WARNING: VAPID keys not set in .env — push notifications will not work until you add them.');
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ---------- API: give frontend the public key ----------
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY || null });
});

// ---------- API: sync app state (meals + weight + follow-ups) ----------
app.get('/api/state', (req, res) => {
  const db = readDB();
  res.json(db.state);
});
app.post('/api/state', (req, res) => {
  const db = readDB();
  db.state = req.body || db.state;
  writeDB(db);
  res.json({ ok: true });
});

// ---------- API: save a push subscription ----------
app.post('/api/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ ok: false, error: 'invalid subscription' });
  const db = readDB();
  const exists = db.subscriptions.find(s => s.endpoint === sub.endpoint);
  if (!exists) db.subscriptions.push(sub);
  writeDB(db);
  res.json({ ok: true });
});
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  const db = readDB();
  db.subscriptions = db.subscriptions.filter(s => s.endpoint !== endpoint);
  writeDB(db);
  res.json({ ok: true });
});

// ---------- API: send a test push immediately ----------
app.post('/api/test-push', async (req, res) => {
  await sendToAll({ title: 'Follow Up', body: 'Test notification — this works ✅' });
  res.json({ ok: true });
});

// ---------- push sending helper ----------
async function sendToAll(payload) {
  const db = readDB();
  if (!db.subscriptions.length) return;
  const results = await Promise.allSettled(
    db.subscriptions.map(sub => webpush.sendNotification(sub, JSON.stringify(payload)))
  );
  // Remove subscriptions that are no longer valid (410/404)
  const stillValid = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') stillValid.push(db.subscriptions[i]);
    else {
      const code = r.reason && r.reason.statusCode;
      if (code !== 410 && code !== 404) stillValid.push(db.subscriptions[i]);
    }
  });
  db.subscriptions = stillValid;
  writeDB(db);
}

// ---------- reminder logic ----------
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_MAP = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; // JS getDay(): 0=Sun

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

async function runMorningReminder() {
  const db = readDB();
  const state = db.state || {};
  const todayName = DAY_MAP[new Date().getDay()]; // 'Mon' etc — matches frontend's 3-letter day keys
  const meals = (state.meals || []).filter(m => m.day === todayName && !m.done);

  const t = todayStr();
  const dueFollowups = (state.items || []).filter(it => !it.done && it.dueDate <= t);

  if (meals.length) {
    const list = meals.map(m => `${m.type}: ${m.name}`).join(' • ');
    await sendToAll({ title: "Today's cooking", body: list.slice(0, 180) });
  }
  if (dueFollowups.length) {
    const names = dueFollowups.map(f => f.name).join(', ');
    await sendToAll({ title: `${dueFollowups.length} follow-up${dueFollowups.length>1?'s':''} due`, body: names.slice(0,180) });
  }
}

async function runEveningReminder() {
  const db = readDB();
  const state = db.state || {};
  const todayName = DAY_MAP[new Date().getDay()];
  const dinner = (state.meals || []).filter(m => m.day === todayName && m.type === 'Dinner' && !m.done);
  if (dinner.length) {
    await sendToAll({ title: 'Dinner reminder', body: dinner.map(m=>m.name).join(', ') });
  }
}

// Times are configurable via .env (24h, server local time). Defaults: 8:00 AM and 6:30 PM.
const MORNING_CRON = process.env.MORNING_CRON || '0 8 * * *';
const EVENING_CRON = process.env.EVENING_CRON || '30 18 * * *';
const TIMEZONE = process.env.TZ_NAME || 'Asia/Kolkata';

cron.schedule(MORNING_CRON, runMorningReminder, { timezone: TIMEZONE });
cron.schedule(EVENING_CRON, runEveningReminder, { timezone: TIMEZONE });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Follow Up server running on port ${PORT}`));
