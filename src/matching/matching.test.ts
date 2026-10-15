import { StatusCodes } from 'http-status-codes';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { once } from 'node:events';
import { it } from 'node:test';
import { openDatabase } from '../database';
import { createApp } from '../server';

const oversizedLength = 65537;

void it('matches a complete submission without storing user answers', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp(database);

  const answers = [
    { statementId: 40, answer: 'oneens' },
    { statementId: 10, answer: 'eens' },
    { statementId: 30, answer: 'neutraal' },
  ];

  try {
    database.exec(`
      INSERT INTO superadmins (name, email, password_hash) VALUES ('Test', 'test@example.test', '!disabled');
      INSERT INTO statements (id, text, created_by, is_active) VALUES
        (10, 'Eerste', 1, 1), (20, 'Inactief', 1, 0), (30, 'Tweede', 1, 1), (40, 'Derde', 1, 1);
      INSERT INTO parties (id, name, is_active) VALUES
        (1, 'Alles gelijk', 1), (2, 'Twee gelijk', 1), (3, 'Onvolledig', 1),
        (4, 'Niets gelijk', 1), (5, 'Geen antwoorden', 1), (6, 'Inactief', 0), (7, 'Gelijke score', 1);
      INSERT INTO party_answers (party_id, statement_id, answer, updated_at) VALUES
        (1, 10, 'oneens', '2000-01-01 00:00:00'),
        (1, 10, 'neutraal', '2020-01-01 00:00:00'),
        (1, 10, 'eens', '2020-01-01 00:00:00');
      INSERT INTO party_answers (party_id, statement_id, answer) VALUES
        (1, 30, 'neutraal'), (1, 40, 'oneens'), (1, 20, 'oneens'),
        (2, 10, 'eens'), (2, 30, 'eens'), (2, 40, 'oneens'),
        (3, 10, 'eens'), (4, 10, 'oneens'), (4, 30, 'oneens'), (4, 40, 'eens'),
        (6, 10, 'eens'), (7, 10, 'eens'), (7, 30, 'neutraal'), (7, 40, 'oneens');
    `);

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP address');
    }

    const url = `http://127.0.0.1:${String(address.port)}/matching`;

    async function post(body: unknown): Promise<Response> {
      return fetch(url, { method: 'POST', headers: [['content-type', 'application/json']], body: JSON.stringify(body) });
    }

    await context.test('scores, sorts, handles missing data and uses latest party answers', async () => {
      const snapshot = database.prepare('SELECT * FROM party_answers ORDER BY id').all();
      const response = await post({ answers });

      strictEqual(response.status, StatusCodes.OK);
      strictEqual(response.headers.get('content-type'), 'application/json; charset=utf-8');
      deepStrictEqual(await response.json(), {
        totalAnswers: 3,
        matches: [
          { profileId: 1, profileName: 'Alles gelijk', matchPercentage: 100, matchedAnswers: 3, comparedAnswers: 3, missingAnswers: 0 },
          { profileId: 7, profileName: 'Gelijke score', matchPercentage: 100, matchedAnswers: 3, comparedAnswers: 3, missingAnswers: 0 },
          { profileId: 3, profileName: 'Onvolledig', matchPercentage: 100, matchedAnswers: 1, comparedAnswers: 1, missingAnswers: 2 },
          { profileId: 2, profileName: 'Twee gelijk', matchPercentage: 66.67, matchedAnswers: 2, comparedAnswers: 3, missingAnswers: 0 },
          { profileId: 4, profileName: 'Niets gelijk', matchPercentage: 0, matchedAnswers: 0, comparedAnswers: 3, missingAnswers: 0 },
          { profileId: 5, profileName: 'Geen antwoorden', matchPercentage: null, matchedAnswers: 0, comparedAnswers: 0, missingAnswers: 3 },
        ],
      });
      deepStrictEqual(database.prepare('SELECT * FROM party_answers ORDER BY id').all(), snapshot);
    });

    await context.test('rejects malformed, partial, duplicate, unknown and inactive submissions', async () => {
      const invalidBodies: unknown[] = [
        null, [], {}, { answers: [] }, { answers: 'wrong' }, { answers: [null] },
        { answers: [{ statementId: '10', answer: 'eens' }] },
        { answers: [{ statementId: -1, answer: 'eens' }] },
        { answers: [{ statementId: 1.5, answer: 'eens' }] },
        { answers: [{ statementId: 9007199254740992, answer: 'eens' }] },
        { answers: [{ statementId: 10, answer: 'ja' }] },
        { answers: [{ statementId: 10, answer: null }] },
        { answers: [{ index: 0, answer: 'eens' }] },
        { answers: [answers[0]] },
        { answers: [...answers, answers[0]] },
        { answers: [...answers, { statementId: 20, answer: 'eens' }] },
        { answers: [...answers, { statementId: 99, answer: 'eens' }] },
        { answers: answers.map(item => ({ ...item, statementId: item.statementId + 1 })) },
      ];

      for (const body of invalidBodies) {
        const response = await post(body);

        strictEqual(response.status, StatusCodes.BAD_REQUEST, JSON.stringify(body));
        await response.text();
      }
    });

    await context.test('rejects invalid JSON, unsupported content types and oversized bodies', async () => {
      for (const body of ['', '{']) {
        const response = await fetch(url, { method: 'POST', headers: [['content-type', 'application/json']], body });

        strictEqual(response.status, StatusCodes.BAD_REQUEST);
        await response.text();
      }

      const wrongType = await fetch(url, { method: 'POST', body: JSON.stringify({ answers }) });

      strictEqual(wrongType.status, StatusCodes.UNSUPPORTED_MEDIA_TYPE);
      await wrongType.text();

      const tooLarge = await fetch(url, { method: 'POST', headers: [['content-type', 'application/json']], body: ' '.repeat(oversizedLength) });

      strictEqual(tooLarge.status, StatusCodes.REQUEST_TOO_LONG);
      await tooLarge.text();
    });

    await context.test('requires POST and accepts JSON with charset', async () => {
      const wrongMethod = await fetch(url);

      strictEqual(wrongMethod.status, StatusCodes.METHOD_NOT_ALLOWED);
      strictEqual(wrongMethod.headers.get('allow'), 'POST');
      await wrongMethod.text();

      const response = await fetch(url, { method: 'POST', headers: [['content-type', 'application/json; charset=utf-8']], body: JSON.stringify({ answers }) });

      strictEqual(response.status, StatusCodes.OK);
      await response.text();
    });

    await context.test('returns an empty result when no active parties exist', async () => {
      database.exec('UPDATE parties SET is_active = 0');

      const response = await post({ answers });

      strictEqual(response.status, StatusCodes.OK);
      deepStrictEqual(await response.json(), { totalAnswers: 3, matches: [] });
    });

    await context.test('rejects a submission after statements have changed', async () => {
      database.exec('UPDATE statements SET is_active = 0');

      const response = await post({ answers });

      strictEqual(response.status, StatusCodes.BAD_REQUEST);
      await response.text();
    });

    await context.test('does not expose database failures', async (errorContext) => {
      errorContext.mock.method(console, 'error', () => undefined);
      database.close();

      const response = await post({ answers });

      strictEqual(response.status, StatusCodes.INTERNAL_SERVER_ERROR);
      deepStrictEqual(await response.json(), { error: 'De overeenkomst met de onderwijsprofielen kon niet worden berekend.' });
    });
  }
  finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          }
          else {
            resolve();
          }
        });
      });
    }

    if (database.isOpen) {
      database.close();
    }
  }
});
