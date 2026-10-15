import { StatusCodes } from 'http-status-codes';
import type { ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import type { VisualizationPoint } from '../types/visualization.interface';
import { listPoints } from './points';

export type PointBroadcaster = (point: VisualizationPoint) => void;

export function handleListVisualizationPointsRequest(database: DatabaseSync, response: ServerResponse): void {
  try {
    const points = listPoints(database);

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify({ points, total: points.length }));
  }
  catch (error: unknown) {
    console.error('Visualisatiepunten ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De visualisatiepunten konden niet worden opgehaald.' }));
  }
}

export { calculatePoint, listPoints, savePoint } from './points';
