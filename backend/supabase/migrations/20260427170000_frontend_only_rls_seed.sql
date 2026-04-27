-- Frontend-only Supabase hardening for JobHarmony.
-- Safe to run repeatedly.

-- Required quiz persistence tables
create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_responses (
  id bigserial primary key,
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_id bigint not null,
  answer_value integer not null check (answer_value between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.dimension_scores (
  id bigserial primary key,
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  dimension text not null,
  subdimension text not null default '',
  raw_score numeric not null,
  normalized_score numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.career_matches (
  id bigserial primary key,
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  career_profile_id bigint not null,
  match_score numeric not null,
  rank integer not null,
  created_at timestamptz not null default now()
);

-- Required legacy columns for frontend profile writes.
alter table if exists public."Applicants" add column if not exists "Location" text;
alter table if exists public."Applicants" add column if not exists "YearsOfExperience" integer;
alter table if exists public."Applicants" add column if not exists "LinkedInUrl" text;
alter table if exists public."Applicants" add column if not exists "Education" jsonb;
alter table if exists public."Applicants" add column if not exists "WorkExperience" jsonb;

-- RLS: frontend calls Supabase directly, so policies must explicitly allow access.
alter table if exists public."QuizQuestions" enable row level security;
alter table if exists public."Jobs" enable row level security;
alter table if exists public."Applicants" enable row level security;
alter table if exists public.quiz_sessions enable row level security;
alter table if exists public.quiz_responses enable row level security;
alter table if exists public.dimension_scores enable row level security;
alter table if exists public.career_matches enable row level security;

-- Public read for question/job catalogs.
drop policy if exists quiz_questions_select_all on public."QuizQuestions";
create policy quiz_questions_select_all
  on public."QuizQuestions"
  for select
  to anon, authenticated
  using (true);

drop policy if exists jobs_select_all on public."Jobs";
create policy jobs_select_all
  on public."Jobs"
  for select
  to anon, authenticated
  using (true);

-- Authenticated profile access (profile editor).
drop policy if exists applicants_select_authenticated on public."Applicants";
create policy applicants_select_authenticated
  on public."Applicants"
  for select
  to authenticated
  using (true);

drop policy if exists applicants_insert_authenticated on public."Applicants";
create policy applicants_insert_authenticated
  on public."Applicants"
  for insert
  to authenticated
  with check (true);

drop policy if exists applicants_update_authenticated on public."Applicants";
create policy applicants_update_authenticated
  on public."Applicants"
  for update
  to authenticated
  using (true)
  with check (true);

-- Anonymous + authenticated quiz persistence.
drop policy if exists quiz_sessions_select_all on public.quiz_sessions;
create policy quiz_sessions_select_all
  on public.quiz_sessions
  for select
  to anon, authenticated
  using (true);

drop policy if exists quiz_sessions_insert_all on public.quiz_sessions;
create policy quiz_sessions_insert_all
  on public.quiz_sessions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists quiz_sessions_delete_all on public.quiz_sessions;
create policy quiz_sessions_delete_all
  on public.quiz_sessions
  for delete
  to anon, authenticated
  using (true);

drop policy if exists quiz_responses_select_all on public.quiz_responses;
create policy quiz_responses_select_all
  on public.quiz_responses
  for select
  to anon, authenticated
  using (true);

drop policy if exists quiz_responses_insert_all on public.quiz_responses;
create policy quiz_responses_insert_all
  on public.quiz_responses
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists dimension_scores_select_all on public.dimension_scores;
create policy dimension_scores_select_all
  on public.dimension_scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists dimension_scores_insert_all on public.dimension_scores;
create policy dimension_scores_insert_all
  on public.dimension_scores
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists career_matches_select_all on public.career_matches;
create policy career_matches_select_all
  on public.career_matches
  for select
  to anon, authenticated
  using (true);

drop policy if exists career_matches_insert_all on public.career_matches;
create policy career_matches_insert_all
  on public.career_matches
  for insert
  to anon, authenticated
  with check (true);
