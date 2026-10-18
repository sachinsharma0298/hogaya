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

async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  // Supabase's pooler (transaction mode) does not support prepared statements; keep the pool tiny on serverless.
  const sql = postgres(url, { max: 3, prepare: false, idle_timeout: 20, connect_timeout: 15 });
  const wrap = (s: { unsafe: (t: string, p?: never[]) => Promise<unknown> }): Queryable => ({
    query: async <T,>(text: string, params: unknown[] = []) => (await s.unsafe(text, params as never[])) as T[],
    exec: async (text: string) => { await s.unsafe(text); },
  });
  return {
    engine: "postgres",
    ...wrap(sql as never),
    tx: (fn) => sql.begin((t) => fn(wrap(t as never))) as never,
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
