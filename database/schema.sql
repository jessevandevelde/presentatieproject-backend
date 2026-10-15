PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS superadmins (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (length(name) <= 100),
    email VARCHAR(100) NOT NULL UNIQUE CHECK (length(email) <= 100),
    password_hash VARCHAR(255) NOT NULL CHECK (length(password_hash) <= 255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS statements (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES superadmins(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (length(name) <= 100),
    description TEXT,
    image_url VARCHAR(255) CHECK (length(image_url) <= 255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS party_answers (
    id INTEGER PRIMARY KEY,
    party_id INTEGER NOT NULL REFERENCES parties(id),
    statement_id INTEGER NOT NULL REFERENCES statements(id),
    answer TEXT NOT NULL CHECK (answer IN ('eens', 'neutraal', 'oneens')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Alleen een willekeurige id en de twee berekende coördinaten worden bewaard.
-- Er worden bewust geen antwoorden, tijdstippen of herleidbare aanvraaggegevens opgeslagen.
CREATE TABLE IF NOT EXISTS visualization_points (
    submission_key TEXT PRIMARY KEY CHECK (length(submission_key) = 36),
    x REAL NOT NULL CHECK (x BETWEEN -100 AND 100),
    y REAL NOT NULL CHECK (y BETWEEN -100 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_statements_created_by ON statements(created_by);
CREATE INDEX IF NOT EXISTS idx_party_answers_party_id ON party_answers(party_id);
CREATE INDEX IF NOT EXISTS idx_party_answers_statement_id ON party_answers(statement_id);

CREATE TRIGGER IF NOT EXISTS superadmins_updated_at
AFTER UPDATE OF name, email, password_hash ON superadmins
BEGIN
    UPDATE superadmins SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS statements_updated_at
AFTER UPDATE OF text, created_by, is_active ON statements
BEGIN
    UPDATE statements SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS parties_updated_at
AFTER UPDATE OF name, description, image_url, is_active ON parties
BEGIN
    UPDATE parties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS party_answers_updated_at
AFTER UPDATE OF party_id, statement_id, answer ON party_answers
BEGIN
    UPDATE party_answers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

COMMIT;
