import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppDatabase } from '../database';
import { SupabaseRequestError } from '../database';
import { readJsonBody } from '../http/read-json-body';
import { RequestError } from '../http/request-error';
import { getStatement } from './get-statement';
import { createStatement } from './create-statement';
import { listStatements } from './list-statements';
import { getStatementById } from './get-statement-by-id';
import { updateStatement } from './update-statement';
import { deleteStatement } from './delete-statement';
import { validateCreateStatement, validateUpdateStatement } from './validation';

function isForeignKeyViolation(error: unknown): boolean {
  return (error instanceof SupabaseRequestError && error.code === '23503')
    || (error instanceof Error && 'code' in error && error.code === 'ERR_SQLITE_ERROR' && error.message.includes('FOREIGN KEY constraint failed'));
}

function writeStatementNotFound(response: ServerResponse): void {
  response.writeHead(StatusCodes.NOT_FOUND);
  response.end(JSON.stringify({ error: 'Geen stelling gevonden met dit id.' }));
}

export async function handleStatementRequest(database: AppDatabase, query: URLSearchParams, response: ServerResponse): Promise<void> {
  const values = query.getAll('index');
  const rawIndex = values[0] ?? '';
  const index = Number(rawIndex);

  if (values.length !== 1 || !/^(?:0|[1-9]\d*)$/u.test(rawIndex) || !Number.isSafeInteger(index)) {
    response.writeHead(StatusCodes.BAD_REQUEST);
    response.end(JSON.stringify({ error: 'index moet een geheel getal vanaf 0 zijn.' }));

    return;
  }

  try {
    const statement = await getStatement(database, index);

    if (!statement) {
      response.writeHead(StatusCodes.NOT_FOUND);
      response.end(JSON.stringify({ error: 'Geen actieve stelling gevonden voor deze index.' }));

      return;
    }

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(statement));
  }
  catch (error: unknown) {
    console.error('Stelling ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De stelling kon niet worden opgehaald.' }));
  }
}

export async function handleCreateStatementRequest(database: AppDatabase, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(request);
    const input = validateCreateStatement(body);
    const statement = await createStatement(database, input);

    response.writeHead(StatusCodes.CREATED);
    response.end(JSON.stringify(statement));
  }
  catch (error: unknown) {
    if (response.destroyed) {
      return;
    }

    if (error instanceof RequestError) {
      response.writeHead(error.status);
      response.end(JSON.stringify({ error: error.message }));

      return;
    }

    console.error('Stelling aanmaken mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De stelling kon niet worden aangemaakt.' }));
  }
}

export async function handleListStatementsRequest(database: AppDatabase, response: ServerResponse): Promise<void> {
  try {
    const statements = await listStatements(database);

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(statements));
  }
  catch (error: unknown) {
    console.error('Stellingen ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De stellingen konden niet worden opgehaald.' }));
  }
}

export async function handleGetStatementByIdRequest(database: AppDatabase, id: number, response: ServerResponse): Promise<void> {
  try {
    const statement = await getStatementById(database, id);

    if (!statement) {
      writeStatementNotFound(response);

      return;
    }

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(statement));
  }
  catch (error: unknown) {
    console.error('Stelling ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De stelling kon niet worden opgehaald.' }));
  }
}

export async function handleUpdateStatementRequest(database: AppDatabase, id: number, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(request);
    const input = validateUpdateStatement(body);
    const updated = await updateStatement(database, id, input);

    if (!updated) {
      writeStatementNotFound(response);

      return;
    }

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(await getStatementById(database, id)));
  }
  catch (error: unknown) {
    if (response.destroyed) {
      return;
    }

    if (error instanceof RequestError) {
      response.writeHead(error.status);
      response.end(JSON.stringify({ error: error.message }));

      return;
    }

    console.error('Stelling wijzigen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De stelling kon niet worden gewijzigd.' }));
  }
}

export async function handleDeleteStatementRequest(database: AppDatabase, id: number, response: ServerResponse): Promise<void> {
  try {
    const deleted = await deleteStatement(database, id);

    if (!deleted) {
      writeStatementNotFound(response);

      return;
    }

    response.writeHead(StatusCodes.NO_CONTENT);
    response.end();
  }
  catch (error: unknown) {
    if (isForeignKeyViolation(error)) {
      response.writeHead(StatusCodes.CONFLICT);
      response.end(JSON.stringify({ error: 'Deze stelling heeft nog partijantwoorden en kan niet worden verwijderd.' }));

      return;
    }

    console.error('Stelling verwijderen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De stelling kon niet worden verwijderd.' }));
  }
}
