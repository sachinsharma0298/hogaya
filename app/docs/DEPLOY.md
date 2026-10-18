# Deploying Hogaya (Vercel + Supabase)

Nothing here has been run for you. Every step below happens outside your Mac, so do it one step at a time, and stop if anything looks different from what is written.

**What you need:** a GitHub account, a Supabase account, a Vercel account (all free plans work), a Google account (for Google sign-in), and your Claude API key.

## 0. Before anything is pushed

The repository history must be clean (no phone numbers, no `.env` files, no tokens, no real addresses). Run the check again right before pushing:

```
git log --all -p | grep -E "^\+" | grep -oE "(\+?91[ -]?)?[6-9][0-9]{4}[ -]?[0-9]{5}" | sort -u
git log --all --name-only --pretty=format: | sort -u | grep -iE "\.env|data/|token|secret|fo-auth|db\.json"
```

Both should print nothing except the dummy numbers in `scripts/test-*.ts`.

## 1. GitHub (public repo `hogaya`)

```
cd hogaya
gh auth status                 # must say you are logged in
gh repo create hogaya --public --source=. --remote=origin --push
```

This makes the code public. Wait for your OK before running it.

## 2. Supabase

1. supabase.com → **New project**. Name `hogaya`. Region: **Mumbai (ap-south-1)** (closest to your users). Choose a database password and save it in your password manager.
2. Collect four values (you will paste them into Vercel in step 5):

| Name | Where to find it | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` / "publishable" key | public (safe: row-level security is on) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` / "secret" key | **SECRET. Server only.** |
| `DATABASE_URL` | Project Settings → Database → Connection string → **Transaction pooler** (port 6543). Replace `[YOUR-PASSWORD]` | **SECRET. Server only.** |

3. **Create the tables.** On your Mac, in the `app` folder, run this ONE command (the URL goes in only for this command and is not saved anywhere):

```
cd hogaya/app
DATABASE_URL='paste-the-pooler-url-here' npm run db:migrate
```

It prints which migrations it applied. Alternative with no terminal: open Supabase → SQL Editor and run the files `supabase/migrations/0001_init.sql`, `0002_guardrails.sql`, `0003_tick.sql` and then `supabase/seed.sql`, in that order.

4. **Sign-in settings.** Authentication → URL Configuration:
   - Site URL: `https://YOUR-APP.vercel.app` (you get this name in step 5; come back and fill it in)
   - Redirect URLs: add `https://YOUR-APP.vercel.app/auth/callback` and `https://YOUR-APP.vercel.app/auth/confirm` (and `http://localhost:3000/auth/callback` if you want to test locally against Supabase).
5. **Email.** Magic links work out of the box, but Supabase's built-in email sender is limited to a very small number of emails per hour. Before inviting real people, add your own email service under Authentication → SMTP Settings.
6. **Google sign-in.** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application. Under "Authorized redirect URIs" put `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (the exact address is shown on Supabase's Google provider page). Copy the Client ID and Client secret into Supabase → Authentication → Providers → Google, and switch it on.

## 3. Pick the secret for the timer

Make a long random string and keep it: `openssl rand -hex 32`. This is `CRON_SECRET`.

## 4. Vercel

1. vercel.com → **Add New → Project** → import the `hogaya` repo.
2. **Root Directory: `app`**. Framework: Next.js (detected).
3. Environment variables (Settings → Environment Variables, Production):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | from step 2 |
| `APP_URL` | `https://YOUR-APP.vercel.app` (no trailing slash) |
| `OPERATOR_EMAIL` | your email: the only operator |
| `CRON_SECRET` | from step 3 |
| `ANTHROPIC_API_KEY` | your Claude key |
| `AGENT_MODE` | `demo` for now (everything simulated). Switch to `real` only when you are ready for real calls. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | optional: shown on the "Join as a Pro" page |

Do **not** add `DEV_LOGIN`, `FO_DRY_RUN`, or anything starting with `NEXT_PUBLIC_` that holds a secret.

4. Deploy. After the first deploy, copy the real address into `APP_URL` and into Supabase's Site URL / Redirect URLs, then redeploy.
5. Optional: Settings → Functions → region **Mumbai (bom1)** to sit next to the database.

## 5. Sign in to Fo once

Open `https://YOUR-APP.vercel.app/api/fo/connect` while signed in as the operator. It sends you to Wajo to sign in and brings you back to `/api/fo/callback`. There is nothing to register by hand: the app registers itself with Fo with the redirect address `APP_URL/api/fo/callback` (dynamic client registration). **Unknown until you try:** whether Wajo accepts a `vercel.app` address. If it shows an error, tell me the exact words.

## 6. The one-minute timer (Supabase pg_cron + pg_net)

Vercel's free plan only allows a cron job once a day, so the timer lives in Supabase. In Supabase → SQL Editor, run (replace the two values):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://YOUR-APP.vercel.app/api/tick', 'hogaya_tick_url');
select vault.create_secret('YOUR_CRON_SECRET', 'hogaya_cron_secret');

select cron.schedule('hogaya-tick', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'hogaya_tick_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hogaya_cron_secret')),
    timeout_milliseconds := 55000
  );
$$);
```

Check it runs: `select * from cron.job_run_details order by start_time desc limit 5;`
Stop it any time: `select cron.unschedule('hogaya-tick');`

## 7. First run

1. Open the site, sign in with your `OPERATOR_EMAIL` → `/operator`.
2. Onboard yourself as a Pro with your own number (Providers tab), and approve yourself as a customer (Approved tab).
3. Everyone else gets "Demo: simulated calls". Nobody is phoned until `AGENT_MODE=real`.
4. When ready: set `AGENT_MODE=real` in Vercel and redeploy. Keep Autopilot OFF until you have watched one call yourself.

## Emergency stops (any one is enough)

- Vercel: set `AGENT_MODE=demo` and redeploy: every call becomes simulated.
- Approved tab: remove a number: live calls to it stop immediately.
- `select cron.unschedule('hogaya-tick');` stops the timer.
- Operator console: turn Autopilot OFF; Pause or Cancel one booking.
