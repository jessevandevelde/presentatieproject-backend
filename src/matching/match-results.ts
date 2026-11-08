import type { Answer } from '../types/answer.interface';
import type { MatchingResult, ProfileMatch } from '../types/matching.interface';
import type { ReferenceProfile } from './reference-data';

const percentageScale = 100;
const roundingScale = 100;

export function matchResults(answers: ReadonlyMap<number, Answer>, profiles: readonly ReferenceProfile[]): MatchingResult {
  const matches = profiles.map(({ profileId, profileName, answers: profileAnswers }): ProfileMatch => {
    let matchedAnswers = 0;
    let comparedAnswers = 0;

    for (const referenceAnswer of profileAnswers) {
      const userAnswer = answers.get(referenceAnswer.statementId);

      if (userAnswer !== undefined) {
        comparedAnswers += 1;

        if (userAnswer === referenceAnswer.answer) {
          matchedAnswers += 1;
        }
      }
    }

    return {
      profileId,
      profileName,
      matchPercentage: comparedAnswers === 0 ? null : Math.round(matchedAnswers / comparedAnswers * percentageScale * roundingScale) / roundingScale,
      matchedAnswers,
      comparedAnswers,
      missingAnswers: answers.size - comparedAnswers,
    };
  });

  matches.sort((left, right) => (right.matchPercentage ?? -1) - (left.matchPercentage ?? -1)
    || right.comparedAnswers - left.comparedAnswers
    || left.profileId - right.profileId);

  return { totalAnswers: answers.size, matches };
}
