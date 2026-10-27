import type { DatabaseSync } from 'node:sqlite';
import type { Answer } from '../types/answer.interface';
import type { CreatePartyInput, Party, UpdatePartyInput } from '../types/party.interface';
import type { CreateStatementInput, StatementRecord, StatementResult, UpdateStatementInput } from '../types/statement.interface';
import type { VisualizationPoint } from '../types/visualization.interface';

export interface ProfileReferenceAnswer {
  readonly answer: Answer
  readonly profileId: number
  readonly profileName: string
  readonly statementId: number
}

export interface RemoteDatabase {
  readonly kind: 'supabase'
  close: () => void
  createParty: (input: CreatePartyInput) => Promise<Party>
  createStatement: (input: CreateStatementInput) => Promise<StatementRecord>
  deleteParty: (id: number) => Promise<boolean>
  deleteStatement: (id: number) => Promise<boolean>
  getActiveStatementIds: () => Promise<readonly number[]>
  getPartyById: (id: number) => Promise<Party | undefined>
  getProfileReferenceAnswers: () => Promise<readonly ProfileReferenceAnswer[]>
  getStatement: (index: number) => Promise<StatementResult | undefined>
  getStatementById: (id: number) => Promise<StatementRecord | undefined>
  listParties: () => Promise<readonly Party[]>
  listStatements: () => Promise<readonly StatementRecord[]>
  listVisualizationPoints: () => Promise<readonly VisualizationPoint[]>
  saveVisualizationPoint: (point: VisualizationPoint) => Promise<VisualizationPoint | undefined>
  updateParty: (id: number, input: UpdatePartyInput) => Promise<boolean>
  updateStatement: (id: number, input: UpdateStatementInput) => Promise<boolean>
}

export type AppDatabase = DatabaseSync | RemoteDatabase;

export function isRemoteDatabase(database: AppDatabase): database is RemoteDatabase {
  return 'kind' in database;
}
