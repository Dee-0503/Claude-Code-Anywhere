import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SqliteDatabase } from "./connection.js";

const CURRENT_SCHEMA_VERSION = 1;
const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export interface MigrationResult {
  readonly applied: readonly Migration[];
  readonly currentVersion: number;
}

function schemaPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "schema.sql");
}

export function loadInitialSchema(): string {
  return readFileSync(schemaPath(), "utf8");
}

export function getMigrations(): readonly Migration[] {
  return [
    {
      version: CURRENT_SCHEMA_VERSION,
      name: "initial_schema",
      sql: loadInitialSchema(),
    },
  ];
}

export function ensureMigrationsTable(database: SqliteDatabase): void {
  database.exec(MIGRATIONS_TABLE_SQL);
}

export function getCurrentSchemaVersion(database: SqliteDatabase): number {
  ensureMigrationsTable(database);

  const row = database
    .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
    .get() as { version: number } | undefined;

  return row?.version ?? 0;
}

export function runMigrations(
  database: SqliteDatabase,
  migrations: readonly Migration[] = getMigrations(),
): MigrationResult {
  ensureMigrationsTable(database);

  const currentVersion = getCurrentSchemaVersion(database);
  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  const applyMigration = database.transaction((migration: Migration) => {
    database.exec(migration.sql);
    database
      .prepare(
        "INSERT INTO schema_migrations (version, name) VALUES (@version, @name)",
      )
      .run({ version: migration.version, name: migration.name });
  });

  for (const migration of pending) {
    applyMigration(migration);
  }

  return {
    applied: pending,
    currentVersion: getCurrentSchemaVersion(database),
  };
}
