import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { Answer } from '../types/answer.interface';
import type { StatementResult } from '../types/statement.interface';

export async function getStatement(database: AppDatabase, index: number): Promise<StatementResult | undefined> {
  if (isRemoteDatabase(database)) return database.getStatement(index);

  const statement = database.prepare(`
    SELECT id, text FROM statements
    WHERE is_active = 1
    ORDER BY id
    LIMIT 1 OFFSET ?
  `).get(index);

  if (!statement) {
    return undefined;
  }

  const statementId = statement['id'];
  const statementText = statement['text'];

  if (typeof statementId !== 'number' || typeof statementText !== 'string') {
    throw new Error('De database heeft ongeldige stellinggegevens teruggegeven.');
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
  `).all(statementId);

  const profileAnswers = answers.map((row) => {
    const { profileId, profileName, answer } = row;

    if (typeof profileId !== 'number' || typeof profileName !== 'string') {
      throw new Error('De database heeft ongeldige profielantwoorden teruggegeven.');
    }

    if (answer !== null && answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens') {
      throw new Error('De database heeft ongeldige profielantwoorden teruggegeven.');
    }

    const normalizedAnswer: Answer | null = answer;

    return { profileId, profileName, answer: normalizedAnswer };
  });

  return {
    index,
    id: statementId,
    text: statementText,
    profileAnswers,
  };
}
