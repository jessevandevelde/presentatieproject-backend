import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { StatementRecord } from '../types/statement.interface';
import { rowToStatement } from './row-to-statement';

export async function getStatementById(database: AppDatabase, id: number): Promise<StatementRecord | undefined> {
  if (isRemoteDatabase(database)) return database.getStatementById(id);

  const row = database.prepare(`
    SELECT id, text, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
    FROM statements
    WHERE id = ?
  `).get(id);

  return row ? rowToStatement(row) : undefined;
}
