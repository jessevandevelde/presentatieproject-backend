import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';

export async function deleteStatement(database: AppDatabase, id: number): Promise<boolean> {
  if (isRemoteDatabase(database)) return database.deleteStatement(id);

  const result = database.prepare('DELETE FROM statements WHERE id = ?').run(id);

  return Number(result.changes) > 0;
}
