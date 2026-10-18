// npm run operator:password -> sets (or resets) the password of OPERATOR_EMAIL in Supabase Auth, so the operator can sign in
// with email + password and never needs an email link. Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OPERATOR_EMAIL.
// The password is typed at the prompt (hidden) and never stored by us or printed.
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, email = (process.env.OPERATOR_EMAIL ?? "").toLowerCase();
  if (!url || !key || !email) { console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OPERATOR_EMAIL first."); process.exit(1); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {}; // hide typing
  process.stdout.write(`New password for ${email} (8+ characters): `);
  const pw: string = await new Promise((r) => rl.question("", r));
  rl.close(); process.stdout.write("\n");
  if (pw.length < 8 || pw.length > 72) { console.error("The password needs 8 to 72 characters."); process.exit(1); }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = list.data.users.find((x) => x.email?.toLowerCase() === email);
  const res = u ? await admin.auth.admin.updateUserById(u.id, { password: pw, email_confirm: true }) : await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  console.log(res.error ? `Failed: ${res.error.message}` : "Operator password set. Sign in with email + password.");
  process.exit(res.error ? 1 : 0);
})();
