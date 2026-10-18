# Hogaya

**Kaam hogaya. Pakka.** An AI booking agent for home services in India, built on [Fo by Wajo](https://wajo.ai).

You say what is broken. Fo phones local pros in Hinglish, asks for time and price, calls you back with the options and a recommendation, books your pick, reconfirms an hour before, and checks the Pro arrives with a 4-digit service code. Hogaya adds the parts Fo does not: a consented local Pro network that Hogaya onboards itself, reliability scores from real outcomes, two-sided confirmation, your address shared only after you approve, a backup Pro, and an operator console.

How it works: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## How it is built

- Next.js 16, TypeScript, Tailwind, shadcn/ui. Deployed on Vercel.
- Supabase: Postgres with row-level security, and Auth (Google, with an email magic link as a backup).
- Fo is reached through the Fo MCP server behind a swappable `VoiceProvider` interface (`src/lib/agent-service.ts`). Claude turns Fo's call summaries into JSON.
- No long-running server: a **tick engine** (`src/lib/engine.ts`) moves each booking one short step at a time. A timer calls `/api/tick` every minute.

## Safety by design

- Live Fo calls only reach numbers on the operator's **approved list**, with consent recorded. Everyone else gets the same flow as "Demo: simulated calls".
- One live call at a time (enforced by the database), at most 2 attempts per person per step, 3 requests per user per day.
- The service code is never given to Fo or to Claude; our own code compares it.
- Customers see only their own bookings; Pros never see the customer's phone or the service code.

## Run it on your computer

```
cd app
npm install
npm run dev                 # or: npm run build && npm run start
```

With no `DATABASE_URL` the app uses an embedded Postgres in `../data` (git-ignored) and, with `DEV_LOGIN=1` in `.env.local`, a local test login. Copy `.env.example` to `.env.local`.

## Tests (none of them place a real call)

```
npm run test:db          # schema, row-level security, one-live-call rule
npm run test:fo-poll     # how a live Fo call is followed (scripted stand-in for Fo)
# with a rehearsal server running (see the header of each script):
npm run test:access      # who can reach what
npm run test:live-gate   # who gets live vs simulated calls
npm run test:engine      # the tick engine, Autopilot, queue, flags
```

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md).
