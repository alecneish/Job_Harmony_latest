import { supabase } from './supabaseClient';
import type { CareerProfile, DimensionScore, Job, JobsApiResponse } from '../types';
import {
  buildFitReason,
  buildJobVector,
  buildUserVector,
  distanceToMatchPercent,
  scoreToFitLevel,
  weightedEuclideanDistance,
  type JobTargetVector,
} from './fitScoring';

function splitCsv(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function mapJobRow(row: Record<string, unknown>): Job {
  return {
    id: Number(row.Id),
    title: String(row.Title ?? ''),
    company: String(row.Company ?? ''),
    location: String(row.Location ?? ''),
    salary: String(row.Salary ?? ''),
    type: String(row.Type ?? ''),
    applyUrl: typeof row.ApplyUrl === 'string' ? row.ApplyUrl : undefined,
    fitScore: toNumber(row.FitScore) ?? 0,
    fitLevel: String(row.FitLevel ?? 'Moderate'),
    fitReason: String(row.FitReason ?? ''),
    tags: splitCsv(row.Tags),
    postedDaysAgo: toNumber(row.PostedDaysAgo) ?? 0,
    targetOpenness: toNumber(row.TargetOpenness),
    targetConscientiousness: toNumber(row.TargetConscientiousness),
    targetExtraversion: toNumber(row.TargetExtraversion),
    targetAgreeableness: toNumber(row.TargetAgreeableness),
    targetEmotionalStability: toNumber(row.TargetEmotionalStability),
    targetRealistic: toNumber(row.TargetRealistic),
    targetInvestigative: toNumber(row.TargetInvestigative),
    targetArtistic: toNumber(row.TargetArtistic),
    targetSocial: toNumber(row.TargetSocial),
    targetEnterprising: toNumber(row.TargetEnterprising),
    targetConventional: toNumber(row.TargetConventional),
    targetAutonomy: toNumber(row.TargetAutonomy),
    targetSecurity: toNumber(row.TargetSecurity),
    targetChallenge: toNumber(row.TargetChallenge),
    targetService: toNumber(row.TargetService),
    targetWorkLifeBalance: toNumber(row.TargetWorkLifeBalance),
    targetPace: toNumber(row.TargetPace),
    targetCollaboration: toNumber(row.TargetCollaboration),
    targetStructure: toNumber(row.TargetStructure),
  };
}

function buildTargetVector(job: Job): JobTargetVector | null {
  const vector = {
    Openness: toNumber(job.targetOpenness),
    Conscientiousness: toNumber(job.targetConscientiousness),
    Extraversion: toNumber(job.targetExtraversion),
    Agreeableness: toNumber(job.targetAgreeableness),
    EmotionalStability: toNumber(job.targetEmotionalStability),
    Realistic: toNumber(job.targetRealistic),
    Investigative: toNumber(job.targetInvestigative),
    Artistic: toNumber(job.targetArtistic),
    Social: toNumber(job.targetSocial),
    Enterprising: toNumber(job.targetEnterprising),
    Conventional: toNumber(job.targetConventional),
    Autonomy: toNumber(job.targetAutonomy),
    Security: toNumber(job.targetSecurity),
    Challenge: toNumber(job.targetChallenge),
    Service: toNumber(job.targetService),
    WorkLifeBalance: toNumber(job.targetWorkLifeBalance),
    Pace: toNumber(job.targetPace),
    Collaboration: toNumber(job.targetCollaboration),
    Structure: toNumber(job.targetStructure),
  };
  const hasMissing = Object.values(vector).some((value) => typeof value !== 'number');
  if (hasMissing) return null;
  return vector as JobTargetVector;
}

export async function fetchJobsWithFit(userId?: string): Promise<JobsApiResponse> {
  const { data, error } = await supabase.from('Jobs').select('*').order('Id', { ascending: true });
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to load jobs from Supabase');
  }

  let jobs = (data as Record<string, unknown>[]).map(mapJobRow);

  if (userId) {
    const { data: session } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session?.id) {
      const { data: scoreRows } = await supabase
        .from('dimension_scores')
        .select('dimension, normalized_score, subdimension')
        .eq('session_id', session.id)
        .eq('subdimension', '');

      if (scoreRows && scoreRows.length > 0) {
        const userVector = buildUserVector(
          scoreRows.map((row) => ({
            dimension: String(row.dimension),
            normalizedScore: Number(row.normalized_score),
          })),
        );

        jobs = jobs
          .map((job) => {
            const target = buildTargetVector(job);
            if (!target) return job;
            const jobVector = buildJobVector(target);
            const fitScore = distanceToMatchPercent(weightedEuclideanDistance(userVector, jobVector));
            return {
              ...job,
              fitScore: Math.round(fitScore * 10) / 10,
              fitLevel: scoreToFitLevel(fitScore),
              fitReason: buildFitReason(userVector, jobVector),
            };
          })
          .sort((a, b) => b.fitScore - a.fitScore);
      }
    }
  }

  const allTags = [...new Set(jobs.flatMap((job) => job.tags))];
  const allTypes = [...new Set(jobs.map((job) => job.type))];
  const allLocations = [...new Set(jobs.map((job) => job.location))];

  return { jobs, allTags, allTypes, allLocations };
}

export async function fetchCareerProfilesFromJobs(): Promise<CareerProfile[]> {
  const { data, error } = await supabase.from('Jobs').select('*').order('Id', { ascending: true });
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to load jobs for career matching');
  }

  return (data as Record<string, unknown>[])
    .map(mapJobRow)
    .map((job) => {
      const target = buildTargetVector(job);
      if (!target) return null;
      return {
        id: job.id,
        title: job.title,
        description: `${job.title} at ${job.company}`,
        openness: target.Openness,
        conscientiousness: target.Conscientiousness,
        extraversion: target.Extraversion,
        agreeableness: target.Agreeableness,
        emotionalStability: target.EmotionalStability,
        realistic: target.Realistic,
        investigative: target.Investigative,
        artistic: target.Artistic,
        social: target.Social,
        enterprising: target.Enterprising,
        conventional: target.Conventional,
        autonomy: target.Autonomy,
        security: target.Security,
        challenge: target.Challenge,
        service: target.Service,
        workLifeBalance: target.WorkLifeBalance,
        pace: target.Pace,
        collaboration: target.Collaboration,
        structure: target.Structure,
      } as CareerProfile;
    })
    .filter((career): career is CareerProfile => Boolean(career));
}

export async function hasSavedQuizResults(userId?: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return !error && Boolean(data?.id);
}

export function getTopAggregateScores(scores: DimensionScore[]): DimensionScore[] {
  return [...scores]
    .filter((score) => score.subdimension === '')
    .sort((a, b) => b.normalizedScore - a.normalizedScore);
}
