import { StatusCodes } from 'http-status-codes';
import type { ServerResponse } from 'node:http';
import type { AppDatabase } from '../database';
import type { VisualizationPoint } from '../types/visualization.interface';
import { countPoints, listPoints } from './points';
import { RequestError } from '../http/request-error';

export type PointBroadcaster = (point: VisualizationPoint) => Promise<void>;

const defaultPointLimit = 1000;
const maximumPointLimit = 5000;

function parseNonNegativeInteger(value: string | null, name: string, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (value === null) {
    return fallback;
  }

  if (!/^(?:0|[1-9]\d*)$/u.test(value)) {
    throw new RequestError(`${name} moet een niet-negatief geheel getal zijn.`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new RequestError(`${name} is te groot.`);
  }

  return parsed;
}

export async function handleListVisualizationPointsRequest(database: AppDatabase, query: URLSearchParams, response: ServerResponse): Promise<void> {
  try {
    const after = parseNonNegativeInteger(query.get('after'), 'after', 0);
    const limit = parseNonNegativeInteger(query.get('limit'), 'limit', defaultPointLimit, maximumPointLimit);

    if (limit < 1) {
      throw new RequestError('limit moet minimaal 1 zijn.');
    }

    const [points, total] = await Promise.all([listPoints(database, after, limit), countPoints(database)]);
    const nextCursor = points.at(-1)?.id ?? String(after);

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify({ points, total, nextCursor }));
  }
  catch (error: unknown) {
    if (error instanceof RequestError) {
      response.writeHead(error.status);
      response.end(JSON.stringify({ error: error.message }));

      return;
    }

    console.error('Visualisatiepunten ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De visualisatiepunten konden niet worden opgehaald.' }));
  }
}

export { calculatePoint, countPoints, listPoints, listRecentPoints, savePoint } from './points';
