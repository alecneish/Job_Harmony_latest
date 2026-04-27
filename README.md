# JobHarmony

Candidate-first career matching app powered by **React + Supabase** (no backend server required).

## Stack

- Frontend: React, TypeScript, Vite, React Router
- Data/Auth/Storage: Supabase (`@supabase/supabase-js`)
- Resume autofill: `pdfjs-dist` + OpenAI (`gpt-4o`)

## Environment

Create `frontend/.env`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
# Optional alias (either key variable is accepted):
VITE_SUPABASE_ANON_KEY=...
# Resume parser:
VITE_OPENAI_API_KEY=...
# Optional resume bucket name (defaults to "resumes"):
VITE_SUPABASE_RESUME_BUCKET=resumes
```

## Run Locally

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

Open `http://localhost:5173`.

## Supabase Setup (Required)

Run the SQL migration in:

- `supabase/migrations/20260427170000_frontend_only_rls_seed.sql`

This migration:

- Ensures required legacy quiz tables/columns exist
- Enables RLS and adds policies for frontend direct access
- Allows anonymous quiz persistence writes (`quiz_sessions`, `quiz_responses`, `dimension_scores`, `career_matches`)
- Enables authenticated access for applicant profile CRUD

## Frontend-Only Data Flow

- Quiz questions load directly from `QuizQuestions` (with frontend seed fallback)
- Quiz submit writes directly to `quiz_sessions`, `quiz_responses`, `dimension_scores`, `career_matches`
- Jobs load directly from `Jobs`, then fit-scored client-side
- Profiles are upserted directly to `Applicants`
- Resume files upload directly to Supabase Storage
