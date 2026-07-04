# Follow Up

A personal diet-log + cooking-reminder + call/message follow-up tracker, built as an
installable app (PWA) with **real push notifications**.

## What you get
- **Kitchen tab** — weight log (97 → 80 kg progress bar), a full weekly meal plan you can edit,
  tick meals off as cooked.
- **Follow-ups tab** — add people/companies to call or message, with a reason and a due date.
  Auto-sorted into Overdue / Due today / Upcoming / Done.
- **Real push notifications** — a small server sends you a notification every morning (8:00 AM)
  with today's meals to cook and any due/overdue follow-ups, and again in the evening (6:30 PM)
  as a dinner reminder. Times are configurable.
- **"Add to calendar"** button on every follow-up — drops a real reminder into your phone's
  calendar app as a backup, independent of push.
- **Installable** — "Add to Home Screen" on your phone, works offline for viewing/editing.

---

## 1. Run it locally (2 minutes)

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd followup-app
npm install
cp .env.example .env
npm start
```

Open **http://localhost:3000** on your phone or computer's browser.
(Push notifications and "Add to Home Screen" work over `localhost` too — browsers make an
exception for it — but for use away from your own computer you'll want step 2.)

---

## 2. Deploy it for free so it works from anywhere (~10 minutes)

You need it running on a real HTTPS address for push notifications to work when you're out
and about. **Render** has a free tier that's simplest:

1. Push this folder to a new GitHub repo (or upload it directly — Render supports both).
2. Go to [render.com](https://render.com) → **New → Web Service** → connect your repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Under **Environment**, add these variables (copy values from `.env.example`, or generate
   your own fresh keys — see below):
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (e.g. `mailto:you@example.com`)
   - `TZ_NAME` = `Asia/Kolkata`
   - `MORNING_CRON` = `0 8 * * *`
   - `EVENING_CRON` = `30 18 * * *`
5. Deploy. Render gives you a URL like `https://follow-up-yourname.onrender.com`.
6. Open that URL on your phone, tap **Enable notifications**, then **Add to Home Screen**.

Render's free tier sleeps after inactivity and wakes on the next request — fine for personal
use, but it means a scheduled push might be delayed by a few seconds while it wakes up. If you
want zero-delay timing, Railway or Fly.io's free tiers don't sleep as aggressively — same
deployment steps apply.

**Generate your own VAPID keys (recommended, takes 10 seconds):**
```bash
npx web-push generate-vapid-keys
```
Paste the output into `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.

---

## 3. Using it day to day

- **Kitchen:** tap a day, tick meals off as you cook them, add new ones any time.
- **Follow-ups:** tap the **+** button any time you know you need to call/message someone —
  give it a date, and it'll show up in Overdue/Today/Upcoming automatically, plus trigger a
  push notification on the day.
- **Enable notifications** only needs to be tapped once per device.
- Your data lives in your browser (works offline) and is mirrored to the server so the
  reminder engine has something to check — nothing is sent anywhere except your own server.

## Project structure
```
followup-app/
  server.js           — Express server: API + cron reminder jobs
  package.json
  .env.example         — copy to .env, holds VAPID keys & schedule
  data/db.json          — created automatically, stores your synced state + push subscriptions
  public/
    index.html          — the app itself
    manifest.json        — makes it installable
    sw.js                 — service worker: push handling + offline cache
    icons/
```

## Notes & limits
- This is a single-user personal app — no login, no multi-device conflict resolution. If you
  install it on two phones, the second one will overwrite the first's data on first sync.
- The reminder times are fixed schedules (twice a day), not one push per exact due-time — this
  keeps the server simple and avoids needing a database for one-off precise timers. Ask if you
  later want per-item exact-time pushes; it's a small extension to the cron logic.
