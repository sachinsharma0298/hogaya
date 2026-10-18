import { finishAuth } from "@/lib/fo-mcp";
import { requireRole } from "@/lib/guard";

export async function GET(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const err = u.searchParams.get("error_description") ?? u.searchParams.get("error");
  const page = (title: string, body: string) =>
    new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem;background:#fbf7f2;color:#231a12"><h1>${title}</h1><p>${body}</p>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (!code) return page("Fo sign-in did not finish", (err ?? "No code came back.").replace(/[<>&]/g, ""));
  try {
    await finishAuth(code);
    return page("Fo is connected ✓", "You can close this tab and tell Claude Code you are done.");
  } catch (e) {
    return page("Fo sign-in failed", (e instanceof Error ? e.message : String(e)).replace(/[<>&]/g, "").slice(0, 300));
  }
}
