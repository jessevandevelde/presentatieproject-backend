import type { DatabaseSync } from 'node:sqlite';
import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { CreateStatementInput, StatementRecord } from '../types/statement.interface';

const technicalAdminEmail = 'stellingen-import@roc-kompas.invalid';

function ensureTechnicalAdmin(database: DatabaseSync): number {
  database.prepare(`
    INSERT INTO superadmins (name, email, password_hash)
    SELECT 'Stellingenimport', ?, '!disabled:statement-import'
    WHERE NOT EXISTS (SELECT 1 FROM superadmins WHERE email = ?)
  `).run(technicalAdminEmail, technicalAdminEmail);

  const row = database.prepare('SELECT id FROM superadmins WHERE email = ?').get(technicalAdminEmail);

  if (!row || typeof row['id'] !== 'number') {
    throw new Error('Kon geen technisch beheerdersaccount voor stellingen vinden of aanmaken.');
  }

  return row['id'];
}

export async function createStatement(database: AppDatabase, input: CreateStatementInput): Promise<StatementRecord> {
  if (isRemoteDatabase(database)) return database.createStatement(input);

  const sqliteDatabase: DatabaseSync = database;
  const createdBy = ensureTechnicalAdmin(sqliteDatabase);

  const row = sqliteDatabase.prepare(`
    INSERT INTO statements (text, created_by, is_active)
    VALUES (?, ?, ?)
    RETURNING id, created_at AS createdAt, updated_at AS updatedAt
  `).get(input.text, createdBy, input.isActive ? 1 : 0);

  if (!row) {
    throw new Error('De database heeft geen aangemaakte stelling teruggegeven.');
  }

  const { id, createdAt, updatedAt } = row;

  if (typeof id !== 'number' || typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    throw new Error('De database heeft ongeldige stellinggegevens teruggegeven.');
  }

  return { id, text: input.text, isActive: input.isActive, createdAt, updatedAt };
}
