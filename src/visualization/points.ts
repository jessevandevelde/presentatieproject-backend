import type { DatabaseSync } from 'node:sqlite';
import type { Answer } from '../types/answer.interface';
import type { VisualizationPoint } from '../types/visualization.interface';

const maximumCoordinate = 100;
const coordinatePrecision = 100;

const profilePositions = new Map<string, { readonly x: number, readonly y: number }>([
  ['Theoretisch & vernieuwend', { x: -1, y: 1 }],
  ['Praktisch & vernieuwend', { x: 1, y: 1 }],
  ['Theoretisch & behoudend', { x: -1, y: -1 }],
  ['Praktisch & behoudend', { x: 1, y: -1 }],
]);

function answerValue(answer: unknown): number {
  if (answer === 'eens') {
    return 1;
  }

  if (answer === 'oneens') {
    return -1;
  }

  return 0;
}

function roundCoordinate(value: number): number {
  return Math.round(Math.max(-maximumCoordinate, Math.min(maximumCoordinate, value)) * coordinatePrecision) / coordinatePrecision;
}

export function calculatePoint(database: DatabaseSync, id: string, answers: ReadonlyMap<number, Answer>): VisualizationPoint {
  const referenceAnswers = database.prepare(/* sql */ `
    SELECT parties.name AS profileName, current.statement_id AS statementId, current.answer
    FROM party_answers AS current
    JOIN parties ON parties.id = current.party_id AND parties.is_active = 1
    JOIN statements ON statements.id = current.statement_id AND statements.is_active = 1
    WHERE current.id = (
      SELECT id FROM party_answers
      WHERE party_id = current.party_id AND statement_id = current.statement_id
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    )
  `).all();

  const loadings = new Map<number, { x: number, y: number }>();

  for (const row of referenceAnswers) {
    const { profileName, statementId } = row;
    const position = typeof profileName === 'string' ? profilePositions.get(profileName) : undefined;

    if (position === undefined || typeof statementId !== 'number') {
      continue;
    }

    const loading = loadings.get(statementId) ?? { x: 0, y: 0 };
    const referenceValue = answerValue(row['answer']);

    loading.x += referenceValue * position.x;
    loading.y += referenceValue * position.y;
    loadings.set(statementId, loading);
  }

  let x = 0;
  let y = 0;
  let xMaximum = 0;
  let yMaximum = 0;

  for (const [statementId, answer] of answers) {
    const loading = loadings.get(statementId) ?? { x: 0, y: 0 };
    const value = answerValue(answer);

    x += value * loading.x;
    y += value * loading.y;
    xMaximum += Math.abs(loading.x);
    yMaximum += Math.abs(loading.y);
  }

  return {
    id,
    x: roundCoordinate(xMaximum === 0 ? 0 : x / xMaximum * maximumCoordinate),
    y: roundCoordinate(yMaximum === 0 ? 0 : y / yMaximum * maximumCoordinate),
  };
}

export function savePoint(database: DatabaseSync, point: VisualizationPoint): VisualizationPoint | undefined {
  const result = database.prepare('INSERT OR IGNORE INTO visualization_points (submission_key, x, y) VALUES (?, ?, ?)').run(point.id, point.x, point.y);

  if (result.changes !== 1) {
    return undefined;
  }

  return { ...point, id: String(result.lastInsertRowid) };
}

export function listPoints(database: DatabaseSync): VisualizationPoint[] {
  return database.prepare('SELECT rowid AS publicId, x, y FROM visualization_points ORDER BY rowid').all().map((row) => {
    const { publicId, x, y } = row;

    if ((typeof publicId !== 'number' && typeof publicId !== 'bigint') || typeof x !== 'number' || typeof y !== 'number') {
      throw new Error('Ongeldig visualisatiepunt in de database.');
    }

    return { id: String(publicId), x, y };
  });
}
