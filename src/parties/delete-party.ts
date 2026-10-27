import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';

export async function deleteParty(database: AppDatabase, id: number): Promise<boolean> {
  if (isRemoteDatabase(database)) return database.deleteParty(id);

  const result = database.prepare('DELETE FROM parties WHERE id = ?').run(id);

  return Number(result.changes) > 0;
}
