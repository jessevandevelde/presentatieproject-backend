import { StatusCodes } from 'http-status-codes';
import type { ServerResponse } from 'node:http';
import type { AppDatabase } from '../database';
import type { VisualizationPoint } from '../types/visualization.interface';
import { listPoints } from './points';

export type PointBroadcaster = (point: VisualizationPoint) => Promise<void>;

export async function handleListVisualizationPointsRequest(database: AppDatabase, response: ServerResponse): Promise<void> {
  try {
    const points = await listPoints(database);

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
