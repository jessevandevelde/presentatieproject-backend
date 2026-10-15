-- Stellingen voor ROC Kompas, verdeeld over acht thema's rond onderwijs, BPV en werkveld.
-- Herhaalbaar zonder dubbele teksten. Het technische importrecord heeft geen bruikbaar wachtwoord.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

INSERT INTO superadmins (name, email, password_hash)
SELECT 'Stellingenimport', 'stellingen-import@roc-kompas.invalid', '!disabled:statement-import'
WHERE NOT EXISTS (SELECT 1 FROM superadmins WHERE email = 'stellingen-import@roc-kompas.invalid');

WITH seed(text) AS (
  VALUES
    ('In de opleiding moet meer tijd gaan naar vaktheorie, ook als daardoor minder praktijkuren overblijven.'),
    ('Studenten tonen hun vakkennis het best aan met een echte praktijkopdracht.'),
    ('Kennistoetsen moeten een belangrijk onderdeel blijven van de beoordeling van studenten.'),
    ('De vakinhoud van de opleiding moet ieder jaar samen met het werkveld worden vernieuwd.'),
    ('Werkhouding en werknemersvaardigheden moeten even zwaar meetellen als vakinhoudelijke resultaten.'),
    ('Studenten moeten op school expliciet worden beoordeeld op afspraken nakomen en op tijd komen.'),
    ('Leerbedrijven moeten studenten ruimte geven om fouten te maken en daarvan te leren.'),
    ('Een vaste, traditionele werkhouding is belangrijker dan meegaan met nieuwe, flexibele werkvormen.'),
    ('Samenwerken in een team moet een groter deel van de opleiding vormen.'),
    ('Studenten moeten iedere week professionele gesprekken oefenen met realistische praktijksituaties.'),
    ('Digitale hulpmiddelen voor communicatie en samenwerking moeten standaard in de opleiding worden gebruikt.'),
    ('Individuele prestaties moeten zwaarder meetellen dan het resultaat van een team.'),
    ('Studenten moeten bij opdrachten vaker zelf bepalen hoe zij tot een oplossing komen.'),
    ('De begeleiding moet tijdens de opleiding stap voor stap afnemen om zelfstandigheid te stimuleren.'),
    ('Een duidelijk stappenplan werkt voor studenten beter dan veel vrijheid in de aanpak.'),
    ('Iedere student moet vóór het diploma zelfstandig een echte opdracht uit de beroepspraktijk uitvoeren.'),
    ('Tijdens de BPV moet een vaste begeleider van school wekelijks contact hebben met de student.'),
    ('Het leerbedrijf moet tijdens de stage grotendeels bepalen welke leeractiviteiten de student uitvoert.'),
    ('Een digitaal BPV-portfolio moet leidend zijn bij de begeleiding en beoordeling van de stage.'),
    ('Vaste fysieke bezoeken van school aan het leerbedrijf moeten behouden blijven.'),
    ('Bedrijf en school moeten minimaal één keer per maand contact hebben over de voortgang van een student.'),
    ('Online contact kan de meeste fysieke overleggen tussen school en leerbedrijf vervangen.'),
    ('Leerbedrijven moeten direct kunnen meebeslissen over veranderingen in de opleiding.'),
    ('Een groot deel van iedere opleiding moet bestaan uit opdrachten uit de echte beroepspraktijk.'),
    ('Actuele werkwijzen uit het werkveld zijn belangrijker dan een jarenlang vaststaand lesprogramma.'),
    ('Docenten moeten regelmatig in het werkveld meelopen om hun lessen actueel te houden.'),
    ('School en werkveld moeten examens en praktijkbeoordelingen samen ontwerpen.'),
    ('AI en andere nieuwe technieken moeten standaard aan bod komen in iedere opleiding.'),
    ('Studenten moeten eerst leren om de uitkomsten van AI kritisch te controleren voordat zij AI zelfstandig gebruiken.'),
    ('Bestaande vaktechnieken moeten centraal blijven staan totdat nieuwe technieken zich in de praktijk hebben bewezen.')
)
INSERT INTO statements (text, created_by)
SELECT seed.text, superadmins.id
FROM seed
CROSS JOIN superadmins
WHERE superadmins.email = 'stellingen-import@roc-kompas.invalid'
AND NOT EXISTS (SELECT 1 FROM statements WHERE statements.text = seed.text);

COMMIT;
