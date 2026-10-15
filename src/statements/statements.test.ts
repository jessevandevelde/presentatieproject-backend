import { StatusCodes } from 'http-status-codes';
import { deepStrictEqual, strictEqual, notStrictEqual } from 'node:assert';
import { once } from 'node:events';
import { it } from 'node:test';
import { openDatabase } from '../database';
import { createApp } from '../server';

const nonExistentId = 999;

void it('serves statements and party answers over HTTP', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp(database);

  try {
    database.exec(`
      INSERT INTO superadmins (name, email, password_hash) VALUES ('Test', 'test@example.test', '!disabled');
      INSERT INTO statements (id, text, created_by, is_active) VALUES
        (10, 'Eerste stelling over CO₂', 1, 1),
        (20, 'Verborgen', 1, 0),
        (30, 'Laatste stelling', 1, 1);
      INSERT INTO parties (id, name, is_active) VALUES
        (1, 'Partij A', 1), (2, 'Partij B', 1), (3, 'Partij C', 1),
        (4, 'Nog geen antwoord', 1), (5, 'Inactieve partij', 0);
      INSERT INTO party_answers (party_id, statement_id, answer, updated_at) VALUES
        (1, 10, 'oneens', '2000-01-01 00:00:00'),
        (1, 10, 'neutraal', '2020-01-01 00:00:00'),
        (1, 10, 'eens', '2020-01-01 00:00:00'),
        (2, 10, 'neutraal', '2020-01-01 00:00:00'),
        (3, 10, 'oneens', '2020-01-01 00:00:00'),
        (5, 10, 'eens', '2020-01-01 00:00:00'),
        (1, 30, 'oneens', '2020-01-01 00:00:00');
    `);

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    await context.test('returns one statement with the latest answer for each active party', async () => {
      const response = await fetch(`${baseUrl}/statements?index=0`);

      strictEqual(response.status, StatusCodes.OK);
      strictEqual(response.headers.get('content-type'), 'application/json; charset=utf-8');
      deepStrictEqual(await response.json(), {
        index: 0,
        id: 10,
        text: 'Eerste stelling over CO₂',
        profileAnswers: [
          { profileId: 1, profileName: 'Partij A', answer: 'eens' },
          { profileId: 2, profileName: 'Partij B', answer: 'neutraal' },
          { profileId: 3, profileName: 'Partij C', answer: 'oneens' },
          { profileId: 4, profileName: 'Nog geen antwoord', answer: null },
        ],
      });
    });

    await context.test('uses the position among active statements, not the database ID', async () => {
      const response = await fetch(`${baseUrl}/statements?index=1`);

      strictEqual(response.status, StatusCodes.OK);
      deepStrictEqual(await response.json(), {
        index: 1,
        id: 30,
        text: 'Laatste stelling',
        profileAnswers: [
          { profileId: 1, profileName: 'Partij A', answer: 'oneens' },
          { profileId: 2, profileName: 'Partij B', answer: null },
          { profileId: 3, profileName: 'Partij C', answer: null },
          { profileId: 4, profileName: 'Nog geen antwoord', answer: null },
        ],
      });
    });

    await context.test('rejects missing, duplicate and malformed indexes', async () => {
      for (const query of ['', '?index=', '?index=-1', '?index=1.5', '?index=abc', '?index=1e1', '?index=%20', '?index=0&index=1', '?index=9007199254740992', '?index=0%20OR%201=1']) {
        const response = await fetch(`${baseUrl}/statements${query}`);

        strictEqual(response.status, StatusCodes.BAD_REQUEST, query);
        await response.text();
      }
    });

    await context.test('returns 404 beyond the last statement or for an unknown route', async () => {
      for (const path of ['/statements?index=2', '/unknown']) {
        const response = await fetch(`${baseUrl}${path}`);

        strictEqual(response.status, StatusCodes.NOT_FOUND);
        await response.text();
      }
    });

    await context.test('only allows GET and POST requests on /statements', async () => {
      const response = await fetch(`${baseUrl}/statements?index=0`, { method: 'PUT' });

      strictEqual(response.status, StatusCodes.METHOD_NOT_ALLOWED);
      strictEqual(response.headers.get('allow'), 'GET, POST');
      await response.text();
    });

    await context.test('returns an empty party list when no active parties exist', async () => {
      database.exec('UPDATE parties SET is_active = 0');

      const response = await fetch(`${baseUrl}/statements?index=0`);

      deepStrictEqual(await response.json(), { index: 0, id: 10, text: 'Eerste stelling over CO₂', profileAnswers: [] });
    });

    await context.test('returns 404 when no active statements exist', async () => {
      database.exec('UPDATE statements SET is_active = 0');

      const response = await fetch(`${baseUrl}/statements?index=0`);

      strictEqual(response.status, StatusCodes.NOT_FOUND);
      await response.text();
    });

    await context.test('hides database error details', async (errorContext) => {
      errorContext.mock.method(console, 'error', () => undefined);
      database.close();

      const response = await fetch(`${baseUrl}/statements?index=0`);

      strictEqual(response.status, StatusCodes.INTERNAL_SERVER_ERROR);
      deepStrictEqual(await response.json(), { error: 'De stelling kon niet worden opgehaald.' });
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

void it('creates, lists, reads, updates and deletes statements over HTTP', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp(database);

  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}/statements`;

    async function post(body: unknown): Promise<Response> {
      return fetch(baseUrl, { method: 'POST', headers: [['content-type', 'application/json']], body: JSON.stringify(body) });
    }

    async function patch(id: number, body: unknown): Promise<Response> {
      return fetch(`${baseUrl}/${String(id)}`, { method: 'PATCH', headers: [['content-type', 'application/json']], body: JSON.stringify(body) });
    }

    await context.test('creates a statement, provisioning a technical superadmin as needed', async () => {
      const response = await post({ text: 'Nieuwe stelling' });
      const row = database.prepare('SELECT * FROM statements WHERE id = 1').get();
      const admin = database.prepare('SELECT * FROM superadmins WHERE email = \'stellingen-import@roc-kompas.invalid\'').get();

      if (row === undefined || admin === undefined) {
        throw new Error('Expected a statement and a technical superadmin to exist.');
      }

      strictEqual(response.status, StatusCodes.CREATED);
      deepStrictEqual(await response.json(), {
        id: 1, text: 'Nieuwe stelling', isActive: true,
        createdAt: row['created_at'], updatedAt: row['updated_at'],
      });

      const secondResponse = await post({ text: 'Tweede stelling', isActive: false });
      const adminCount = database.prepare('SELECT COUNT(*) AS count FROM superadmins').get();

      strictEqual(secondResponse.status, StatusCodes.CREATED);

      if (adminCount === undefined) {
        throw new Error('Expected the superadmin count to be returned.');
      }

      strictEqual(adminCount['count'], 1);
    });

    await context.test('rejects invalid create bodies without inserting rows', async () => {
      const before = database.prepare('SELECT COUNT(*) AS count FROM statements').get();

      for (const body of [null, [], 'text', {}, { text: '' }, { text: '  ' }, { text: 'x\0y' }, { text: 'Valid', isActive: 'yes' }, { text: 'Valid', id: 1 }]) {
        const response = await post(body);

        strictEqual(response.status, StatusCodes.BAD_REQUEST, JSON.stringify(body));
        await response.text();
      }

      deepStrictEqual(database.prepare('SELECT COUNT(*) AS count FROM statements').get(), before);
    });

    await context.test('lists all statements ordered by id, active and inactive', async () => {
      const response = await fetch(`${baseUrl}/all`);
      const rows = database.prepare('SELECT * FROM statements ORDER BY id').all();

      strictEqual(response.status, StatusCodes.OK);
      deepStrictEqual(await response.json(), rows.map(row => ({
        id: row['id'], text: row['text'], isActive: row['is_active'] === 1,
        createdAt: row['created_at'], updatedAt: row['updated_at'],
      })));
    });

    await context.test('only allows GET on /statements/all', async () => {
      const response = await fetch(`${baseUrl}/all`, { method: 'POST' });

      strictEqual(response.status, StatusCodes.METHOD_NOT_ALLOWED);
      strictEqual(response.headers.get('allow'), 'GET');
      await response.text();
    });

    await context.test('reads a single statement by id, or 404 when missing', async () => {
      const found = await fetch(`${baseUrl}/1`);
      const row = database.prepare('SELECT * FROM statements WHERE id = 1').get();

      if (row === undefined) {
        throw new Error('Expected the statement to exist.');
      }

      strictEqual(found.status, StatusCodes.OK);
      deepStrictEqual(await found.json(), {
        id: 1, text: 'Nieuwe stelling', isActive: true,
        createdAt: row['created_at'], updatedAt: row['updated_at'],
      });

      const missing = await fetch(`${baseUrl}/${String(nonExistentId)}`);

      strictEqual(missing.status, StatusCodes.NOT_FOUND);
      await missing.text();
    });

    await context.test('rejects an invalid id in the URL', async () => {
      const response = await fetch(`${baseUrl}/not-a-number`);

      strictEqual(response.status, StatusCodes.BAD_REQUEST);
      await response.text();
    });

    await context.test('updates one or more fields and refreshes updatedAt', async () => {
      database.exec('UPDATE statements SET updated_at = \'2000-01-01 00:00:00\' WHERE id = 1');

      const before = database.prepare('SELECT updated_at FROM statements WHERE id = 1').get();
      const response = await patch(1, { text: 'Gewijzigde stelling', isActive: false });
      const after = database.prepare('SELECT * FROM statements WHERE id = 1').get();

      if (before === undefined || after === undefined) {
        throw new Error('Expected the statement row to exist.');
      }

      strictEqual(response.status, StatusCodes.OK);
      deepStrictEqual(await response.json(), {
        id: 1, text: 'Gewijzigde stelling', isActive: false,
        createdAt: after['created_at'], updatedAt: after['updated_at'],
      });
      strictEqual(after['is_active'], 0);
      notStrictEqual(after['updated_at'], before['updated_at']);
    });

    await context.test('rejects invalid or empty update bodies without changing data', async () => {
      const before = database.prepare('SELECT * FROM statements WHERE id = 1').get();

      for (const body of [{}, { text: '' }, { isActive: 'no' }, { id: 5 }, { unknown: 'field' }]) {
        const response = await patch(1, body);

        strictEqual(response.status, StatusCodes.BAD_REQUEST, JSON.stringify(body));
        await response.text();
      }

      deepStrictEqual(database.prepare('SELECT * FROM statements WHERE id = 1').get(), before);
    });

    await context.test('returns 404 when updating a statement that does not exist', async () => {
      const response = await patch(nonExistentId, { text: 'Nieuw' });

      strictEqual(response.status, StatusCodes.NOT_FOUND);
      await response.text();
    });

    await context.test('only allows GET, PATCH and DELETE on a statement by id', async () => {
      const response = await fetch(`${baseUrl}/1`, { method: 'POST' });

      strictEqual(response.status, StatusCodes.METHOD_NOT_ALLOWED);
      strictEqual(response.headers.get('allow'), 'GET, PATCH, DELETE');
      await response.text();
    });

    await context.test('blocks deletion while party answers reference the statement', async () => {
      database.exec(`
        INSERT INTO parties (id, name) VALUES (1, 'Testpartij');
        INSERT INTO party_answers (party_id, statement_id, answer) VALUES (1, 1, 'eens');
      `);

      const response = await fetch(`${baseUrl}/1`, { method: 'DELETE' });

      strictEqual(response.status, StatusCodes.CONFLICT);
      await response.text();
      notStrictEqual(database.prepare('SELECT 1 FROM statements WHERE id = 1').get(), undefined);
    });

    await context.test('deletes a statement without references and returns 404 afterwards', async () => {
      const response = await fetch(`${baseUrl}/2`, { method: 'DELETE' });

      strictEqual(response.status, StatusCodes.NO_CONTENT);

      const gone = await fetch(`${baseUrl}/2`);

      strictEqual(gone.status, StatusCodes.NOT_FOUND);
      await gone.text();

      const secondDelete = await fetch(`${baseUrl}/2`, { method: 'DELETE' });

      strictEqual(secondDelete.status, StatusCodes.NOT_FOUND);
      await secondDelete.text();
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
