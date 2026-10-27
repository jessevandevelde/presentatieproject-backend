import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { Party } from '../types/party.interface';
import { rowToParty } from './row-to-party';

export async function listParties(database: AppDatabase): Promise<readonly Party[]> {
  if (isRemoteDatabase(database)) return database.listParties();

  const rows = database.prepare(`
    SELECT id, name, description, image_url AS imageUrl, is_active AS isActive,
           created_at AS createdAt, updated_at AS updatedAt
    FROM parties
    ORDER BY id
  `).all();

  return rows.map(rowToParty);
}
