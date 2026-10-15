import { openDatabase } from './database';
import { createApp } from './server';

const defaultPort = 3000;
const maximumPort = 65535;
const port = Number(process.env['PORT'] ?? defaultPort);

if (!Number.isInteger(port) || port < 1 || port > maximumPort) {
  throw new Error('PORT moet een geheel getal tussen 1 en 65535 zijn.');
}

const database = openDatabase();
const server = createApp(database);

server.once('close', () => {
  database.close();
});
server.once('error', (error: Error) => {
  console.error('Server starten mislukt:', error);

  if (database.isOpen) {
    database.close();
  }

  process.exitCode = 1;
});

function shutdown(): void {
  server.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.listen(port, () => {
  process.stdout.write(`ROC Kompas backend: http://localhost:${String(port)}\n`);
});
