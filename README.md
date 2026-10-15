# ROC Kompas backend

Node.js- en TypeScript-backend voor ROC Kompas van ROC Midden Nederland. De API levert dertig stellingen en vergelijkt de antwoorden met vier referentieprofielen:

- Theoretisch & vernieuwend;
- Praktisch & vernieuwend;
- Theoretisch & behoudend;
- Praktisch & behoudend.

De antwoorden van deelnemers worden alleen gebruikt om de uitslag te berekenen en worden niet opgeslagen. Voor de live visualisatie bewaart de backend uitsluitend een willekeurige inzendcode en de berekende X- en Y-coördinaat, zonder tijdstip of persoonsgegevens.

## Starten

```sh
npm install
npm run db:init
npm run db:seed
npm start
```

De server draait standaard op `http://localhost:3000`. Met `PORT` en `DATABASE_PATH` kan dit worden aangepast. De standaarddatabase is `data/roc-kompas.sqlite`.

## Database en voorbeeldinhoud

Het schema staat in `database/schema.sql`. De drie seedbestanden vullen de database herhaalbaar met de 30 ROC Kompas-stellingen, vier onderwijsprofielen en hun referentieantwoorden.

De tabel- en routenamen rond `parties` zijn tijdelijk intern behouden voor compatibiliteit met de oorspronkelijke code. In de responses die de vragenlijst gebruikt heten deze records `profileId`, `profileName` en `profileAnswers`; in de interface worden ze uitsluitend als onderwijsprofielen gepresenteerd.

## Belangrijkste routes

- `GET /statements?index=0`: haal een actieve stelling en profielantwoorden op.
- `POST /matching`: vergelijk precies één antwoord per actieve stelling met de profielen. De body bevat ook een willekeurige UUID als `submissionId`, waarmee retries idempotent blijven.
- `GET /visualization/points`: haal alle anonieme visualisatiepunten op.
- `WS /visualization/live`: ontvang eerst een volledige snapshot en daarna ieder nieuw punt realtime.
- `GET /statements/all`: beheerweergave van alle stellingen.
- `/parties`: bestaande compatibiliteitsroute voor het beheren van de referentieprofielen.

Geldige antwoorden zijn `eens`, `neutraal` en `oneens`. De matching is het percentage exact gelijke antwoorden per profiel.

## Controles

- `npm run build`: TypeScript compileren.
- `npm run typecheck`: types controleren zonder output.
- `npm run lint`: broncode controleren.
- `npm test`: alle backendtests uitvoeren met tijdelijke databases.
