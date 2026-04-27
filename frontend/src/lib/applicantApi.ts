import { Applicant, ApplicantEducationEntry, ApplicantWorkExperienceEntry } from '../types';
import { supabase } from './supabaseClient';

export interface ApplicantUpsertPayload {
  id?: number;
  name: string;
  title: string;
  bio: string;
  skills: string[];
  resumeUrl?: string;
  location?: string;
  yearsOfExperience?: number;
  linkedinUrl?: string;
  education?: ApplicantEducationEntry[];
  workExperience?: ApplicantWorkExperienceEntry[];
}
const PROFILE_META_MARKER = '[JH_PROFILE_META]';
const RESUME_BUCKET = (import.meta.env.VITE_SUPABASE_RESUME_BUCKET as string | undefined)?.trim() || 'resumes';
const avatarPalette = ['#E67E22', '#3498DB', '#2ECC71', '#9B59B6', '#E74C3C', '#1ABC9C'];

type ProfileMeta = {
  location?: string;
  yearsOfExperience?: number;
  linkedinUrl?: string;
  education?: ApplicantEducationEntry[];
  workExperience?: ApplicantWorkExperienceEntry[];
};

function splitCsv(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toCsv(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join(',');
}

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function pickAvatarColor(name: string): string {
  const hash = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatarPalette[hash % avatarPalette.length];
}

function extractProfileMeta(rawBio: unknown): { plainBio: string; meta: ProfileMeta } {
  const bio = typeof rawBio === 'string' ? rawBio : '';
  const markerIndex = bio.lastIndexOf(PROFILE_META_MARKER);
  if (markerIndex < 0) return { plainBio: bio.trim(), meta: {} };

  const plainBio = bio.slice(0, markerIndex).trim();
  const jsonPart = bio.slice(markerIndex + PROFILE_META_MARKER.length).trim();
  try {
    const parsed = JSON.parse(jsonPart) as ProfileMeta;
    return {
      plainBio,
      meta: {
        location: typeof parsed.location === 'string' ? parsed.location : undefined,
        yearsOfExperience:
          typeof parsed.yearsOfExperience === 'number' && Number.isFinite(parsed.yearsOfExperience)
            ? parsed.yearsOfExperience
            : undefined,
        linkedinUrl: typeof parsed.linkedinUrl === 'string' ? parsed.linkedinUrl : undefined,
        education: Array.isArray(parsed.education) ? parsed.education : [],
        workExperience: Array.isArray(parsed.workExperience) ? parsed.workExperience : [],
      },
    };
  } catch {
    return { plainBio: bio.trim(), meta: {} };
  }
}

function encodeProfileMeta(plainBio: string, meta: ProfileMeta): string {
  const normalizedMeta: ProfileMeta = {
    location: typeof meta.location === 'string' ? meta.location.trim() : '',
    yearsOfExperience:
      typeof meta.yearsOfExperience === 'number' && Number.isFinite(meta.yearsOfExperience)
        ? Math.max(0, Math.round(meta.yearsOfExperience))
        : undefined,
    linkedinUrl: typeof meta.linkedinUrl === 'string' ? meta.linkedinUrl.trim() : '',
    education: Array.isArray(meta.education) ? meta.education : [],
    workExperience: Array.isArray(meta.workExperience) ? meta.workExperience : [],
  };
  return `${plainBio.trim()}\n\n${PROFILE_META_MARKER}${JSON.stringify(normalizedMeta)}`.trim();
}

function mapApplicant(row: Record<string, unknown>): Applicant {
  const { plainBio, meta } = extractProfileMeta(row.Bio ?? row.description ?? '');
  const rowEducation = Array.isArray(row.Education) ? (row.Education as ApplicantEducationEntry[]) : [];
  const rowWorkExperience = Array.isArray(row.WorkExperience)
    ? (row.WorkExperience as ApplicantWorkExperienceEntry[])
    : [];
  const rowLocation = row.Location ?? row.location;
  const rowYears = row.YearsOfExperience ?? row.years_of_experience;
  const rowLinkedIn = row.LinkedInUrl ?? row.linkedin_url;

  return {
    id: Number(row.Id ?? row.id ?? 0),
    name: String(row.Name ?? row.full_name ?? ''),
    initials: String(row.Initials ?? row.initials ?? ''),
    avatarColor: String(row.AvatarColor ?? row.avatar_color ?? ''),
    bio: plainBio || undefined,
    resumeUrl: typeof row.ResumeUrl === 'string' ? row.ResumeUrl : undefined,
    location: (typeof rowLocation === 'string' ? rowLocation : meta.location) ?? undefined,
    yearsOfExperience:
      (typeof rowYears === 'number' && Number.isFinite(rowYears) ? rowYears : meta.yearsOfExperience) ??
      undefined,
    linkedinUrl: (typeof rowLinkedIn === 'string' ? rowLinkedIn : meta.linkedinUrl) ?? undefined,
    education: rowEducation.length ? rowEducation : meta.education ?? [],
    workExperience: rowWorkExperience.length ? rowWorkExperience : meta.workExperience ?? [],
    resumeFitPercent: Number(row.ResumeFitPercent ?? row.resume_fit_percent ?? 0),
    personalityFitPercent: Number(row.PersonalityFitPercent ?? row.personality_fit_percent ?? 0),
    skills: splitCsv(row.Skills ?? row.skills),
    isRecommended: Boolean(row.IsRecommended ?? row.is_recommended),
    title: String(row.Title ?? row.professional_title ?? ''),
  };
}

export async function getApplicant(id: number): Promise<Applicant | null> {
  const { data, error } = await supabase.from('Applicants').select('*').eq('Id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapApplicant(data as Record<string, unknown>);
}

export async function createApplicant(payload: ApplicantUpsertPayload): Promise<Applicant> {
  return upsertApplicant(payload);
}

export async function updateApplicant(id: number, payload: ApplicantUpsertPayload): Promise<Applicant> {
  return upsertApplicant({ ...payload, id });
}

export async function upsertApplicant(payload: ApplicantUpsertPayload): Promise<Applicant> {
  if (!payload.name.trim() || !payload.title.trim() || !Array.isArray(payload.skills)) {
    throw new Error('name, title, and skills are required');
  }

  const requestedId =
    typeof payload.id === 'number' && Number.isInteger(payload.id) && payload.id > 0 ? payload.id : null;
  const dataPayload = {
    ...(requestedId ? { Id: requestedId } : {}),
    Name: payload.name.trim(),
    Initials: buildInitials(payload.name),
    AvatarColor: pickAvatarColor(payload.name),
    Bio: encodeProfileMeta(payload.bio ?? '', {
      location: payload.location,
      yearsOfExperience: payload.yearsOfExperience,
      linkedinUrl: payload.linkedinUrl,
      education: payload.education ?? [],
      workExperience: payload.workExperience ?? [],
    }),
    ResumeUrl: payload.resumeUrl?.trim() || null,
    ResumeFitPercent: 0,
    PersonalityFitPercent: 0,
    Skills: toCsv(payload.skills),
    IsRecommended: true,
    Title: payload.title.trim(),
  };

  const { data, error } = await supabase
    .from('Applicants')
    .upsert(dataPayload, { onConflict: 'Id' })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to upsert applicant');
  return mapApplicant(data as Record<string, unknown>);
}

export async function uploadResume(id: number, file: File): Promise<Applicant> {
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = `applicants/${id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(filePath, file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage.from(RESUME_BUCKET).getPublicUrl(filePath);
  const resumeUrl = publicData.publicUrl;

  const { data, error } = await supabase
    .from('Applicants')
    .update({ ResumeUrl: resumeUrl })
    .eq('Id', id)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update resume URL');
  return mapApplicant(data as Record<string, unknown>);
}

export async function deleteResume(id: number): Promise<Applicant> {
  const { data, error } = await supabase
    .from('Applicants')
    .update({ ResumeUrl: null })
    .eq('Id', id)
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to remove resume');
  return mapApplicant(data as Record<string, unknown>);
}
