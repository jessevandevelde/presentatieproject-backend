import type { Answer } from './answer.interface';

export interface ProfileAnswer {
  readonly answer: Answer | null
  readonly profileId: number
  readonly profileName: string
}

export interface StatementResult {
  readonly index: number
  readonly id: number
  readonly text: string
  readonly profileAnswers: readonly ProfileAnswer[]
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
