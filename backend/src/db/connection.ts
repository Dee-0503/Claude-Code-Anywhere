import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type SqliteDatabase = Database.Database;

export interface DatabaseConnectionOptions {
  readonly path: string;
  readonly readonly?: boolean;
  readonly fileMustExist?: boolean;
}

export function openDatabaseConnection(options: DatabaseConnectionOptions): SqliteDatabase {
  const databasePath = resolve(options.path);

  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath, {
    readonly: options.readonly ?? false,
    fileMustExist: options.fileMustExist ?? false
  });

  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');

  return database;
}

export function closeDatabaseConnection(database: SqliteDatabase): void {
  if (database.open) {
    database.close();
  }
}
