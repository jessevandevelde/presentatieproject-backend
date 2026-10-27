import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { Party } from '../types/party.interface';
import { rowToParty } from './row-to-party';

export async function getPartyById(database: AppDatabase, id: number): Promise<Party | undefined> {
  if (isRemoteDatabase(database)) return database.getPartyById(id);

  const row = database.prepare(`
    SELECT id, name, description, image_url AS imageUrl, is_active AS isActive,
           created_at AS createdAt, updated_at AS updatedAt
    FROM parties
    WHERE id = ?
  `).get(id);

  return row ? rowToParty(row) : undefined;
}
