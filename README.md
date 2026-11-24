# Fleurie - Beauty Lounge booking and management

## Run locally
    bun install
    bun run dev          # http://localhost:3100  (admin: /admin/login)

First start creates the database and two staff accounts. One-time passwords are in `.data/initial-passwords.txt`
(change them at first sign-in, then delete the file).

## Production (see DEPLOY.md)
    npm install && npm run build && PORT=3100 npm start     # Node 20+ (build with Node, not Bun)
Required env: `AUTH_SECRET`, `CRON_SECRET`, `APP_URL`; `DATABASE_URL` for hosted Postgres. See `.env.example`.

## Backup and restore
    bun scripts/backup.ts [folder]     # gzip of all data + uploads, keeps last 14
    bun scripts/restore.ts <file>      # replaces everything with the backup
Admin can also download a backup from Admin > Backup.
