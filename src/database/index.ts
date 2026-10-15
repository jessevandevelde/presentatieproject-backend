import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = resolve(__dirname, '../..');

export function openDatabase(path = process.env['DATABASE_PATH'] ?? resolve(projectRoot, 'data/roc-kompas.sqlite')): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new DatabaseSync(path, { enableForeignKeyConstraints: true });

  try {
    database.exec(readFileSync(resolve(projectRoot, 'database/schema.sql'), 'utf8'));
  }
  catch (error: unknown) {
    database.close();

    throw error;
  }

  return database;
}
