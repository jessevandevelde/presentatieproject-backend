-- Vier onderwijs- en werkveldprofielen voor ROC Kompas.
-- De bestaande tabelnaam `parties` blijft intern behouden voor databasecompatibiliteit.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

WITH seed(name, description, is_active) AS (
  VALUES
    ('Theoretisch & vernieuwend', 'Legt de nadruk op vakkennis, analyse en doordachte vernieuwing.', 1),
    ('Praktisch & vernieuwend', 'Leert vooral door te doen en past nieuwe technieken en werkvormen snel toe.', 1),
    ('Theoretisch & behoudend', 'Bouwt op bewezen kennis, vaste kaders en grondige theoretische voorbereiding.', 1),
    ('Praktisch & behoudend', 'Legt de nadruk op ambacht, werkdiscipline en bewezen werkwijzen in de praktijk.', 1)
)
INSERT INTO parties (name, description, image_url, is_active)
SELECT seed.name, seed.description, NULL, seed.is_active
FROM seed
WHERE NOT EXISTS (SELECT 1 FROM parties WHERE parties.name = seed.name);

COMMIT;
