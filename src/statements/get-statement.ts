import type { DatabaseSync } from 'node:sqlite';
import type { StatementResult } from '../types/statement.interface';

export function getStatement(database: DatabaseSync, index: number): StatementResult | undefined {
  const statement = database.prepare(`
    SELECT id, text FROM statements
    WHERE is_active = 1
    ORDER BY id
    LIMIT 1 OFFSET ?
  `).get(index);

  if (!statement) {
    return undefined;
  }

  const answers = database.prepare(`
    SELECT parties.id AS profileId, parties.name AS profileName,
           party_answers.answer
    FROM parties
    LEFT JOIN party_answers ON party_answers.id = (
      SELECT id FROM party_answers
      WHERE party_id = parties.id AND statement_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    )
    WHERE parties.is_active = 1
    ORDER BY parties.id
  `).all(statement['id']);

  return {
    index,
    id: statement['id'],
    text: statement['text'],
    profileAnswers: answers,
  };
}
