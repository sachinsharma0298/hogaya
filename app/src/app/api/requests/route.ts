import { NextResponse } from "next/server";
import { isCategory } from "@/lib/categories";
import { kick, kickAll } from "@/lib/kick";
import { newRequest } from "@/lib/orchestrator";
import { MODE, REAL_STEPS } from "@/lib/agent-service";
import { requireRole } from "@/lib/guard";
import { toE164 } from "@/lib/phone";
import { isOperatorPhone, OPERATOR_PHONE_ERROR } from "@/lib/store";
import { decideLive, MAX_REQUESTS_PER_DAY, MAX_REQUESTS_PER_USER_PER_DAY } from "@/lib/live";
import { DRY_RUN } from "@/lib/mode";
import { getProviders, insertRequest, listRequests, requestCounts } from "@/lib/store";

export const maxDuration = 300;

export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  kickAll(); // while the console is open it also keeps the bookings moving
  const config = { agentMode: MODE, dryRun: DRY_RUN, realSteps: MODE === "real" ? REAL_STEPS : { provider: false, customer: false, booking: false, reconfirm: false, arrival: false, on_the_way: false } };
  return NextResponse.json({ requests: await listRequests(), providers: await getProviders(), config });
}

export async function POST(req: Request) {
  const auth = await requireRole("customer", "operator");
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => null);
  const need = ["category", "problem", "sector", "address", "time_window", "name", "phone"];
  if (!b || need.some((k) => !String(b[k] ?? "").trim())) {
    return NextResponse.json({ error: "Some details are missing. Please fill all fields." }, { status: 400 });
  }
  if (!isCategory(b.category)) {
    return NextResponse.json({ error: "Please choose a category." }, { status: 400 });
  }
  if (b.consent !== true) {
    return NextResponse.json({ error: "Consent for the Fo call is required." }, { status: 400 });
  }
  const user = auth.user;
  const phone = toE164(b.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid phone number (choose the country code)." }, { status: 400 });
  if (user.role !== "operator" && (await isOperatorPhone(phone))) return NextResponse.json({ error: OPERATOR_PHONE_ERROR }, { status: 409 });
  // Rate limits: a few bookings per person per day, and a cap for the whole site (the operator is exempt from the first).
  const counts = await requestCounts(user.id);
  if (user.role === "customer" && counts.mine >= MAX_REQUESTS_PER_USER_PER_DAY) {
    return NextResponse.json({ error: `You have made ${MAX_REQUESTS_PER_USER_PER_DAY} requests today. Please try again tomorrow.`, code: "rate_limited" }, { status: 429 });
  }
  if (counts.all >= MAX_REQUESTS_PER_DAY) {
    return NextResponse.json({ error: "Hogaya is very busy today. Please try again later.", code: "site_busy" }, { status: 429 });
  }
  // Real Fo calls only for approved people. Everyone else gets the same flow with simulated calls.
  const { live } = await decideLive(user, phone, b.category);
  const r = await newRequest({ ...b, phone, demo: !live, notes: typeof b.notes === "string" ? b.notes.slice(0, 500) : undefined, user_id: user.id });
  await insertRequest(r);
  kick(r.id); // the first tick runs right after this response; later ticks come from the timer and the open screens
  return NextResponse.json({ id: r.id, demo: r.demo });
}
