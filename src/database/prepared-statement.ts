import type { DatabaseSync, StatementSync } from 'node:sqlite';

const statementsByDatabase = new WeakMap<DatabaseSync, Map<string, StatementSync>>();

export function prepareCached(database: DatabaseSync, sql: string): StatementSync {
  let statements = statementsByDatabase.get(database);

  if (statements === undefined) {
    statements = new Map<string, StatementSync>();
    statementsByDatabase.set(database, statements);
  }

  let statement = statements.get(sql);

  if (statement === undefined) {
    statement = database.prepare(sql);
    statements.set(sql, statement);
  }

  return statement;
}
