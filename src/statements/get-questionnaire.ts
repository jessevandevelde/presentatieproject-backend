import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { ProfileAnswer, Questionnaire, StatementResult } from '../types/statement.interface';
import { prepareCached } from '../database/prepared-statement';

const questionnaireSql = /* sql */ `
  SELECT statements.id AS statementId, statements.text,
         parties.id AS profileId, parties.name AS profileName,
         current.answer
  FROM statements
  LEFT JOIN parties ON parties.is_active = 1
  LEFT JOIN party_answers AS current ON current.id = (
    SELECT id FROM party_answers
    WHERE party_id = parties.id AND statement_id = statements.id
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  )
  WHERE statements.is_active = 1
  ORDER BY statements.id, parties.id
`;

export async function getQuestionnaire(database: AppDatabase): Promise<Questionnaire> {
  if (isRemoteDatabase(database)) return database.getQuestionnaire();

  const statements = new Map<number, Omit<StatementResult, 'profileAnswers'> & { profileAnswers: ProfileAnswer[] }>();

  for (const row of prepareCached(database, questionnaireSql).all()) {
    const { statementId, text } = row;

    if (typeof statementId !== 'number' || typeof text !== 'string') {
      throw new Error('Ongeldige stellinggegevens in de database.');
    }

    let statement = statements.get(statementId);

    if (statement === undefined) {
      statement = { index: statements.size, id: statementId, text, profileAnswers: [] };
      statements.set(statementId, statement);
    }

    const { profileId, profileName } = row;
    const { answer } = row;

    if (typeof profileId === 'number' && typeof profileName === 'string') {
      if (answer !== null && answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens') {
        throw new Error('Ongeldige profielantwoorden in de database.');
      }

      statement.profileAnswers.push({ profileId, profileName, answer });
    }
  }

  return { statements: [...statements.values()] };
}
