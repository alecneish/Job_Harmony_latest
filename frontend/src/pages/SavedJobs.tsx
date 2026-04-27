import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Job, JobsApiResponse } from '../types';
import JobCard from '../components/JobCard';
import { useAuth } from '../context/AuthContext';
import { fetchJobsWithFit, hasSavedQuizResults } from '../lib/jobsService';

const STORAGE_KEY = 'jh-saved-jobs';

function getSavedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

export default function SavedJobs() {
  const { user } = useAuth();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>(getSavedIds());
  const [error, setError] = useState<string | null>(null);
  const [hasQuizResults, setHasQuizResults] = useState(false);
  const [checkingQuizGate, setCheckingQuizGate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const localHasQuiz =
      typeof window !== 'undefined' &&
      Boolean(localStorage.getItem('jh-quiz-raw') || localStorage.getItem('jh-quiz-results'));

    if (localHasQuiz) {
      setHasQuizResults(true);
      setCheckingQuizGate(false);
      return;
    }

    if (!user) {
      setHasQuizResults(false);
      setCheckingQuizGate(false);
      return;
    }

    (async () => {
      try {
        const hasResults = await hasSavedQuizResults(user.id);
        if (cancelled) return;
        setHasQuizResults(hasResults);
      } catch {
        if (!cancelled) setHasQuizResults(false);
      } finally {
        if (!cancelled) setCheckingQuizGate(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const d = (await fetchJobsWithFit(user?.id)) as Partial<JobsApiResponse>;
        if (!cancelled) setAllJobs(d.jobs ?? []);
      } catch (e) {
        if (!cancelled) {
          setAllJobs([]);
          setError(e instanceof Error ? e.message : 'Failed to load jobs');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSaveToggle = useCallback(() => {
    setSavedIds(getSavedIds());
  }, []);

  const savedJobs = allJobs.filter((job) => savedIds.includes(String(job.id)));

  if (checkingQuizGate) {
    return (
      <div className="jh-jobs-container">
        <div className="jh-page-state">
          <p>Checking your quiz progress...</p>
        </div>
      </div>
    );
  }

  if (!hasQuizResults) {
    return (
      <div className="jh-jobs-container">
        <div className="jh-empty-state">
          <h3>Take the quiz first</h3>
          <p>You need quiz results before accessing saved jobs.</p>
          <Link to="/quiz" className="jh-btn-primary">Take the Quiz</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="jh-jobs-container" id="jh-saved-page">
      <div className="jh-section-header jh-section-header--spacious">
        <h2>Saved Jobs</h2>
        <p>Jobs you've bookmarked for later.</p>
      </div>

      {error && (
        <div className="jh-empty-state jh-empty-state--with-margin">
          <h3>Couldn’t load jobs</h3>
          <p>{error}</p>
        </div>
      )}

      <div id="jh-saved-job-list">
        {savedJobs.map((job) => (
          <JobCard key={job.id} job={job} onSaveToggle={handleSaveToggle} />
        ))}
      </div>

      {savedJobs.length === 0 && (
        <div className="jh-empty-state" id="jh-saved-empty">
          <h3>No Saved Jobs Yet</h3>
          <p>Browse job listings and save the ones that interest you.</p>
          <Link to="/jobs" className="jh-btn-primary">Browse Jobs</Link>
        </div>
      )}
    </div>
  );
}
