// npm run db:migrate  -> applies supabase/migrations/*.sql and supabase/seed.sql to DATABASE_URL (or the local database).
import { getDb, runMigrations } from "../src/lib/db";

(async () => {
  const db = await getDb();
  const applied = await runMigrations(db);
  console.log(`[${db.engine}] migrations applied: ${applied.length ? applied.join(", ") : "none (already up to date)"}; categories seeded.`);
  process.exit(0);
})().catch((e) => { console.error("Migration failed:", e instanceof Error ? e.message : e); process.exit(1); });
