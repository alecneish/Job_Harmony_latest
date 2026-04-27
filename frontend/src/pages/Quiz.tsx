import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QuizQuestion } from '../types';
import { showSnackbar } from '../components/Snackbar';
import { useAuth } from '../context/AuthContext';
import { persistQuizResultsLocal, type QuizDimensionScore } from '../lib/quizLocalStorage';
import { fetchLastQuizResults, fetchQuizQuestions, submitQuizResponses, type QuizTier } from '../lib/quizService';

const QUESTIONS_PER_PAGE = 10;

const TIER_CONFIG: Record<QuizTier, { name: string; questions: number; minutes: number; description: string }> = {
  short: {
    name: 'Quick Pulse',
    questions: 10,
    minutes: 3,
    description: 'A quick 10-question check-in for fast, focused insights.',
  },
  medium: {
    name: 'Career Snapshot',
    questions: 30,
    minutes: 5,
    description: 'A balanced view of your personality, interests, values, and work style.',
  },
  full: {
    name: 'Full Profile',
    questions: 62,
    minutes: 10,
    description: 'The complete assessment for the most detailed and accurate career matches.',
  },
};

const LIKERT_OPTIONS = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly Agree' },
];

const SCALE_LEGEND: { label: string; description: string }[] = [
  { label: 'Strongly Agree', description: 'This describes me very well.' },
  { label: 'Agree', description: 'This somewhat describes me.' },
  { label: 'Neutral', description: "I'm not sure, or this doesn't apply." },
  { label: 'Disagree', description: "This doesn't really describe me." },
  { label: 'Strongly Disagree', description: 'This does not describe me at all.' },
];

