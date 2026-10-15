import { StatusCodes } from 'http-status-codes';
import type { Server } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import {
  handleStatementRequest,
  handleCreateStatementRequest,
  handleListStatementsRequest,
  handleGetStatementByIdRequest,
  handleUpdateStatementRequest,
  handleDeleteStatementRequest,
} from './statements';
import { handleMatchingRequest } from './matching';
import {
  handleCreatePartyRequest,
  handleListPartiesRequest,
  handleGetPartyByIdRequest,
  handleUpdatePartyRequest,
  handleDeletePartyRequest,
} from './parties';
import { parseId } from './http/parse-id';
import { attachVisualizationWebSocket } from './visualization/live';
import { handleListVisualizationPointsRequest } from './visualization';
import type { PointBroadcaster } from './visualization';

const statementIdPattern = /^\/statements\/([^/]+)$/u;
const partyIdPattern = /^\/parties\/([^/]+)$/u;

export function createApp(database: DatabaseSync): Server {
  let broadcastPoint: PointBroadcaster = () => undefined;

  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const method = request.method ?? '';

      if (url.pathname === '/matching') {
        if (method !== 'POST') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'POST' });
          response.end(JSON.stringify({ error: 'Gebruik POST voor deze route.' }));

          return;
        }

        void handleMatchingRequest(database, request, response, broadcastPoint);

        return;
      }

      if (url.pathname === '/visualization/points') {
        if (method !== 'GET') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET' });
          response.end(JSON.stringify({ error: 'Gebruik GET voor deze route.' }));

          return;
        }

        handleListVisualizationPointsRequest(database, response);

        return;
      }

      if (url.pathname === '/statements') {
        if (method === 'GET') {
          handleStatementRequest(database, url.searchParams, response);

          return;
        }

        if (method === 'POST') {
          void handleCreateStatementRequest(database, request, response);

          return;
        }

        response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, POST' });
        response.end(JSON.stringify({ error: 'Gebruik GET of POST voor deze route.' }));

        return;
      }

      if (url.pathname === '/statements/all') {
        if (method !== 'GET') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET' });
          response.end(JSON.stringify({ error: 'Gebruik GET voor deze route.' }));

          return;
        }

        handleListStatementsRequest(database, response);

        return;
      }

      const statementIdMatch = statementIdPattern.exec(url.pathname);

      if (statementIdMatch) {
        const id = parseId(statementIdMatch[1]);

        if (id === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'Het id in de URL moet een positief geheel getal zijn.' }));

          return;
        }

        if (method === 'GET') {
          handleGetStatementByIdRequest(database, id, response);

          return;
        }

        if (method === 'PATCH') {
          void handleUpdateStatementRequest(database, id, request, response);

          return;
        }

        if (method === 'DELETE') {
          handleDeleteStatementRequest(database, id, response);

          return;
        }

        response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, PATCH, DELETE' });
        response.end(JSON.stringify({ error: 'Gebruik GET, PATCH of DELETE voor deze route.' }));

        return;
      }

      if (url.pathname === '/parties') {
        if (method === 'GET') {
          handleListPartiesRequest(database, response);

          return;
        }

        if (method === 'POST') {
          void handleCreatePartyRequest(database, request, response);

          return;
        }

        response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, POST' });
        response.end(JSON.stringify({ error: 'Gebruik GET of POST voor deze route.' }));

        return;
      }

      const partyIdMatch = partyIdPattern.exec(url.pathname);

      if (partyIdMatch) {
        const id = parseId(partyIdMatch[1]);

        if (id === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'Het id in de URL moet een positief geheel getal zijn.' }));

          return;
        }

        if (method === 'GET') {
          handleGetPartyByIdRequest(database, id, response);

          return;
        }

        if (method === 'PATCH') {
          void handleUpdatePartyRequest(database, id, request, response);

          return;
        }

        if (method === 'DELETE') {
          handleDeletePartyRequest(database, id, response);

          return;
        }

        response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, PATCH, DELETE' });
        response.end(JSON.stringify({ error: 'Gebruik GET, PATCH of DELETE voor deze route.' }));

        return;
      }

      response.writeHead(StatusCodes.NOT_FOUND);
      response.end(JSON.stringify({ error: 'Route niet gevonden.' }));
    }
    catch (error: unknown) {
      console.error('Aanvraag verwerken mislukt:', error);
      response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
      response.end(JSON.stringify({ error: 'De aanvraag kon niet worden verwerkt.' }));
    }
  });

  broadcastPoint = attachVisualizationWebSocket(server, database);

  return server;
}
