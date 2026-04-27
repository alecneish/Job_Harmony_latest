import type { CareerMatch, QuizResults } from '../types';

const OCEAN_DIMENSIONS = ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'EmotionalStability'] as const;

const MOTIVATION_TYPES: Record<string, { type: string; description: string }> = {
  Openness: {
    type: 'The Innovator',
    description: "You thrive on creativity and new ideas. You're driven by curiosity and love exploring uncharted territory.",
  },
  Conscientiousness: {
    type: 'The Achiever',
    description: "You're goal-oriented and detail-driven. You find satisfaction in completing tasks with precision and excellence.",
  },
  Extraversion: {
    type: 'The Connector',
    description: "You're energized by people and thrive in collaborative environments. Building relationships is your superpower.",
  },
  Agreeableness: {
    type: 'The Harmonizer',
    description: "You're empathetic and cooperative. You excel at creating supportive environments where everyone can succeed.",
  },
  EmotionalStability: {
    type: 'The Anchor',
    description: "You're calm under pressure and bring stability to any team. Your resilience and composure inspire confidence.",
  },
};

export interface QuizDimensionScore {
  dimension: string;
  subdimension: string;
  rawScore: number;
  normalizedScore: number;
}

function buildOceanScores(dimensionScores: QuizDimensionScore[]): Record<string, number> {
  const totals: Record<string, number[]> = {};
  for (const dim of OCEAN_DIMENSIONS) totals[dim] = [];

  for (const ds of dimensionScores) {
    if (ds.dimension in totals) totals[ds.dimension].push(ds.normalizedScore);
  }

  const result: Record<string, number> = {};
  for (const dim of OCEAN_DIMENSIONS) {
    const scores = totals[dim];
    result[dim] = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 50;
  }
  return result;
}

/** Writes `jh-quiz-results` and `jh-quiz-raw` — same shape as Supabase-backed quiz submit. */
export function persistQuizResultsLocal(
  sessionId: string | null,
  dimensionScores: QuizDimensionScore[],
  careerMatches: CareerMatch[],
): void {
  const oceanScores = buildOceanScores(dimensionScores);
  const dominantTrait = Object.keys(oceanScores).reduce((a, b) =>
    oceanScores[b] > oceanScores[a] ? b : a
  );
  const motivation = MOTIVATION_TYPES[dominantTrait] ?? MOTIVATION_TYPES.Openness;

  const quizResults: QuizResults = {
    openness: oceanScores.Openness,
    conscientiousness: oceanScores.Conscientiousness,
    extraversion: oceanScores.Extraversion,
    agreeableness: oceanScores.Agreeableness,
    emotionalStability: oceanScores.EmotionalStability,
    motivationType: motivation.type,
    motivationDescription: motivation.description,
    careerMatches,
  };

  localStorage.setItem('jh-quiz-results', JSON.stringify(quizResults));
  localStorage.setItem('jh-quiz-raw', JSON.stringify({
    sessionId,
    dimensionScores,
    careerMatches,
  }));
}
