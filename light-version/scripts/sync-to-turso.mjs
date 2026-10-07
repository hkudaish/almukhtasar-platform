import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../database/light-news.db");
const seedOutPath = path.resolve(__dirname, "../database/turso-seed.sql");

if (!fs.existsSync(dbPath)) {
  console.error("Local database not found at:", dbPath);
  process.exit(1);
}

const sqlite = new DatabaseSync(dbPath);

async function main() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  console.log("=== Almokhtasar (المختصر) - Turso Database Synchronizer ===");
  console.log("Source SQLite database:", dbPath, `(${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // 1. Generate SQL Seed file for direct Turso CLI import: turso db shell <name> < turso-seed.sql
  console.log("Generating turso-seed.sql...");
  const tableRows = sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  const indexRows = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL").all();

  const sqlStatements = [];
  sqlStatements.push("-- Almokhtasar News Platform Seed for Turso LibSQL");
  sqlStatements.push("PRAGMA foreign_keys = OFF;");

  const coreTables = [
    "sources",
    "settings",
    "articles",
    "trends",
    "social_hashtags",
    "social_platforms",
    "social_settings",
    "daily_briefs",
    "retrieval_schedules",
    "source_retrieval_state",
    "cache_versions"
  ];

  for (const t of tableRows) {
    sqlStatements.push(`CREATE TABLE IF NOT EXISTS ${t.sql.replace(/^CREATE TABLE /i, "")};`);
    
    // Export data for core tables
    if (coreTables.includes(t.name)) {
      const rows = sqlite.prepare(`SELECT * FROM ${t.name}`).all();
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        for (const row of rows) {
          const vals = cols.map(c => {
            const val = row[c];
            if (val === null || val === undefined) return "NULL";
            if (typeof val === "number") return String(val);
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          sqlStatements.push(`INSERT OR REPLACE INTO ${t.name} (${cols.join(",")}) VALUES (${vals.join(",")});`);
        }
      }
      console.log(`  -> Table ${t.name}: ${rows.length} rows exported`);
    }
  }

  for (const idx of indexRows) {
    sqlStatements.push(`${idx.sql};`);
  }
  sqlStatements.push("PRAGMA foreign_keys = ON;");

  fs.writeFileSync(seedOutPath, sqlStatements.join("\n"), "utf8");
  console.log(`✓ Seed SQL generated at: ${seedOutPath} (${(fs.statSync(seedOutPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // 2. If TURSO_DATABASE_URL is provided, sync directly via @libsql/client
  if (tursoUrl && tursoToken) {
    console.log(`\nConnecting to remote Turso database at ${tursoUrl}...`);
    try {
      const { createClient } = await import("@libsql/client");
      const client = createClient({ url: tursoUrl, authToken: tursoToken });

      console.log("Executing schema and core table sync to Turso in batches...");
      // Filter out comments and empty statements
      const validStmts = sqlStatements.filter(s => s.trim() && !s.trim().startsWith("--"));
      const batchSize = 50;
      for (let i = 0; i < validStmts.length; i += batchSize) {
        const batch = validStmts.slice(i, i + batchSize);
        await client.batch(batch.map(sql => ({ sql, args: [] })), "write");
        process.stdout.write(`  Synced statements ${Math.min(i + batchSize, validStmts.length)} / ${validStmts.length}\r`);
      }
      console.log("\n✓ All tables and records successfully synchronized to Turso!");
    } catch (err) {
      console.error("Failed to sync directly to Turso via API:", err.message);
      console.log("You can still use Turso CLI to import the generated file:");
      console.log(`  turso db shell <database-name> < ${seedOutPath}`);
    }
  } else {
    console.log("\n[Notice] TURSO_DATABASE_URL and TURSO_AUTH_TOKEN were not set in the environment.");
    console.log("To push to Turso via CLI:");
    console.log(`  1. turso db create almukhtasar-db`);
    console.log(`  2. turso db shell almukhtasar-db < ${seedOutPath}`);
    console.log(`  3. turso db show almukhtasar-db --url (Get URL)`);
    console.log(`  4. turso db tokens create almukhtasar-db (Get Token)`);
    console.log("  5. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to Netlify Environment Variables.");
  }
}

main().catch(err => {
  console.error("Error running synchronizer:", err);
  process.exit(1);
});
