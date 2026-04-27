import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Job, JobsApiResponse } from '../types';
import JobCard from '../components/JobCard';
import FilterPanel from '../components/FilterPanel';
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

export default function Jobs() {
  const { user } = useAuth();
  const [data, setData] = useState<JobsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasQuizResults, setHasQuizResults] = useState(false);
  const [checkingQuizGate, setCheckingQuizGate] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const [view, setView] = useState<'all' | 'saved'>('all');
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedIds());

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
        const d = (await fetchJobsWithFit(user?.id)) as JobsApiResponse;
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) {
          setData({ jobs: [], allTags: [], allTypes: [], allLocations: [] });
          setError(e instanceof Error ? e.message : 'Failed to load jobs');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Re-render job cards when save state changes
  const handleSaveToggle = useCallback(() => {
    setRenderKey((k) => k + 1);
    setSavedIds(getSavedIds());
  }, []);

  const filteredJobs: Job[] = (data?.jobs ?? []).filter((job) => {
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      job.title.toLowerCase().includes(s) ||
      job.company.toLowerCase().includes(s) ||
      job.tags.some((t) => t.toLowerCase().includes(s));

    const matchType = selectedTypes.length === 0 || selectedTypes.includes(job.type);
    const matchLocation = selectedLocations.length === 0 || selectedLocations.includes(job.location);
    const matchTags =
      selectedTags.length === 0 || selectedTags.some((tag) => job.tags.includes(tag));

    return matchSearch && matchType && matchLocation && matchTags;
  });

  const savedJobs = useMemo(() => {
    return (data?.jobs ?? []).filter((job) => savedIds.includes(String(job.id)));
  }, [data, savedIds]);

  const jobsToRender = view === 'saved' ? savedJobs : filteredJobs;

  function clearFilters() {
    setSelectedTypes([]);
    setSelectedLocations([]);
    setSelectedTags([]);
    setSearch('');
  }

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
          <p>You need quiz results before browsing jobs so we can rank matches for you.</p>
          <Link to="/quiz" className="jh-btn-primary">Take the Quiz</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="jh-jobs-container">
      <div className="jh-section-header jh-section-header--spacious">
        <h2>{view === 'saved' ? 'Saved Jobs' : 'Job Listings'}</h2>
        <p>
          {view === 'saved'
            ? "Jobs you've bookmarked for later."
            : 'Jobs ranked by how well they match your personality profile.'}
        </p>
      </div>

      {error && (
        <div className="jh-empty-state jh-empty-state--with-margin">
          <h3>Couldn’t load jobs</h3>
          <p>{error}</p>
        </div>
      )}

      <div className="jh-jobs-view-toggle">
        <button
          type="button"
          className={view === 'all' ? 'jh-btn-primary' : 'jh-btn-secondary'}
          onClick={() => setView('all')}
        >
          All Jobs
        </button>
        <button
          type="button"
          className={view === 'saved' ? 'jh-btn-primary' : 'jh-btn-secondary'}
          onClick={() => setView('saved')}
        >
          Saved Jobs ({savedJobs.length})
        </button>
      </div>

      <div className="jh-search-bar">
        <input
          type="text"
          className="jh-search-input"
          id="jh-search"
          placeholder="Search jobs by title, company, or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {view === 'all' && (
          <button className="jh-btn-secondary" onClick={() => setFilterOpen(true)}>
            Filters
          </button>
        )}
      </div>

      <div id="jh-job-list" key={renderKey}>
        {jobsToRender.map((job) => (
          <JobCard key={job.id} job={job} onSaveToggle={handleSaveToggle} />
        ))}
      </div>

      {jobsToRender.length === 0 && data !== null && view === 'all' && (
        <div className="jh-no-results show">
          <h3>No jobs match your filters</h3>
          <p>Try adjusting your search or clearing filters.</p>
        </div>
      )}

      {jobsToRender.length === 0 && data !== null && view === 'saved' && (
        <div className="jh-empty-state jh-empty-state--with-top-margin">
          <h3>No Saved Jobs Yet</h3>
          <p>Save a few jobs from the All Jobs view to see them here.</p>
        </div>
      )}

      <FilterPanel
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => setFilterOpen(false)}
        onClear={clearFilters}
        allTypes={data?.allTypes ?? []}
        allLocations={data?.allLocations ?? []}
        allTags={data?.allTags ?? []}
        selectedTypes={selectedTypes}
        selectedLocations={selectedLocations}
        selectedTags={selectedTags}
        onTypeChange={(type, checked) =>
          setSelectedTypes((prev) =>
            checked ? [...prev, type] : prev.filter((t) => t !== type),
          )
        }
        onLocationChange={(loc, checked) =>
          setSelectedLocations((prev) =>
            checked ? [...prev, loc] : prev.filter((l) => l !== loc),
          )
        }
        onTagChange={(tag, checked) =>
          setSelectedTags((prev) =>
            checked ? [...prev, tag] : prev.filter((t) => t !== tag),
          )
        }
      />
    </div>
  );
}
