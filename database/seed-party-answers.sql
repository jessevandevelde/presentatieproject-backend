-- Referentieantwoorden voor de vier ROC Kompas-profielen.
-- theory en innovation gebruiken -1 (tegenovergesteld), 0 (neutraal) en 1 (gericht op die as).
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

WITH
profile_axis(name, theory, innovation) AS (
  VALUES
    ('Theoretisch & vernieuwend', 1, 1),
    ('Praktisch & vernieuwend', -1, 1),
    ('Theoretisch & behoudend', 1, -1),
    ('Praktisch & behoudend', -1, -1)
),
statement_axis(text, theory, innovation) AS (
  VALUES
    ('In de opleiding moet meer tijd gaan naar vaktheorie, ook als daardoor minder praktijkuren overblijven.', 1, 0),
    ('Studenten tonen hun vakkennis het best aan met een echte praktijkopdracht.', -1, 0),
    ('Kennistoetsen moeten een belangrijk onderdeel blijven van de beoordeling van studenten.', 1, -1),
    ('De vakinhoud van de opleiding moet ieder jaar samen met het werkveld worden vernieuwd.', -1, 1),
    ('Werkhouding en werknemersvaardigheden moeten even zwaar meetellen als vakinhoudelijke resultaten.', -1, 0),
    ('Studenten moeten op school expliciet worden beoordeeld op afspraken nakomen en op tijd komen.', 0, -1),
    ('Leerbedrijven moeten studenten ruimte geven om fouten te maken en daarvan te leren.', -1, 1),
    ('Een vaste, traditionele werkhouding is belangrijker dan meegaan met nieuwe, flexibele werkvormen.', 0, -1),
    ('Samenwerken in een team moet een groter deel van de opleiding vormen.', -1, 1),
    ('Studenten moeten iedere week professionele gesprekken oefenen met realistische praktijksituaties.', -1, 0),
    ('Digitale hulpmiddelen voor communicatie en samenwerking moeten standaard in de opleiding worden gebruikt.', 0, 1),
    ('Individuele prestaties moeten zwaarder meetellen dan het resultaat van een team.', 1, -1),
    ('Studenten moeten bij opdrachten vaker zelf bepalen hoe zij tot een oplossing komen.', -1, 1),
    ('De begeleiding moet tijdens de opleiding stap voor stap afnemen om zelfstandigheid te stimuleren.', -1, 1),
    ('Een duidelijk stappenplan werkt voor studenten beter dan veel vrijheid in de aanpak.', 1, -1),
    ('Iedere student moet vóór het diploma zelfstandig een echte opdracht uit de beroepspraktijk uitvoeren.', -1, 0),
    ('Tijdens de BPV moet een vaste begeleider van school wekelijks contact hebben met de student.', 0, -1),
    ('Het leerbedrijf moet tijdens de stage grotendeels bepalen welke leeractiviteiten de student uitvoert.', -1, 0),
    ('Een digitaal BPV-portfolio moet leidend zijn bij de begeleiding en beoordeling van de stage.', 0, 1),
    ('Vaste fysieke bezoeken van school aan het leerbedrijf moeten behouden blijven.', 0, -1),
    ('Bedrijf en school moeten minimaal één keer per maand contact hebben over de voortgang van een student.', 0, -1),
    ('Online contact kan de meeste fysieke overleggen tussen school en leerbedrijf vervangen.', 0, 1),
    ('Leerbedrijven moeten direct kunnen meebeslissen over veranderingen in de opleiding.', -1, 1),
    ('Een groot deel van iedere opleiding moet bestaan uit opdrachten uit de echte beroepspraktijk.', -1, 0),
    ('Actuele werkwijzen uit het werkveld zijn belangrijker dan een jarenlang vaststaand lesprogramma.', -1, 1),
    ('Docenten moeten regelmatig in het werkveld meelopen om hun lessen actueel te houden.', -1, 1),
    ('School en werkveld moeten examens en praktijkbeoordelingen samen ontwerpen.', -1, 1),
    ('AI en andere nieuwe technieken moeten standaard aan bod komen in iedere opleiding.', 0, 1),
    ('Studenten moeten eerst leren om de uitkomsten van AI kritisch te controleren voordat zij AI zelfstandig gebruiken.', 1, 1),
    ('Bestaande vaktechnieken moeten centraal blijven staan totdat nieuwe technieken zich in de praktijk hebben bewezen.', 0, -1)
)
INSERT INTO party_answers (party_id, statement_id, answer)
SELECT parties.id, statements.id,
  CASE
    WHEN statement_axis.theory * profile_axis.theory + statement_axis.innovation * profile_axis.innovation > 0 THEN 'eens'
    WHEN statement_axis.theory * profile_axis.theory + statement_axis.innovation * profile_axis.innovation < 0 THEN 'oneens'
    ELSE 'neutraal'
  END
FROM profile_axis
JOIN parties ON parties.name = profile_axis.name
CROSS JOIN statement_axis
JOIN statements ON statements.text = statement_axis.text
WHERE NOT EXISTS (
  SELECT 1 FROM party_answers
  WHERE party_answers.party_id = parties.id AND party_answers.statement_id = statements.id
);

COMMIT;
