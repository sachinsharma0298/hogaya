# Accounts, sign-in and what is NOT verified yet

## Ways to sign in
- **Email + password** (a person registers with name, email, phone and a password they choose). Passwords are kept and checked by Supabase Auth (hashed). Hogaya never stores or sees them.
- **Email link** (magic link). Limited by Supabase's built-in email sender (about 3 emails per hour, and only to team members until you add your own email service). Password sign-in avoids this limit: no email is sent.
- **Google**: hidden until it is set up (`NEXT_PUBLIC_GOOGLE_LOGIN=1`).
- **Accounts the operator creates** (Accounts tab): customers and Pros, with a password the operator chooses and hands over. These emails cannot be self-registered.
- **Operator**: the one email in `OPERATOR_EMAIL`. Set its password once with `npm run operator:password` (hidden prompt; nothing is stored or printed).
- **Test login** (dummy phone, fixed code 123456): local development only (`DEV_LOGIN=1`). It is refused whenever `DATABASE_URL` is set, so it cannot exist on the live site.

## Phone verification is switched off (security implications)
Phone OTP is not built. So:
- A phone number typed at registration is **not proven to belong to the person**. Treat it as a claim.
- Self-registered accounts can only ever be plain customers. They get "Demo: simulated calls". A live call needs the operator to approve **the email and the number together**, so typing someone else's number does nothing.
- Emails that carry special rights (the operator, an onboarded Pro, an approved customer) cannot be self-registered. Otherwise anyone could register that address and take it over, because the server confirms self-registered emails without checking the inbox.
- New accounts are capped (30 per hour for the whole site) and each customer is limited to 3 bookings a day.
- Before opening to the public, add phone OTP and confirm emails by link.

## Roles are decided by the server only
The role is set from the Supabase user's confirmed email (operator) or the Pro list (Pro). A user cannot change their own role, and every API route checks the role again on the server.
