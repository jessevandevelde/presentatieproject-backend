import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { describe, it } from 'node:test';
import { openDatabase } from './index';

void describe('ROC Kompas ERD', () => {
  void it('creates exactly the four ERD tables and enforces relationships and field constraints', () => {
    const database = openDatabase(':memory:');

    try {
      deepStrictEqual(
        database.prepare('SELECT name FROM sqlite_master WHERE type = \'table\' ORDER BY name').all().map(row => row['name']),
        ['parties', 'party_answers', 'statements', 'superadmins'],
      );

      database.exec(`
        INSERT INTO superadmins (name, email, password_hash) VALUES ('Beheerder', 'admin@example.test', 'test-hash');
        INSERT INTO statements (text, created_by) VALUES ('Een stelling', 1);
        INSERT INTO parties (name) VALUES ('Een partij');
      `);

      const insertAnswer = database.prepare('INSERT INTO party_answers (party_id, statement_id, answer) VALUES (?, ?, ?)');

      for (const answer of ['eens', 'neutraal', 'oneens']) {
        insertAnswer.run(1, 1, answer);
      }

      throws(() => insertAnswer.run(1, 1, 'ongeldig'), /CHECK constraint failed/u);
      throws(() => insertAnswer.run(1, 1, null), /NOT NULL constraint failed/u);
      throws(() => insertAnswer.run(-1, 1, 'eens'), /FOREIGN KEY constraint failed/u);
      throws(() => insertAnswer.run(1, -1, 'eens'), /FOREIGN KEY constraint failed/u);
      throws(() => {
        database.exec('INSERT INTO statements (text, created_by) VALUES (\'Ongeldig\', -1)');
      }, /FOREIGN KEY constraint failed/u);
      throws(() => {
        database.exec('INSERT INTO superadmins (name, email, password_hash) VALUES (\'Dubbel\', \'admin@example.test\', \'hash\')');
      }, /UNIQUE constraint failed/u);
      throws(() => {
        database.exec('UPDATE parties SET is_active = -1');
      }, /CHECK constraint failed/u);
      throws(() => {
        database.exec('UPDATE statements SET is_active = -1');
      }, /CHECK constraint failed/u);
      throws(() => {
        database.exec('DELETE FROM superadmins WHERE id = 1');
      }, /FOREIGN KEY constraint failed/u);
      throws(() => {
        database.exec('DELETE FROM statements WHERE id = 1');
      }, /FOREIGN KEY constraint failed/u);
      throws(() => {
        database.exec('DELETE FROM parties WHERE id = 1');
      }, /FOREIGN KEY constraint failed/u);

      for (const table of ['superadmins', 'statements', 'parties', 'party_answers']) {
        database.exec(`UPDATE ${table} SET updated_at = '2000-01-01 00:00:00' WHERE id = 1`);
      }

      database.exec(`
        UPDATE superadmins SET name = 'Gewijzigd' WHERE id = 1;
        UPDATE statements SET text = 'Gewijzigd' WHERE id = 1;
        UPDATE parties SET name = 'Gewijzigd' WHERE id = 1;
        UPDATE party_answers SET answer = 'oneens' WHERE id = 1;
      `);

      for (const table of ['superadmins', 'statements', 'parties', 'party_answers']) {
        strictEqual(database.prepare(`SELECT updated_at = CURRENT_TIMESTAMP AS updated FROM ${table} WHERE id = 1`).get()?.['updated'], 1);
      }

      deepStrictEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
    }
    finally {
      database.close();
    }
  });
});
