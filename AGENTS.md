# AGENTS.md

## Cursor Cloud specific instructions

Grid Ledger is a single Next.js 16 (App Router) app that serves a public policy/market dashboard plus a protected admin workbench, backed by local Supabase (Postgres + Auth + Storage). There is one service to run: the Next.js dev server. Everything else it depends on runs inside the local Supabase Docker stack.

Standard commands live in `package.json` and `README.md` (`npm run dev`, `lint`, `typecheck`, `test`, `test:e2e`, `build`, `db:start`, `db:reset`). Prefer those; the notes below only cover non-obvious startup/run caveats.

### Dependencies already handled by the update script
`npm install` runs automatically on VM startup. Node 22 is present and satisfies the `>=20.18.1` engine requirement.

### Local Supabase requires Docker, started manually per boot
Local Supabase needs Docker, and this VM has no systemd, so nothing starts Docker automatically. On a fresh session (before `npx supabase start` / `npm run db:*` / any HTTP E2E), do this once:

```bash
# Start the Docker daemon in the background (tmux keeps it alive)
sudo dockerd >/tmp/dockerd.log 2>&1 &
sleep 8
# Make the socket usable without sudo for the rest of the session
sudo chmod 666 /var/run/docker.sock
docker ps   # should succeed
```

Docker on this VM is configured for `fuse-overlayfs` storage and `iptables-legacy` (already set in `/etc/docker/daemon.json` and via update-alternatives). If `sudo dockerd` fails on storage/iptables, re-check those.

Then bring up the database stack (applies migrations + `supabase/seed.sql`):

```bash
npx supabase start          # first boot of the stack; ~1-2 min pulling/starting containers
# npx supabase db reset     # replay migrations + seed from scratch
```

### Environment file
The app reads `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`) from `.env.local`. `.env.local` is gitignored and is NOT recreated by the update script — create it if missing. Local Supabase uses fixed demo keys, so these values are stable across restarts:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

Get current keys anytime with `npx supabase status -o env`. `OPENAI_API_KEY` is only needed for the AI URL/PDF/XLSX import extraction path; core dashboard, admin CRUD, publish, and CSV import work without it.

### Admin login (no signup UI)
There is no self-serve registration; admin authority comes from `app_metadata.role = "admin"` (never `user_metadata`). Create/promote an admin with the local service-role key (run from the repo root so `@supabase/supabase-js` resolves):

```js
import { createClient } from "@supabase/supabase-js";
const admin = createClient("http://127.0.0.1:54321", process.env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await admin.auth.admin.createUser({ email: "admin@example.com", password: "AdminDemo123!", email_confirm: true, app_metadata: { role: "admin" } });
```

The app runtime itself never uses the service-role key; it is only for local admin bootstrap and E2E cleanup.

### HTTP end-to-end tests need explicit env vars
`npm run test:e2e` is an in-memory domain regression and needs nothing extra. The real HTTP/Supabase suites (`test:e2e:http`, `test:e2e:imports`) require the dev server + Supabase running and these four vars (JWT anon/service-role keys, not the publishable key):

```bash
APP_URL=http://127.0.0.1:3000 \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<ANON_KEY from supabase status> \
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status> \
npm run test:e2e:http
```
