import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { Answer } from '../types/answer.interface';
import { prepareCached } from '../database/prepared-statement';

export interface ReferenceAnswer {
  readonly statementId: number
  readonly answer: Answer
}

export interface ReferenceProfile {
  readonly profileId: number
  readonly profileName: string
  readonly answers: readonly ReferenceAnswer[]
}

const referenceProfilesSql = /* sql */ `
  SELECT parties.id AS profileId, parties.name AS profileName,
         statements.id AS statementId, current.answer
  FROM parties
  LEFT JOIN statements ON statements.is_active = 1
  LEFT JOIN party_answers AS current ON current.id = (
    SELECT id FROM party_answers
    WHERE party_id = parties.id AND statement_id = statements.id
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  )
  WHERE parties.is_active = 1
  ORDER BY parties.id, statements.id
`;

function isAnswer(value: unknown): value is Answer {
  return value === 'eens' || value === 'neutraal' || value === 'oneens';
}

export async function loadReferenceProfiles(database: AppDatabase): Promise<readonly ReferenceProfile[]> {
  if (isRemoteDatabase(database)) {
    const [parties, referenceAnswers] = await Promise.all([database.listParties(), database.getProfileReferenceAnswers()]);
    const answersByProfile = new Map<number, ReferenceAnswer[]>();

    for (const referenceAnswer of referenceAnswers) {
      const answers = answersByProfile.get(referenceAnswer.profileId) ?? [];

      answers.push({ statementId: referenceAnswer.statementId, answer: referenceAnswer.answer });
      answersByProfile.set(referenceAnswer.profileId, answers);
    }

    return parties.filter(party => party.isActive).map(party => ({
      profileId: party.id,
      profileName: party.name,
      answers: answersByProfile.get(party.id) ?? [],
    }));
  }

  const profiles = new Map<number, { profileName: string, answers: ReferenceAnswer[] }>();

  for (const row of prepareCached(database, referenceProfilesSql).all()) {
    const { profileId, profileName, statementId, answer } = row;

    if (typeof profileId !== 'number' || typeof profileName !== 'string') {
      throw new Error('Ongeldige profielgegevens in de database.');
    }

    const profile = profiles.get(profileId) ?? { profileName, answers: [] };

    if (typeof statementId === 'number' && isAnswer(answer)) {
      profile.answers.push({ statementId, answer });
    }

    profiles.set(profileId, profile);
  }

  return [...profiles].map(([profileId, profile]) => ({ profileId, ...profile }));
}
