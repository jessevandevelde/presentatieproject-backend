export interface ProfileMatch {
  readonly profileId: number
  readonly profileName: string
  readonly matchPercentage: number | null
  readonly matchedAnswers: number
  readonly comparedAnswers: number
  readonly missingAnswers: number
}

export interface MatchingResult {
  readonly totalAnswers: number
  readonly matches: ProfileMatch[]
}