export default function Quiz() {
  const [tier, setTier] = useState<QuizTier | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [hasLastResults, setHasLastResults] = useState(false);
  const navigate = useNavigate();
  const { user, session } = useAuth();

  useEffect(() => {
    if (!tier) return;
    setLoading(true);
    fetchQuizQuestions(tier)
      .then((data: QuizQuestion[]) => {
        setQuestions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tier]);

  function startTier(selected: QuizTier) {
    setAnswers({});
    setCurrentPage(0);
    setQuestions([]);
    setTier(selected);
  }

  useEffect(() => {
    let cancelled = false;

    async function detectLastResults() {
      if (user && session?.access_token) {
        try {
          const r = await fetchLastQuizResults(user.id);
          if (cancelled) return;
          setHasLastResults(Boolean(r));
          return;
        } catch {
          // Fall through to local check
        }
      }

      try {
        const stored =
          localStorage.getItem('jh-quiz-results') || localStorage.getItem('jh-quiz-raw');
        if (!cancelled) setHasLastResults(Boolean(stored));
      } catch {
        if (!cancelled) setHasLastResults(false);
      }
    }

    detectLastResults();
    return () => {
      cancelled = true;
    };
  }, [user, session?.access_token]);

  const total = questions.length;
  const totalPages = Math.ceil(total / QUESTIONS_PER_PAGE);
  const pageQuestions = questions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE,
  );
  const pageComplete = pageQuestions.length > 0 && pageQuestions.every((q) => answers[q.id] !== undefined);
  const progress = totalPages > 0 ? Math.round(((currentPage + 1) / totalPages) * 100) : 0;
  const isLastPage = currentPage >= totalPages - 1;

  function selectOption(questionId: number, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  function next() {
    if (!pageComplete) return;
    if (isLastPage) {
      submitQuiz();
      return;
    }
    setCurrentPage((p) => p + 1);
  }

  function back() {
    if (currentPage <= 0) return;
    setCurrentPage((p) => p - 1);
  }

  async function submitQuiz() {
    if (submitting) return;
    setSubmitting(true);

    const responses = questions.map((question) => ({
      questionId: question.id,
      answerValue: answers[question.id] ?? 3,
    }));

    try {
      const data = (await submitQuizResponses(
        responses,
        questions,
        user?.id,
      )) as {
        success: boolean;
        persisted?: boolean;
        message?: string;
        sessionId?: string | null;
        dimensionScores: QuizDimensionScore[];
        careerMatches: { careerProfileId: number; title: string; matchScore: number; rank: number }[];
      };

      persistQuizResultsLocal(
        data.sessionId ?? null,
        data.dimensionScores ?? [],
        data.careerMatches ?? [],
      );

      const saved = data.persisted ?? data.success;

      if (user) {
        if (saved) {
          showSnackbar('Your results have been saved!');
        } else {
          showSnackbar(data.message ?? 'Could not save your results. Please try again.');
        }
        setSubmitting(false);
        navigate('/quiz/results');
      } else {
        setSubmitting(false);
        setShowSavePrompt(true);
      }
    } catch {
      showSnackbar('Could not submit quiz right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Tier selection landing screen ---
  if (!tier) {
    return (
      <div className="jh-quiz-container">
        <div className="jh-section-header jh-section-header--hero">
          <h2>Career Personality Quiz</h2>
          <p>Choose how much time you have. All versions use the same scoring engine.</p>
        </div>
        <div className="jh-tier-grid">
          {(Object.entries(TIER_CONFIG) as [QuizTier, typeof TIER_CONFIG[QuizTier]][]).map(([key, config]) => (
            <button
              key={key}
              className="jh-tier-card"
              onClick={() => startTier(key)}
            >
              <div className="jh-tier-card-meta">
                <span className="jh-tier-card-questions">{config.questions} questions</span>
                <span className="jh-tier-card-time">~{config.minutes} min</span>
              </div>
              <h3>{config.name}</h3>
              <p>{config.description}</p>
              <span className="jh-tier-card-cta">Start</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="jh-quiz-container jh-page-state">
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="jh-quiz-container jh-page-state">
        <p>Failed to load quiz questions. Please try again.</p>
        <button className="jh-btn-secondary jh-mt-md" onClick={() => setTier(null)}>
          Back
        </button>
      </div>
    );
  }

  // --- Quiz ---
  return (
    <div className="jh-quiz-container">
      {hasLastResults && (
        <div className="jh-results-shortcut">
          <Link to="/quiz/results" className="jh-btn-secondary">
            View my last results
          </Link>
        </div>
      )}

      <div className="jh-section-header jh-section-header--spacious">
        <h2>{TIER_CONFIG[tier].name}</h2>
        <p>Answer each question honestly - there are no right or wrong answers.</p>
      </div>

      <div className="jh-quiz-scale-legend" aria-label="Rating scale explanation">
        <h3>How to answer</h3>
        <ul>
          {SCALE_LEGEND.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span> - {item.description}
            </li>
          ))}
        </ul>
      </div>

      {showSavePrompt && (
        <div role="dialog" aria-modal="true" className="jh-modal-backdrop">
          <div className="jh-modal-card">
            <h3 className="jh-modal-title">Save your results</h3>
            <p className="jh-muted-copy">
              Your results are ready. To save them to your profile and access them on any device, please log in or sign up.
            </p>
            <div className="jh-inline-actions jh-inline-actions--end">
              <button className="jh-btn-secondary" onClick={() => navigate('/quiz/results')}>
                Continue to results
              </button>
              <button className="jh-btn-secondary" onClick={() => navigate('/login')}>
                Log in
              </button>
              <button className="jh-btn-primary" onClick={() => navigate('/signup')}>
                Sign up
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="jh-quiz-progress">
        <div className="jh-quiz-progress-bar">
          <div
            className="jh-quiz-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="jh-quiz-progress-text">
          <span>Page {currentPage + 1} of {totalPages}</span>
          <span>{progress}%</span>
        </div>
      </div>

      <div className="jh-quiz-page">
        {pageQuestions.map((q, idx) => {
          const options = LIKERT_OPTIONS;
          const selectedAnswer = answers[q.id];
          const globalIndex = currentPage * QUESTIONS_PER_PAGE + idx + 1;

          return (
            <div key={q.id} className="jh-quiz-card jh-quiz-card--paged">
              <p className="jh-quiz-card-number">Question {globalIndex} of {total}</p>
              <h3>{q.text}</h3>
              <div className="jh-quiz-options-row">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    className={`jh-quiz-option jh-quiz-option--compact${selectedAnswer === opt.value ? ' selected' : ''}`}
                    onClick={() => selectOption(q.id, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!pageComplete && (
        <p className="jh-quiz-page-hint">Answer all questions on this page to continue.</p>
      )}

      <div className="jh-quiz-nav">
        <button
          className="jh-btn-secondary"
          onClick={currentPage > 0 ? back : () => setTier(null)}
        >
          Back
        </button>
        <button
          className="jh-btn-primary"
          disabled={!pageComplete || submitting}
          onClick={next}
        >
          {submitting ? 'Submitting...' : isLastPage ? 'See Results' : 'Next'}
        </button>
      </div>
    </div>
  );
}
