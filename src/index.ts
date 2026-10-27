import type { AppDatabase } from './database';
import { openDatabase, openSupabaseDatabase } from './database';
import { createApp } from './server';

const defaultPort = 3000;
const maximumPort = 65535;
const port = Number(process.env['PORT'] ?? defaultPort);

function openConfiguredDatabase(): AppDatabase {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const apiKey = process.env['SUPABASE_SECRET_KEY'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if ((supabaseUrl === undefined) !== (apiKey === undefined)) {
    throw new Error('Stel SUPABASE_URL en SUPABASE_SECRET_KEY allebei in, of laat ze allebei weg voor de lokale SQLite-database.');
  }

  return supabaseUrl === undefined ? openDatabase() : openSupabaseDatabase();
}

if (!Number.isInteger(port) || port < 1 || port > maximumPort) {
  throw new Error('PORT moet een geheel getal tussen 1 en 65535 zijn.');
}

const database = openConfiguredDatabase();
const server = createApp(database);

server.once('close', () => {
  database.close();
});
server.once('error', (error: Error) => {
  console.error('Server starten mislukt:', error);

  database.close();

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
