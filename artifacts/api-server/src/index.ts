import { createHash } from "crypto";
import { readFileSync } from "fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "url";
import path from "path";
import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Migrations folder is bundled alongside the built output
const migrationsFolder = path.resolve(__dirname, "./migrations");

/**
 * Bootstrap migration history for databases that were provisioned via `drizzle-kit push`
 * before this migration-based flow was introduced.
 *
 * Drizzle's migrate() runs every migration whose journal `when` (folderMillis) is greater
 * than the `created_at` of the most-recently applied migration in __drizzle_migrations.
 * Bootstrap rows MUST use the journal's `when` values, not Date.now(), so Drizzle's
 * ordering logic remains correct.
 *
 * Three cases:
 *   1. Fresh DB (no `trips`) → do nothing; migrate() runs 0000 then 0001.
 *   2. Pre-pitstop DB (`trips` exists, no `pitstop_responses`) → mark 0000 done
 *      (with its journal timestamp); migrate() sees 0001.when > 0000.when and runs 0001.
 *   3. Fully-initialised DB (`pitstop_responses` already exists) → mark both done
 *      (with their journal timestamps); migrate() is a no-op.
 */
type JournalEntry = { tag: string; when: number };

function journalEntries(): JournalEntry[] {
  const journal = JSON.parse(
    readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf-8"),
  ) as { entries: { tag: string; when: number }[] };
  return journal.entries;
}

function sqlHash(tag: string): string {
  const sql = readFileSync(path.join(migrationsFolder, `${tag}.sql`), "utf-8");
  return createHash("sha256").update(sql).digest("hex");
}

const client = await pool.connect();
try {
  const { rows: tripsCheck } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'trips'`,
  );

  if (tripsCheck.length > 0) {
    // Database was already provisioned; ensure the drizzle tracking schema/table exist.
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `);

    const entries = journalEntries();

    // Determine how many migrations to mark as done based on which tables exist.
    const { rows: pitstopCheck } = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'pitstop_responses'`,
    );
    // Mark 0000 always (original tables existed via push).
    // Mark 0001 only if pitstop_responses already exists (was also push'd).
    const applyUpTo = pitstopCheck.length > 0 ? entries.length : 1;

    for (let i = 0; i < applyUpTo; i++) {
      const entry = entries[i]!;
      const hash = sqlHash(entry.tag);
      // Use the journal's `when` timestamp so Drizzle's ordering logic stays correct.
      await client.query(
        `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM drizzle."__drizzle_migrations" WHERE hash = $1
         )`,
        [hash, entry.when],
      );
    }
  }
} catch (err) {
  logger.error({ err }, "Migration bootstrap failed");
  await pool.end();
  process.exit(1);
} finally {
  client.release();
}

try {
  await migrate(db, { migrationsFolder });
  logger.info("Database migrations applied");
} catch (err) {
  logger.error({ err }, "Database migration failed");
  await pool.end();
  process.exit(1);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
