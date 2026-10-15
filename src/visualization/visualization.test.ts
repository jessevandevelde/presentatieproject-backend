import { deepStrictEqual, strictEqual } from 'node:assert';
import { once } from 'node:events';
import { it } from 'node:test';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { StatusCodes } from 'http-status-codes';
import { openDatabase } from '../database';
import { createApp } from '../server';

const submissionId = '123e4567-e89b-42d3-a456-426614174001';

async function nextMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket.once('message', (data: RawData) => {
      try {
        const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : Array.isArray(data) ? Buffer.concat(data) : data;

        resolve(JSON.parse(buffer.toString()) as unknown);
      }
      catch (error: unknown) {
        reject(error instanceof Error ? error : new Error('WebSocket-bericht kon niet worden gelezen.'));
      }
    });
    socket.once('error', reject);
  });
}

void it('stores and broadcasts only an anonymous point after a complete submission', async () => {
  const database = openDatabase(':memory:');
  const server = createApp(database);

  database.exec(/* sql */ `
    INSERT INTO superadmins (name, email, password_hash) VALUES ('Test', 'test@example.test', '!disabled');
    INSERT INTO statements (id, text, created_by) VALUES (1, 'Theorie of praktijk', 1), (2, 'Vernieuwen of behouden', 1);
    INSERT INTO parties (id, name) VALUES
      (1, 'Theoretisch & vernieuwend'), (2, 'Praktisch & vernieuwend'),
      (3, 'Theoretisch & behoudend'), (4, 'Praktisch & behoudend');
    INSERT INTO party_answers (party_id, statement_id, answer) VALUES
      (1, 1, 'eens'), (2, 1, 'oneens'), (3, 1, 'eens'), (4, 1, 'oneens'),
      (1, 2, 'eens'), (2, 2, 'eens'), (3, 2, 'oneens'), (4, 2, 'oneens');
  `);

  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP address');
    }

    const socket = new WebSocket(`ws://127.0.0.1:${String(address.port)}/visualization/live`);
    const snapshotPromise = nextMessage(socket);

    await once(socket, 'open');

    const snapshot = await snapshotPromise;

    deepStrictEqual(snapshot, { type: 'snapshot', points: [], total: 0 });

    const liveMessagePromise = nextMessage(socket);

    const response = await fetch(`http://127.0.0.1:${String(address.port)}/matching`, {
      method: 'POST',
      headers: [['content-type', 'application/json']],
      body: JSON.stringify({
        submissionId,
        answers: [
          { statementId: 1, answer: 'oneens' },
          { statementId: 2, answer: 'eens' },
        ],
      }),
    });

    const message = await liveMessagePromise;

    strictEqual(response.status, StatusCodes.OK);
    await response.text();
    deepStrictEqual(message, {
      type: 'point',
      point: { id: '1', x: 100, y: 100 },
      total: 1,
    });
    deepStrictEqual(database.prepare('PRAGMA table_info(visualization_points)').all().map(column => column['name']), ['submission_key', 'x', 'y']);
    deepStrictEqual(database.prepare('SELECT submission_key, x, y FROM visualization_points').all().map(row => ({
      submissionKey: row['submission_key'],
      x: row['x'],
      y: row['y'],
    })), [{ submissionKey: submissionId, x: 100, y: 100 }]);

    const duplicateResponse = await fetch(`http://127.0.0.1:${String(address.port)}/matching`, {
      method: 'POST',
      headers: [['content-type', 'application/json']],
      body: JSON.stringify({
        submissionId,
        answers: [
          { statementId: 1, answer: 'oneens' },
          { statementId: 2, answer: 'eens' },
        ],
      }),
    });

    strictEqual(duplicateResponse.status, StatusCodes.OK);
    await duplicateResponse.text();
    strictEqual(database.prepare('SELECT COUNT(*) AS total FROM visualization_points').get()?.['total'], 1);
    socket.close();
    await once(socket, 'close');
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
