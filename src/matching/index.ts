import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { matchResults } from './match-results';
import { validateAnswers, validateSubmissionId } from './validation';
import { readJsonBody } from '../http/read-json-body';
import { RequestError } from '../http/request-error';
import type { PointBroadcaster } from '../visualization';
import { calculatePoint, savePoint } from '../visualization';

export async function handleMatchingRequest(database: DatabaseSync, request: IncomingMessage, response: ServerResponse, broadcastPoint: PointBroadcaster): Promise<void> {
  try {
    const body = await readJsonBody(request);
    const answers = validateAnswers(database, body);
    const submissionId = validateSubmissionId(body);
    const results = matchResults(database, answers);
    const point = calculatePoint(database, submissionId, answers);
    const savedPoint = savePoint(database, point);

    if (savedPoint !== undefined) {
      broadcastPoint(savedPoint);
    }

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(results));
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

    console.error('Matching mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De overeenkomst met de onderwijsprofielen kon niet worden berekend.' }));
  }
}
