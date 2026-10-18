import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { tickAll } from "@/lib/engine";

export const maxDuration = 300;

// The one-minute timer calls this (see docs/DEPLOY.md). It moves every open booking one short step forward.
// Allowed callers: the timer (it sends "Authorization: Bearer <CRON_SECRET>") or the signed-in operator ("Check now").
async function allowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  if (secret && bearer === `Bearer ${secret}`) return true;
  return (await getSessionUser())?.role === "operator";
}

async function run(req: Request) {
  if (!(await allowed(req))) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await tickAll(50_000)) });
}

export const GET = run;
export const POST = run;
