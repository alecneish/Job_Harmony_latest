import { QUIZ_SEED_QUESTIONS } from '../data/quizSeed';
import { supabase } from './supabaseClient';
import type { CareerMatch, DimensionScore, QuizQuestion, QuizResponse } from '../types';
import { computeMatches, computeScores } from './quizScoring';
import { fetchCareerProfilesFromJobs } from './jobsService';

export type QuizTier = 'short' | 'medium' | 'full';

const SEED_BY_ID = new Map(QUIZ_SEED_QUESTIONS.map((question) => [question.id, question]));

function mapDbQuestionRow(row: Record<string, unknown>): QuizQuestion {
  const id = Number(row.Id);
  const seedQuestion = SEED_BY_ID.get(id);
  return {
    id,
    text: seedQuestion?.text ?? String(row.QuestionText ?? ''),
    dimension: seedQuestion?.dimension ?? String(row.Dimension ?? ''),
    subdimension: seedQuestion?.subdimension ?? String(row.Subdimension ?? ''),
    section: seedQuestion?.section ?? String(row.Section ?? ''),
    sectionOrder: seedQuestion?.sectionOrder ?? Number(row.SectionOrder ?? 0),
    questionFormat: seedQuestion?.questionFormat ?? (String(row.QuestionFormat ?? 'Likert') as 'Likert' | 'Interest'),
    isReverseScored: seedQuestion?.isReverseScored ?? Boolean(row.IsReverseScored),
    weight: seedQuestion?.weight ?? Number(row.Weight ?? 1),
    tier: seedQuestion?.tier ?? String(row.Tier ?? 'Free'),
  };
}

function filterQuestionsByTier(allQuestions: QuizQuestion[], tier: QuizTier): QuizQuestion[] {
  if (tier === 'medium') {
    return allQuestions.filter((question) => question.tier === 'Free');
  }
  if (tier === 'short') {
    return allQuestions.filter((question) => question.tier === 'Free').slice(0, 10);
  }
  return allQuestions.slice(0, 62);
}

export async function fetchQuizQuestions(tier: QuizTier): Promise<QuizQuestion[]> {
  const { data, error } = await supabase.from('QuizQuestions').select('*').order('Id', { ascending: true });
  if (error || !data) {
    return filterQuestionsByTier(QUIZ_SEED_QUESTIONS, tier);
  }

  const questions = (data as Record<string, unknown>[]).map(mapDbQuestionRow);
  return filterQuestionsByTier(questions, tier);
}

export interface QuizSubmissionResult {
  success: boolean;
  persisted: boolean;
  message?: string;
  sessionId: string | null;
  dimensionScores: DimensionScore[];
  careerMatches: CareerMatch[];
}

export async function submitQuizResponses(
  responses: QuizResponse[],
  questions: QuizQuestion[],
  userId?: string,
): Promise<QuizSubmissionResult> {
  if (!responses.length) {
    throw new Error('responses must be a non-empty array');
  }

  const dimensionScores = computeScores(responses, questions);
  const careers = await fetchCareerProfilesFromJobs().catch(() => []);
  const careerMatches = computeMatches(dimensionScores, careers);

  try {
    if (userId) {
      const { error: deleteError } = await supabase.from('quiz_sessions').delete().eq('user_id', userId);
      if (deleteError) throw deleteError;
    }

    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert({ user_id: userId ?? null })
      .select('id')
      .single();

    if (sessionError || !session?.id) {
      throw sessionError ?? new Error('Failed to create session');
    }

    const sessionId = String(session.id);

    const [responsesInsert, scoresInsert, matchesInsert] = await Promise.all([
      supabase.from('quiz_responses').insert(
        responses.map((response) => ({
          session_id: sessionId,
          question_id: response.questionId,
          answer_value: response.answerValue,
        })),
      ),
      supabase.from('dimension_scores').insert(
        dimensionScores.map((score) => ({
          session_id: sessionId,
          dimension: score.dimension,
          subdimension: score.subdimension,
          raw_score: score.rawScore,
          normalized_score: score.normalizedScore,
        })),
      ),
      careerMatches.length > 0
        ? supabase.from('career_matches').insert(
            careerMatches.map((match) => ({
              session_id: sessionId,
              career_profile_id: match.careerProfileId,
              match_score: match.matchScore,
              rank: match.rank,
            })),
          )
        : Promise.resolve({ error: null }),
    ]);

    if (responsesInsert.error) throw responsesInsert.error;
    if (scoresInsert.error) throw scoresInsert.error;
    if (matchesInsert.error) throw matchesInsert.error;

    return {
      success: true,
      persisted: true,
      sessionId,
      dimensionScores,
      careerMatches,
    };
  } catch {
    return {
      success: false,
      persisted: false,
      message: userId ? 'Could not save your quiz results. Please try again.' : 'Could not save your quiz session.',
      sessionId: null,
      dimensionScores,
      careerMatches,
    };
  }
}

export async function buildCareerMatchesFromScores(
  dimensionScores: DimensionScore[],
): Promise<CareerMatch[]> {
  const careers = await fetchCareerProfilesFromJobs();
  return computeMatches(dimensionScores, careers);
}

export async function fetchLastQuizResults(userId?: string): Promise<{
  sessionId: string | null;
  dimensionScores: DimensionScore[];
  careerMatches: CareerMatch[];
} | null> {
  if (!userId) return null;

  const { data: session, error: sessionError } = await supabase
    .from('quiz_sessions')
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError || !session?.id) return null;

  const { data: scores, error: scoresError } = await supabase
    .from('dimension_scores')
    .select('dimension, subdimension, raw_score, normalized_score')
    .eq('session_id', session.id);

  if (scoresError || !scores) return null;

  const dimensionScores: DimensionScore[] = scores.map((row) => ({
    dimension: String(row.dimension),
    subdimension: String(row.subdimension ?? ''),
    rawScore: Number(row.raw_score),
    normalizedScore: Number(row.normalized_score),
  }));

  const careers = await fetchCareerProfilesFromJobs().catch(() => []);
  const careerMatches = computeMatches(dimensionScores, careers);

  return {
    sessionId: String(session.id),
    dimensionScores,
    careerMatches,
  };
}
