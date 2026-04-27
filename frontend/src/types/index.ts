export interface QuizQuestion {
  id: number;
  text: string;
  dimension: string;
  subdimension: string;
  section: string;
  sectionOrder: number;
  questionFormat: 'Likert' | 'Interest';
  isReverseScored: boolean;
  weight: number;
  tier: string;
}

export interface QuizResponse {
  questionId: number;
  answerValue: number;
}

export interface DimensionScore {
  dimension: string;
  subdimension: string;
  rawScore: number;
  normalizedScore: number;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  applyUrl?: string;
  fitScore: number;
  fitLevel: string;
  fitReason: string;
  tags: string[];
  postedDaysAgo: number;
  targetOpenness?: number;
  targetConscientiousness?: number;
  targetExtraversion?: number;
  targetAgreeableness?: number;
  targetEmotionalStability?: number;
  targetRealistic?: number;
  targetInvestigative?: number;
  targetArtistic?: number;
  targetSocial?: number;
  targetEnterprising?: number;
  targetConventional?: number;
  targetAutonomy?: number;
  targetSecurity?: number;
  targetChallenge?: number;
  targetService?: number;
  targetWorkLifeBalance?: number;
  targetPace?: number;
  targetCollaboration?: number;
  targetStructure?: number;
}

export interface Applicant {
  id: number;
  name: string;
  initials: string;
  avatarColor: string;
  bio?: string;
  resumeUrl?: string;
  location?: string;
  yearsOfExperience?: number;
  linkedinUrl?: string;
  education?: ApplicantEducationEntry[];
  workExperience?: ApplicantWorkExperienceEntry[];
  resumeFitPercent: number;
  personalityFitPercent: number;
  skills: string[];
  isRecommended: boolean;
  title: string;
}

export interface ApplicantEducationEntry {
  school: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: string;
  endYear?: string;
}

export interface ApplicantWorkExperienceEntry {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface CareerMatch {
  careerProfileId: number;
  title: string;
  matchScore: number;
  rank: number;
}

export interface CareerProfile {
  id: number;
  title: string;
  description: string;
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  emotionalStability: number;
  realistic: number;
  investigative: number;
  artistic: number;
  social: number;
  enterprising: number;
  conventional: number;
  autonomy: number;
  security: number;
  challenge: number;
  service: number;
  workLifeBalance: number;
  pace: number;
  collaboration: number;
  structure: number;
}

export interface QuizResults {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  emotionalStability: number;
  motivationType: string;
  motivationDescription: string;
  careerMatches?: CareerMatch[];
}

export interface SnackbarState {
  message: string;
  visible: boolean;
  undoFn?: () => void;
}

export interface JobsApiResponse {
  jobs: Job[];
  allTags: string[];
  allTypes: string[];
  allLocations: string[];
}

export type UserRole = 'job_seeker' | 'admin';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  verification_status: VerificationStatus;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
