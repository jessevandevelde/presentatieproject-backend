# ROC Kompas backend

Node.js- en TypeScript-backend voor ROC Kompas van ROC Midden Nederland. De backend gebruikt **Supabase PostgreSQL** via de Data API zodra beide Supabase-variabelen zijn ingesteld. Zonder die variabelen gebruikt de lokale ontwikkelserver automatisch SQLite; de tests gebruiken die adapter eveneens.

## Supabase instellen

1. Maak een Supabase-project aan met de Data API ingeschakeld.
2. Voer [`supabase/migrations/20261027000000_roc_kompas.sql`](supabase/migrations/20261027000000_roc_kompas.sql) uit in de SQL Editor.
3. Voer daarna [`supabase/seed.sql`](supabase/seed.sql) uit. Dit voegt 30 stellingen, vier onderwijsprofielen en 120 referentieantwoorden idempotent toe.
4. Kopieer `.env.example` naar `.env` en vul in:
   - `SUPABASE_URL`: de project-URL;
   - `SUPABASE_SECRET_KEY`: een geheime `sb_secret_...`-serversleutel.

De secret key mag uitsluitend in de backendomgeving staan. Hij hoort nooit in de Angular-frontend, browsercode, logs of Git. Alle tabellen hebben Row Level Security zonder publieke policies; alleen de backendservice heeft toegang. De verouderde `SUPABASE_SERVICE_ROLE_KEY` blijft tijdelijk als terugwaarts compatibele alias werken.

## Starten

```sh
npm install
npm start
```

De server draait standaard op `http://localhost:3000`. Met `PORT` kan dit worden aangepast.

## Data en privacy

De API levert dertig stellingen en vergelijkt antwoorden met vier referentieprofielen:

- Theoretisch & vernieuwend;
- Praktisch & vernieuwend;
- Theoretisch & behoudend;
- Praktisch & behoudend.

Individuele antwoorden worden niet bewaard. Voor de live visualisatie wordt alleen een willekeurige inzending-ID plus de berekende x/y-positie opgeslagen; geen account, tijdstip of antwoordlijst.

## Belangrijkste routes

- `GET /statements?index=0`: actieve stelling en profielantwoorden.
- `POST /matching`: vergelijking en anoniem visualisatiepunt.
- `GET /visualization/points`: bestaande anonieme punten.
- `WS /visualization/live`: live snapshots en nieuwe punten.
- `/statements/all`, `/statements/:id` en `/parties`: bestaande beheerroutes.

## Controles

- `npm run build`: TypeScript compileren.
- `npm run typecheck`: types controleren zonder output.
- `npm run lint`: broncode controleren.
- `npm test`: alle backendtests uitvoeren met tijdelijke SQLite-databases, zonder Supabase-data te wijzigen.
