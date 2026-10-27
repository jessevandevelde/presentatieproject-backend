import type { Answer } from '../types/answer.interface';
import type { CreatePartyInput, Party, UpdatePartyInput } from '../types/party.interface';
import type { CreateStatementInput, StatementRecord, StatementResult, UpdateStatementInput } from '../types/statement.interface';
import type { VisualizationPoint } from '../types/visualization.interface';
import type { ProfileReferenceAnswer, RemoteDatabase } from './types';

type JsonRow = Record<string, unknown>;

const technicalAdminEmail = 'stellingen-import@roc-kompas.invalid';
const noContentStatus = 204;

export class SupabaseRequestError extends Error {
  public readonly code: string | undefined;

  public constructor(code: string | undefined, message: string) {
    super(message);
    this.code = code;
  }
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number') throw new Error(`Supabase gaf geen geldig ${field} terug.`);

  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Supabase gaf geen geldige ${field} terug.`);

  return value;
}

function isJsonRow(value: unknown): value is JsonRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowToParty(row: JsonRow): Party {
  return {
    id: requireNumber(row['id'], 'profiel-id'),
    name: requireString(row['name'], 'profielnaam'),
    description: typeof row['description'] === 'string' ? row['description'] : null,
    imageUrl: typeof row['image_url'] === 'string' ? row['image_url'] : null,
    isActive: row['is_active'] === true,
    createdAt: requireString(row['created_at'], 'aanmaaktijd'),
    updatedAt: requireString(row['updated_at'], 'wijzigingstijd'),
  };
}

function rowToStatement(row: JsonRow): StatementRecord {
  return {
    id: requireNumber(row['id'], 'stelling-id'),
    text: requireString(row['text'], 'stellingtekst'),
    isActive: row['is_active'] === true,
    createdAt: requireString(row['created_at'], 'aanmaaktijd'),
    updatedAt: requireString(row['updated_at'], 'wijzigingstijd'),
  };
}

export class SupabaseDatabase implements RemoteDatabase {
  public readonly kind = 'supabase' as const;

  private readonly restUrl: string;

  private readonly apiKey: string;

  public constructor(url: string, apiKey: string) {
    this.restUrl = `${url.replace(/\/+$/u, '')}/rest/v1`;
    this.apiKey = apiKey;
  }

  public close(): void {
    // De Data API gebruikt stateless HTTP-verzoeken.
  }

  public async createParty(input: CreatePartyInput): Promise<Party> {
    const values: JsonRow = { name: input.name, description: input.description };

    values['image_url'] = input.imageUrl;
    values['is_active'] = input.isActive;

    const rows = await this.requestRows('/parties', {
      method: 'POST', headers: this.preferRepresentation(),
      body: JSON.stringify(values),
    });

    if (rows.length === 0) throw new Error('Supabase heeft geen aangemaakt profiel teruggegeven.');

    const [row] = rows;

    return rowToParty(row);
  }

  public async listParties(): Promise<readonly Party[]> {
    return (await this.requestRows('/parties?select=*&order=id.asc')).map(rowToParty);
  }

  public async getPartyById(id: number): Promise<Party | undefined> {
    const rows = await this.requestRows(`/parties?select=*&id=eq.${String(id)}&limit=1`);

    if (rows.length === 0) return undefined;

    const [row] = rows;

    return rowToParty(row);
  }

  public async updateParty(id: number, input: UpdatePartyInput): Promise<boolean> {
    const values: JsonRow = {};

    if (input.name !== undefined) values['name'] = input.name;
    if (input.description !== undefined) values['description'] = input.description;
    if (input.imageUrl !== undefined) values['image_url'] = input.imageUrl;
    if (input.isActive !== undefined) values['is_active'] = input.isActive;

    return (await this.requestRows(`/parties?id=eq.${String(id)}`, {
      method: 'PATCH', headers: this.preferRepresentation(), body: JSON.stringify(values),
    })).length > 0;
  }

  public async deleteParty(id: number): Promise<boolean> {
    return (await this.requestRows(`/parties?id=eq.${String(id)}`, {
      method: 'DELETE', headers: this.preferRepresentation(),
    })).length > 0;
  }

  public async createStatement(input: CreateStatementInput): Promise<StatementRecord> {
    const values: JsonRow = { text: input.text };

    values['created_by'] = await this.ensureTechnicalAdmin();
    values['is_active'] = input.isActive;

    const rows = await this.requestRows('/statements', {
      method: 'POST', headers: this.preferRepresentation(),
      body: JSON.stringify(values),
    });

    if (rows.length === 0) throw new Error('Supabase heeft geen aangemaakte stelling teruggegeven.');

    const [row] = rows;

    return rowToStatement(row);
  }

  public async listStatements(): Promise<readonly StatementRecord[]> {
    return (await this.requestRows('/statements?select=*&order=id.asc')).map(rowToStatement);
  }

  public async getStatementById(id: number): Promise<StatementRecord | undefined> {
    const rows = await this.requestRows(`/statements?select=*&id=eq.${String(id)}&limit=1`);

    if (rows.length === 0) return undefined;

    const [row] = rows;

    return rowToStatement(row);
  }

  public async getStatement(index: number): Promise<StatementResult | undefined> {
    const statementRows = await this.requestRows(`/statements?select=id,text&is_active=eq.true&order=id.asc&offset=${String(index)}&limit=1`);

    if (statementRows.length === 0) return undefined;

    const [statement] = statementRows;

    const statementId = requireNumber(statement['id'], 'stelling-id');

    const [profiles, answerRows] = await Promise.all([
      this.requestRows('/parties?select=id,name&is_active=eq.true&order=id.asc'),
      this.requestRows(`/party_answers?select=id,party_id,answer,updated_at&statement_id=eq.${String(statementId)}&order=updated_at.desc,id.desc`),
    ]);

    const latestAnswers = new Map<number, Answer>();

    for (const row of answerRows) {
      const profileId = requireNumber(row['party_id'], 'profiel-id');
      const { answer } = row;

      if (!latestAnswers.has(profileId) && (answer === 'eens' || answer === 'neutraal' || answer === 'oneens')) latestAnswers.set(profileId, answer);
    }

    return {
      index, id: statementId, text: requireString(statement['text'], 'stellingtekst'),
      profileAnswers: profiles.map((profile) => {
        const profileId = requireNumber(profile['id'], 'profiel-id');

        return { profileId, profileName: requireString(profile['name'], 'profielnaam'), answer: latestAnswers.get(profileId) ?? null };
      }),
    };
  }

  public async updateStatement(id: number, input: UpdateStatementInput): Promise<boolean> {
    const values: JsonRow = {};

    if (input.text !== undefined) values['text'] = input.text;
    if (input.isActive !== undefined) values['is_active'] = input.isActive;

    return (await this.requestRows(`/statements?id=eq.${String(id)}`, {
      method: 'PATCH', headers: this.preferRepresentation(), body: JSON.stringify(values),
    })).length > 0;
  }

  public async deleteStatement(id: number): Promise<boolean> {
    return (await this.requestRows(`/statements?id=eq.${String(id)}`, {
      method: 'DELETE', headers: this.preferRepresentation(),
    })).length > 0;
  }

  public async getActiveStatementIds(): Promise<readonly number[]> {
    return (await this.requestRows('/statements?select=id&is_active=eq.true&order=id.asc'))
      .map(row => requireNumber(row['id'], 'stelling-id'));
  }

  public async getProfileReferenceAnswers(): Promise<readonly ProfileReferenceAnswer[]> {
    const [profiles, statements, rows] = await Promise.all([
      this.requestRows('/parties?select=id,name&is_active=eq.true&order=id.asc'),
      this.requestRows('/statements?select=id&is_active=eq.true'),
      this.requestRows('/party_answers?select=id,party_id,statement_id,answer,updated_at&order=updated_at.desc,id.desc'),
    ]);

    const profileNames = new Map(profiles.map(row => [requireNumber(row['id'], 'profiel-id'), requireString(row['name'], 'profielnaam')]));
    const activeStatements = new Set(statements.map(row => requireNumber(row['id'], 'stelling-id')));
    const seen = new Set<string>();
    const answers: ProfileReferenceAnswer[] = [];

    for (const row of rows) {
      const profileId = requireNumber(row['party_id'], 'profiel-id');
      const statementId = requireNumber(row['statement_id'], 'stelling-id');
      const profileName = profileNames.get(profileId);
      const { answer } = row;
      const key = `${String(profileId)}:${String(statementId)}`;

      if (profileName === undefined || !activeStatements.has(statementId) || seen.has(key)) continue;
      if (answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens') continue;

      seen.add(key);
      answers.push({ profileId, profileName, statementId, answer });
    }

    return answers;
  }

  public async saveVisualizationPoint(point: VisualizationPoint): Promise<VisualizationPoint | undefined> {
    try {
      const values: JsonRow = { x: point.x, y: point.y };

      values['submission_key'] = point.id;

      const rows = await this.requestRows('/visualization_points', {
        method: 'POST', headers: this.preferRepresentation(), body: JSON.stringify(values),
      });

      if (rows.length === 0) return undefined;

      const [row] = rows;

      return { id: String(requireNumber(row['id'], 'visualisatie-id')), x: requireNumber(row['x'], 'x'), y: requireNumber(row['y'], 'y') };
    }
    catch (error: unknown) {
      if (error instanceof SupabaseRequestError && error.code === '23505') return undefined;

      throw error;
    }
  }

  public async listVisualizationPoints(): Promise<readonly VisualizationPoint[]> {
    return (await this.requestRows('/visualization_points?select=id,x,y&order=id.asc')).map(row => ({
      id: String(requireNumber(row['id'], 'visualisatie-id')),
      x: requireNumber(row['x'], 'x'),
      y: requireNumber(row['y'], 'y'),
    }));
  }

  private async ensureTechnicalAdmin(): Promise<number> {
    const encodedEmail = encodeURIComponent(technicalAdminEmail);
    let rows = await this.requestRows(`/superadmins?select=id&email=eq.${encodedEmail}&limit=1`);

    if (rows.length === 0) {
      const values: JsonRow = { name: 'Stellingenimport', email: technicalAdminEmail };

      values['password_hash'] = '!disabled:statement-import';
      rows = await this.requestRows('/superadmins', {
        method: 'POST', headers: this.preferRepresentation(), body: JSON.stringify(values),
      });
    }

    if (rows.length === 0) throw new Error('Het technische beheerdersaccount kon niet worden gevonden of aangemaakt.');

    const [row] = rows;

    return requireNumber(row['id'], 'beheerder-id');
  }

  private preferRepresentation(): Headers {
    const headers = new Headers();

    headers.set('Prefer', 'return=representation');

    return headers;
  }

  private async requestRows(path: string, init: RequestInit = {}): Promise<JsonRow[]> {
    const headers = new Headers(init.headers);

    headers.set('Accept', 'application/json');
    headers.set('apikey', this.apiKey);

    if (!this.apiKey.startsWith('sb_secret_')) headers.set('Authorization', `Bearer ${this.apiKey}`);

    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${this.restUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : undefined;

      const message = typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `Supabase-verzoek mislukt met status ${String(response.status)}.`;

      throw new SupabaseRequestError(code, message);
    }

    if (response.status === noContentStatus) return [];

    const body: unknown = await response.json();

    if (!Array.isArray(body)) throw new Error('Supabase gaf geen geldige lijst met rijen terug.');

    const rows: JsonRow[] = [];

    for (const value of body as unknown[]) {
      if (!isJsonRow(value)) {
        throw new Error('Supabase gaf geen geldige lijst met rijen terug.');
      }

      rows.push(value);
    }

    return rows;
  }
}

export function openSupabaseDatabase(): RemoteDatabase {
  const url = process.env['SUPABASE_URL'];
  const apiKey = process.env['SUPABASE_SECRET_KEY'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url?.startsWith('https://')) throw new Error('SUPABASE_URL ontbreekt of is geen geldige HTTPS-URL.');
  if (!apiKey) throw new Error('SUPABASE_SECRET_KEY ontbreekt.');

  return new SupabaseDatabase(url, apiKey);
}
