import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { CreatePartyInput, Party } from '../types/party.interface';

export async function createParty(database: AppDatabase, input: CreatePartyInput): Promise<Party> {
  if (isRemoteDatabase(database)) return database.createParty(input);

  const row = database.prepare(`
    INSERT INTO parties (name, description, image_url, is_active)
    VALUES (?, ?, ?, ?)
    RETURNING id, created_at AS createdAt, updated_at AS updatedAt
  `).get(input.name, input.description, input.imageUrl, input.isActive ? 1 : 0);

  if (!row) {
    throw new Error('De database heeft geen aangemaakte partij teruggegeven.');
  }

  const { id, createdAt, updatedAt } = row;

  if (typeof id !== 'number' || typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    throw new Error('De database heeft ongeldige partijgegevens teruggegeven.');
  }

  return { id, ...input, createdAt, updatedAt };
}
