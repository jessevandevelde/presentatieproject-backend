import type { Server } from 'node:http';
import type { AppDatabase } from '../database';
import { WebSocket, WebSocketServer } from 'ws';
import type { VisualizationPointMessage, VisualizationSnapshot } from '../types/visualization.interface';
import { countPoints, listRecentPoints } from './points';
import type { PointBroadcaster } from './index';

const internalErrorCloseCode = 1011;
const snapshotPointLimit = 5000;

export function attachVisualizationWebSocket(server: Server, database: AppDatabase): PointBroadcaster {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  let total = 0;

  const totalInitialized = countPoints(database).then((value) => {
    total = value;
  });

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
        const [points] = await Promise.all([listRecentPoints(database, snapshotPointLimit), totalInitialized]);
        const snapshot: VisualizationSnapshot = { type: 'snapshot', points, total };

        webSocket.send(JSON.stringify(snapshot));
      }
      catch (error: unknown) {
        console.error('WebSocket-snapshot versturen mislukt:', error);
        webSocket.close(internalErrorCloseCode, 'Snapshot niet beschikbaar');
      }
    })();
  });

  return async (point) => {
    await totalInitialized;
    total += 1;

    const message: VisualizationPointMessage = { type: 'point', point, total };
    const serializedMessage = JSON.stringify(message);

    for (const client of webSocketServer.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serializedMessage);
      }
    }
  };
}
