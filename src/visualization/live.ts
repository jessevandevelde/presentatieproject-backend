import type { Server } from 'node:http';
import type { AppDatabase } from '../database';
import { WebSocket, WebSocketServer } from 'ws';
import type { VisualizationPointMessage, VisualizationSnapshot } from '../types/visualization.interface';
import { listPoints } from './points';
import type { PointBroadcaster } from './index';

const internalErrorCloseCode = 1011;

export function attachVisualizationWebSocket(server: Server, database: AppDatabase): PointBroadcaster {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (url.pathname !== '/visualization/live') {
      socket.destroy();

      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit('connection', webSocket, request);
    });
  });

  webSocketServer.on('connection', (webSocket) => {
    void (async (): Promise<void> => {
      try {
        const points = await listPoints(database);
        const snapshot: VisualizationSnapshot = { type: 'snapshot', points, total: points.length };

        webSocket.send(JSON.stringify(snapshot));
      }
      catch (error: unknown) {
        console.error('WebSocket-snapshot versturen mislukt:', error);
        webSocket.close(internalErrorCloseCode, 'Snapshot niet beschikbaar');
      }
    })();
  });

  return async (point) => {
    const total = (await listPoints(database)).length;

    const message: VisualizationPointMessage = { type: 'point', point, total };
    const serializedMessage = JSON.stringify(message);

    for (const client of webSocketServer.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serializedMessage);
      }
    }
  };
}
