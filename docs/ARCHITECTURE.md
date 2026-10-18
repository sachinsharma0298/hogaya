# Hogaya: architecture

Hogaya is an AI booking agent for home services in India. A customer says what is broken; the job gets booked with a local Pro who is confirmed on both sides, and someone actually shows up.

## The flow

1. **Request.** The customer signs in and describes the job in three short steps (what is wrong, where and when, name and phone). They tick a box to agree to an AI phone call.
2. **Matching.** Hogaya picks the best Pros for the category from its own network: people Hogaya onboarded personally, who agreed to AI calls, ranked by reliability measured from real outcomes.
3. **Fo calls the Pros.** One at a time, in simple Hinglish, Fo asks whether the Pro can come, at what time and for what price.
4. **Fo calls the customer back** with the options side by side and Hogaya's recommendation. The customer chooses.
5. **Booking call.** Fo calls the chosen Pro to confirm. The address is shared only now, after the customer has approved.
6. **Reconfirm.** An hour before the slot, Fo reconfirms. If the Pro cannot make it, the next best Pro (the backup) is booked and the customer is told.
7. **Arrival.** The customer gives the Pro a 4-digit service code at the door. The Pro enters it in the Pro app and the customer sees "Pro has arrived". A wrong code alerts the operator.
8. **Done.** The Pro sends a final bill, the customer presses "Job done" and rates the job. The outcome updates the Pro's reliability score.

An operator console shows every booking with one clean timeline, and lets a person pause, retry, take over or cancel at any point.

## Built on Fo

[Fo by Wajo](https://wajo.ai) is the voice at the centre of Hogaya. It does what only an agent that can really phone people can do: speak natural Hinglish, handle a real conversation, and report back what was said. Hogaya is the local-services layer on top of that:

| Fo does | Hogaya adds |
|---|---|
| Phones Pros and customers and holds the conversation | A consented, personally onboarded network of local Pros |
| Reports back a call summary | Reliability scores built from real outcomes |
| | Two-sided confirmation, reconfirm and a backup Pro |
| | Address shared only after the customer approves |
| | A service code that proves the Pro arrived |
| | An operator console and the rules that keep calls safe |

Fo is reached through its MCP server behind a small `VoiceProvider` interface, so the voice layer stays swappable. Claude reads Fo's call summaries and turns them into structured data; Hogaya never relies on the format Fo happens to write.

## Trust rules

- **Consent first.** A phone is only called if its owner agreed to AI calls, and the consent is recorded with its date. A Pro who opts out is never called.
- **Approved numbers only.** Real calls go only to numbers on the operator's approved list. Anyone else gets the same flow as "Demo: simulated calls": nobody is phoned.
- **Honest labels.** Simulated results are always marked. Details a Pro did not confirm are shown as "not confirmed".
- **Calls are limited.** One live call at a time (enforced by the database), at most two attempts per person per step, a daily request limit per user.
- **Privacy.** Customers see only their own bookings. A Pro never sees the customer's phone number, and sees the address only after the customer confirms.
- **The service code stays secret.** It is never given to Fo or to Claude; Hogaya's own code compares what the Pro enters.
- **A person stays in charge.** The operator can pause, retry, take over or cancel; anything unusual raises a flag and autopilot waits.

## Tech stack

- **App:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui. Deployed on Vercel.
- **Data and sign-in:** Supabase: Postgres with row-level security on every table, and Auth (Google, with an email magic link as a backup).
- **Voice:** Fo (Wajo) over MCP with OAuth sign-in, behind a `VoiceProvider` interface.
- **Understanding calls:** Claude turns each call summary into JSON with allowed values only.
- **No long-running server:** a tick engine moves each booking one short step at a time. A timer (Supabase pg_cron) calls `/api/tick` every minute.
- **Languages:** English, Hinglish and Hindi on customer and Pro screens; Fo speaks Hinglish.

More: [deploying](../app/docs/DEPLOY.md).
