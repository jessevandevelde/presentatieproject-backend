import type { SQLInputValue } from 'node:sqlite';
import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { UpdatePartyInput } from '../types/party.interface';

export async function updateParty(database: AppDatabase, id: number, input: UpdatePartyInput): Promise<boolean> {
  if (isRemoteDatabase(database)) return database.updateParty(id, input);

  const assignments: string[] = [];
  const values: SQLInputValue[] = [];

  if (input.name !== undefined) {
    assignments.push('name = ?');
    values.push(input.name);
  }

  if (input.description !== undefined) {
    assignments.push('description = ?');
    values.push(input.description);
  }

  if (input.imageUrl !== undefined) {
    assignments.push('image_url = ?');
    values.push(input.imageUrl);
  }

  if (input.isActive !== undefined) {
    assignments.push('is_active = ?');
    values.push(input.isActive ? 1 : 0);
  }

  const result = database.prepare(`UPDATE parties SET ${assignments.join(', ')} WHERE id = ?`).run(...values, id);

  return Number(result.changes) > 0;
}
