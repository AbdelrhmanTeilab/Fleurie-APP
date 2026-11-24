# Free deployment: GitHub + Render + Neon (+ UptimeRobot)

Images and payment proofs are stored in the database, so nothing important lives on the host's disk.

## 1. Code on GitHub
Create a PRIVATE repository, then from this folder:
    git remote add origin https://github.com/<you>/fleurie.git
    git push -u origin main

## 2. Database (Neon, free)
neon.tech > new project > copy the connection string (starts with postgres://, keep ?sslmode=require).

## 3. Website (Render, free)
Render > New > Blueprint > pick the repo (it reads render.yaml). Fill in:
- DATABASE_URL = the Neon string
- APP_URL = the Render address, e.g. https://fleurie.onrender.com (no trailing slash)
AUTH_SECRET and CRON_SECRET are generated automatically (copy CRON_SECRET from Render > Environment).
First start creates the tables and the two staff accounts. Their passwords are printed ONCE in Render > Logs
(search for "[seed]"). Sign in at /admin/login and change them immediately.

## 4. Keep it awake (UptimeRobot, free)
New HTTP monitor on APP_URL/api/health every 5 minutes. (Free Render sleeps after 15 idle minutes.)

## 5. Reminders (GitHub Actions, free)
Repo > Settings > Secrets and variables > Actions: add CRON_SECRET and APP_URL (same values as Render).
The workflow .github/workflows/reminders.yml then calls the reminders endpoint every hour.

## 6. Backups
Admin > Backup > download. Do it weekly and keep the file somewhere safe (it holds all data and proofs).
Restore: bun scripts/restore.ts <file> with DATABASE_URL set.

## 7. Messages
Without RESEND_API_KEY / WHATSAPP_* the messages wait in Admin > Outbox for manual sending.

## Later: move to a small paid server (about 2-5 USD/month)
Same code: Node 20+, `npm run build && PORT=3100 npm start` behind HTTPS, same env variables.

Limits: free Render wakes slowly (about 30 s) after idle; Neon free is about 0.5 GB; login rate limits reset on restart.
