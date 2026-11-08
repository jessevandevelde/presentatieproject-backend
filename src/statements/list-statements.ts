import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { StatementRecord } from '../types/statement.interface';
import { rowToStatement } from './row-to-statement';
import { prepareCached } from '../database/prepared-statement';

export async function listStatements(database: AppDatabase): Promise<readonly StatementRecord[]> {
  if (isRemoteDatabase(database)) return database.listStatements();

  const rows = prepareCached(database, `
    SELECT id, text, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
    FROM statements
    ORDER BY id
  `).all();

  return rows.map(rowToStatement);
}
