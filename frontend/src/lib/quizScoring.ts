import type { CareerMatch, CareerProfile, DimensionScore, QuizQuestion, QuizResponse } from '../types';
import {
  buildCareerVector,
  buildUserVector,
  distanceToMatchPercent,
  weightedEuclideanDistance,
} from './fitScoring';

export function computeScores(responses: QuizResponse[], questions: QuizQuestion[]): DimensionScore[] {
  const questionMap = new Map<number, QuizQuestion>(questions.map((q) => [q.id, q]));
  const groups = new Map<string, { question: QuizQuestion; value: number }[]>();

  for (const response of responses) {
    const question = questionMap.get(response.questionId);
    if (!question) continue;
    const key = `${question.dimension}||${question.subdimension}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push({ question, value: response.answerValue });
  }

  const subdimScores: DimensionScore[] = [];
  for (const [key, items] of groups) {
    const [dimension, subdimension] = key.split('||');
    let weightedSum = 0;
    let totalWeight = 0;
    for (const { question, value } of items) {
      const adjusted = question.isReverseScored ? 6 - value : value;
      weightedSum += adjusted * question.weight;
      totalWeight += question.weight;
    }
    const rawAvg = totalWeight > 0 ? weightedSum / totalWeight : 3.0;
    const normalized = ((rawAvg - 1.0) / 4.0) * 100.0;
    subdimScores.push({
      dimension,
      subdimension,
      rawScore: Math.round(rawAvg * 100) / 100,
      normalizedScore: Math.round(normalized * 10) / 10,
    });
  }

  const dimGroups = new Map<string, DimensionScore[]>();
  for (const score of subdimScores) {
    if (!dimGroups.has(score.dimension)) dimGroups.set(score.dimension, []);
    dimGroups.get(score.dimension)?.push(score);
  }

  const dimScores: DimensionScore[] = [];
  for (const [dimension, children] of dimGroups) {
    const avgRaw = children.reduce((sum, child) => sum + child.rawScore, 0) / children.length;
    const avgNorm =
      children.reduce((sum, child) => sum + child.normalizedScore, 0) / children.length;
    dimScores.push({
      dimension,
      subdimension: '',
      rawScore: Math.round(avgRaw * 100) / 100,
      normalizedScore: Math.round(avgNorm * 10) / 10,
    });
  }

  return [...subdimScores, ...dimScores];
}

export function computeMatches(
  dimensionScores: DimensionScore[],
  careers: CareerProfile[],
  topN = 15,
): CareerMatch[] {
  const aggregateScores = dimensionScores.filter((s) => s.subdimension === '');
  if (aggregateScores.length === 0) return [];
  const userVector = buildUserVector(aggregateScores);
  const matches = careers.map((career) => {
    const careerVector = buildCareerVector(career);
    const distance = weightedEuclideanDistance(userVector, careerVector);
    const matchPct = distanceToMatchPercent(distance);
    return {
      careerProfileId: career.id,
      title: career.title,
      matchScore: Math.round(matchPct * 10) / 10,
      rank: 0,
    };
  });

  matches.sort((a, b) => b.matchScore - a.matchScore);
  return matches.slice(0, topN).map((match, index) => ({ ...match, rank: index + 1 }));
}
