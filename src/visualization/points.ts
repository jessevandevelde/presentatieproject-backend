import type { AppDatabase } from '../database';
import { isRemoteDatabase } from '../database';
import type { Answer } from '../types/answer.interface';
import type { VisualizationPoint } from '../types/visualization.interface';
import type { ReferenceProfile } from '../matching/reference-data';
import { prepareCached } from '../database/prepared-statement';

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

export function calculatePoint(id: string, answers: ReadonlyMap<number, Answer>, profiles: readonly ReferenceProfile[]): VisualizationPoint {
  const loadings = new Map<number, { x: number, y: number }>();

  for (const profile of profiles) {
    const position = profilePositions.get(profile.profileName);

    if (position === undefined) {
      continue;
    }

    for (const referenceAnswer of profile.answers) {
      const loading = loadings.get(referenceAnswer.statementId) ?? { x: 0, y: 0 };
      const referenceValue = answerValue(referenceAnswer.answer);

      loading.x += referenceValue * position.x;
      loading.y += referenceValue * position.y;
      loadings.set(referenceAnswer.statementId, loading);
    }
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

export async function savePoint(database: AppDatabase, point: VisualizationPoint): Promise<VisualizationPoint | undefined> {
  if (isRemoteDatabase(database)) return database.saveVisualizationPoint(point);

  const result = prepareCached(database, 'INSERT OR IGNORE INTO visualization_points (submission_key, x, y) VALUES (?, ?, ?)').run(point.id, point.x, point.y);

  if (result.changes !== 1) {
    return undefined;
  }

  return { ...point, id: String(result.lastInsertRowid) };
}

function rowsToPoints(rows: readonly Record<string, unknown>[]): VisualizationPoint[] {
  return rows.map((row) => {
    const { publicId, x, y } = row;

    if ((typeof publicId !== 'number' && typeof publicId !== 'bigint') || typeof x !== 'number' || typeof y !== 'number') {
      throw new Error('Ongeldig visualisatiepunt in de database.');
    }

    return { id: String(publicId), x, y };
  });
}

export async function listPoints(database: AppDatabase, after = 0, limit = 1000): Promise<readonly VisualizationPoint[]> {
  if (isRemoteDatabase(database)) return database.listVisualizationPoints(after, limit);

  const rows = prepareCached(database, `
    SELECT rowid AS publicId, x, y
    FROM visualization_points
    WHERE rowid > ?
    ORDER BY rowid
    LIMIT ?
  `).all(after, limit);

  return rowsToPoints(rows);
}

export async function listRecentPoints(database: AppDatabase, limit = 1000): Promise<readonly VisualizationPoint[]> {
  if (isRemoteDatabase(database)) return database.listRecentVisualizationPoints(limit);

  const rows = prepareCached(database, `
    SELECT publicId, x, y FROM (
      SELECT rowid AS publicId, x, y
      FROM visualization_points
      ORDER BY rowid DESC
      LIMIT ?
    )
    ORDER BY publicId
  `).all(limit);

  return rowsToPoints(rows);
}

export async function countPoints(database: AppDatabase): Promise<number> {
  if (isRemoteDatabase(database)) return database.countVisualizationPoints();

  const total = prepareCached(database, 'SELECT COUNT(*) AS total FROM visualization_points').get()?.['total'];

  if (typeof total !== 'number') {
    throw new Error('Het aantal visualisatiepunten kon niet worden bepaald.');
  }

  return total;
}
