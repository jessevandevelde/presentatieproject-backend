import type { SQLOutputValue } from 'node:sqlite';

export interface StatementResult {
  readonly index: number
  readonly id: SQLOutputValue
  readonly text: SQLOutputValue
  readonly profileAnswers: Record<string, SQLOutputValue>[]
}

export interface CreateStatementInput {
  readonly text: string
  readonly isActive: boolean
}

export interface UpdateStatementInput {
  readonly text?: string
  readonly isActive?: boolean
}

export interface StatementRecord {
  readonly id: number
  readonly text: string
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}
