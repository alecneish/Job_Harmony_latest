import type { CareerProfile, DimensionScore } from '../types';

export const DIMENSION_WEIGHTS: Record<string, number> = {
  OCEAN: 1.0,
  RIASEC: 1.2,
  Values: 0.8,
  Environment: 0.6,
};

const DIMENSIONS = [
  'Openness',
  'Conscientiousness',
  'Extraversion',
  'Agreeableness',
  'EmotionalStability',
  'Realistic',
  'Investigative',
  'Artistic',
  'Social',
  'Enterprising',
  'Conventional',
  'Autonomy',
  'Security',
  'Challenge',
  'Service',
  'WorkLifeBalance',
  'Pace',
  'Collaboration',
  'Structure',
] as const;

type DimensionName = (typeof DIMENSIONS)[number];
export type WeightedVector = Map<string, { value: number; weight: number }>;
export type JobTargetVector = Record<DimensionName, number>;

export function getDimensionCategory(dimension: string): string {
  const ocean = ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'EmotionalStability'];
  const riasec = ['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional'];
  const values = ['Autonomy', 'Security', 'Challenge', 'Service', 'WorkLifeBalance'];
  const environment = ['Pace', 'Collaboration', 'Structure'];
  if (ocean.includes(dimension)) return 'OCEAN';
  if (riasec.includes(dimension)) return 'RIASEC';
  if (values.includes(dimension)) return 'Values';
  if (environment.includes(dimension)) return 'Environment';
  return 'Other';
}

export function buildUserVector(scores: Pick<DimensionScore, 'dimension' | 'normalizedScore'>[]): WeightedVector {
  const vector: WeightedVector = new Map();
  for (const score of scores) {
    const category = getDimensionCategory(score.dimension);
    const weight = DIMENSION_WEIGHTS[category] ?? 0.5;
    vector.set(score.dimension, { value: score.normalizedScore, weight });
  }
  return vector;
}

export function buildCareerVector(career: CareerProfile): WeightedVector {
  const oceanW = DIMENSION_WEIGHTS.OCEAN;
  const riasecW = DIMENSION_WEIGHTS.RIASEC;
  const valW = DIMENSION_WEIGHTS.Values;
  const envW = DIMENSION_WEIGHTS.Environment;
  return new Map([
    ['Openness', { value: career.openness, weight: oceanW }],
    ['Conscientiousness', { value: career.conscientiousness, weight: oceanW }],
    ['Extraversion', { value: career.extraversion, weight: oceanW }],
    ['Agreeableness', { value: career.agreeableness, weight: oceanW }],
    ['EmotionalStability', { value: career.emotionalStability, weight: oceanW }],
    ['Realistic', { value: career.realistic, weight: riasecW }],
    ['Investigative', { value: career.investigative, weight: riasecW }],
    ['Artistic', { value: career.artistic, weight: riasecW }],
    ['Social', { value: career.social, weight: riasecW }],
    ['Enterprising', { value: career.enterprising, weight: riasecW }],
    ['Conventional', { value: career.conventional, weight: riasecW }],
    ['Autonomy', { value: career.autonomy, weight: valW }],
    ['Security', { value: career.security, weight: valW }],
    ['Challenge', { value: career.challenge, weight: valW }],
    ['Service', { value: career.service, weight: valW }],
    ['WorkLifeBalance', { value: career.workLifeBalance, weight: valW }],
    ['Pace', { value: career.pace, weight: envW }],
    ['Collaboration', { value: career.collaboration, weight: envW }],
    ['Structure', { value: career.structure, weight: envW }],
  ]);
}

export function buildJobVector(jobTarget: JobTargetVector): WeightedVector {
  const vector: WeightedVector = new Map();
  for (const dimension of DIMENSIONS) {
    const category = getDimensionCategory(dimension);
    const weight = DIMENSION_WEIGHTS[category] ?? 0.5;
    vector.set(dimension, { value: jobTarget[dimension], weight });
  }
  return vector;
}

export function weightedEuclideanDistance(left: WeightedVector, right: WeightedVector): number {
  let sumSquared = 0;
  let totalWeight = 0;
  for (const [dim, { value: rightVal, weight }] of right) {
    const leftEntry = left.get(dim);
    if (!leftEntry) continue;
    const diff = leftEntry.value - rightVal;
    sumSquared += weight * diff * diff;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.sqrt(sumSquared / totalWeight);
}

export function distanceToMatchPercent(distance: number): number {
  const raw = Math.max(0, (1.0 - distance / 100.0) * 100.0);
  return Math.round(raw * 10) / 10;
}

export function scoreToFitLevel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 70) return 'Good';
  return 'Moderate';
}

export function buildFitReason(user: WeightedVector, target: WeightedVector): string {
  let bestDim = '';
  let bestGap = Number.POSITIVE_INFINITY;
  for (const [dim, { value: targetValue }] of target) {
    const userEntry = user.get(dim);
    if (!userEntry) continue;
    const gap = Math.abs(userEntry.value - targetValue);
    if (gap < bestGap) {
      bestGap = gap;
      bestDim = dim;
    }
  }
  if (!bestDim) {
    return "Your quiz profile is being compared to this role based on personality and work-style dimensions.";
  }
  return `Your profile aligns closely with this role's ${bestDim.toLowerCase()} requirements.`;
}
