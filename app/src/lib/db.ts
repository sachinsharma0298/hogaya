// One tiny database interface, two engines:
//   - DATABASE_URL set  -> Supabase Postgres (production, Vercel)
//   - not set           -> an embedded Postgres (PGlite) kept in ../data/pgdata, for local work and tests
// Both speak the same SQL, so the rest of the app never knows which one it is on.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";

export type Row = Record<string, unknown>;
export interface Queryable {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run several statements at once (no parameters). Used for migrations. */
  exec(text: string): Promise<void>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  engine: "postgres" | "pglite";
}

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// In dev the module can be reloaded: keep one connection per process.
const g = globalThis as unknown as { __hogayaDb?: Promise<Db> };

/** True for "could not get a connection" errors (pool full, connect timeout): nothing ran yet, so trying again is safe. */
export const isConnectionBusy = (e: unknown) => {
  const x = e as { code?: string; message?: string } | undefined;
  return /EMAXCONN|CONNECT_TIMEOUT|ECONNREFUSED|ETIMEDOUT/i.test(String(x?.code ?? "")) || /max clients reached|too many clients|EMAXCONN|CONNECT_TIMEOUT/i.test(String(x?.message ?? ""));
};
async function whenConnected<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 4 || !isConnectionBusy(e)) throw e;
      await new Promise((r) => setTimeout(r, 300 * 2 ** i + Math.random() * 200)); // 0.3s, 0.6s, 1.2s, 2.4s
    }
  }
}

async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  // Serverless: every running instance holds its own connections, and Supabase's pooler has a small fixed number (15 in session mode).
  // So each instance keeps ONE connection (transactions queue behind each other) and lets it go quickly when idle.
  // prepare:false is required by Supabase's transaction pooler (port 6543) and harmless on the session pooler.
  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 15 });
  const wrap = (s: { unsafe: (t: string, p?: never[]) => Promise<unknown> }): Queryable => ({
    query: async <T,>(text: string, params: unknown[] = []) => (await s.unsafe(text, params as never[])) as T[],
    exec: async (text: string) => { await s.unsafe(text); },
  });
  const top = wrap(sql as never);
  return {
    engine: "postgres",
    query: <T,>(text: string, params: unknown[] = []) => whenConnected(() => top.query<T>(text, params)),
    exec: (text: string) => whenConnected(() => top.exec(text)),
    // Only the connection step is retried: if the pool was full, no statement of this transaction has run.
    tx: (fn) => whenConnected(() => sql.begin((t) => fn(wrap(t as never))) as never),
  };
}

async function openPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR === "memory" ? undefined : (process.env.PGLITE_DIR ?? path.join(DATA_DIR, "pgdata"));
  if (dir) fs.mkdirSync(path.dirname(dir), { recursive: true });
  const pg = new PGlite(dir);
  await pg.waitReady;
  // Supabase provides these. Locally we make small stand-ins so the same migration runs unchanged.
  await pg.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
    create or replace function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  // Serialise transactions: PGlite has one connection.
  let chain: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };
  return {
    engine: "pglite",
    query: <T,>(text: string, params: unknown[] = []) => exclusive(async () => (await pg.query(text, params)).rows as T[]),
    exec: (text: string) => exclusive(async () => { await pg.exec(text); }),
    tx: <T,>(fn: (q: Queryable) => Promise<T>) =>
      exclusive(() =>
        pg.transaction((t) =>
          fn({
            query: async <R,>(text: string, params: unknown[] = []) => (await t.query(text, params)).rows as R[],
            exec: async (text: string) => { await t.exec(text); },
          }),
        ),
      ),
  };
}

export async function runMigrations(db: Db): Promise<string[]> {
  await db.query("create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  await db.query("alter table public.schema_migrations enable row level security"); // internal bookkeeping: nobody can read it through the public API
  const done = new Set((await db.query<{ name: string }>("select name from public.schema_migrations")).map((r) => r.name));
  const applied: string[] = [];
  const files = fs.existsSync(MIGRATIONS_DIR) ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort() : [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    await db.tx(async (q) => {
      await q.exec(sqlText);
      await q.query("insert into public.schema_migrations (name) values ($1)", [f]);
    });
    applied.push(f);
  }
  const seed = path.join(process.cwd(), "supabase", "seed.sql");
  if (fs.existsSync(seed)) await db.exec(fs.readFileSync(seed, "utf8"));
  return applied;
}

export function getDb(): Promise<Db> {
  if (!g.__hogayaDb) {
    g.__hogayaDb = (async () => {
      const url = process.env.DATABASE_URL;
      const db = url ? await openPostgres(url) : await openPglite();
      // Locally we migrate automatically. On Supabase the operator runs `npm run db:migrate` once (never automatic).
      if (db.engine === "pglite") await runMigrations(db);
      return db;
    })();
    g.__hogayaDb.catch(() => { g.__hogayaDb = undefined; });
  }
  return g.__hogayaDb;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await getDb()).query<T>(text, params);
}
export async function tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).tx(fn);
}

/** Postgres array literal for a text[] parameter, e.g. ["a","b"] -> {"a","b"}. */
export const pgArray = (a: string[] | undefined | null): string | null =>
  a ? `{${a.map((x) => `"${String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}` : null;
export const jsonParam = (v: unknown): string | null => (v === undefined || v === null ? null : JSON.stringify(v));
export const iso = (v: unknown): string | undefined =>
  v == null ? undefined : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
