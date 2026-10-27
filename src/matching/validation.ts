import { RequestError } from '../http/request-error';
import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { Answer } from '../types/answer.interface';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const submissionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function validateSubmissionId(body: unknown): string {
  if (!isRecord(body) || typeof body['submissionId'] !== 'string' || !submissionIdPattern.test(body['submissionId'])) {
    throw new RequestError('submissionId moet een geldige willekeurige UUID zijn.');
  }

  return body['submissionId'].toLowerCase();
}

export async function validateAnswers(database: AppDatabase, body: unknown): Promise<ReadonlyMap<number, Answer>> {
  if (!isRecord(body) || !Array.isArray(body['answers']) || body['answers'].length === 0) {
    throw new RequestError('Stuur een niet-lege answers-lijst met alle antwoorden.');
  }

  const answers = new Map<number, Answer>();
  const items: readonly unknown[] = body['answers'];

  for (const item of items) {
    if (!isRecord(item)) {
      throw new RequestError('Elk antwoord moet statementId en answer bevatten.');
    }

    const { statementId, answer } = item;

    if (typeof statementId !== 'number' || !Number.isSafeInteger(statementId) || statementId < 1) {
      throw new RequestError('statementId moet een positief geheel getal zijn, geen index.');
    }

    if (answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens') {
      throw new RequestError('answer moet eens, neutraal of oneens zijn.');
    }

    if (answers.has(statementId)) {
      throw new RequestError('Elke stelling mag maar één antwoord hebben.');
    }

    answers.set(statementId, answer);
  }

  const statementIds = isRemoteDatabase(database)
    ? await database.getActiveStatementIds()
    : database.prepare('SELECT id FROM statements WHERE is_active = 1').all().map(statement => statement['id']);

  if (statementIds.length !== answers.size || statementIds.some(statementId => typeof statementId !== 'number' || !answers.has(statementId))) {
    throw new RequestError('Stuur precies één antwoord voor elke actieve stelling. Haal bij gewijzigde stellingen de actuele lijst opnieuw op.');
  }

  return answers;
}
