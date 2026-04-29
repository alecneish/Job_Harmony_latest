import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { CareerMatch } from '../types';
import { persistQuizResultsLocal } from '../lib/quizLocalStorage';
import { buildCareerMatchesFromScores, fetchLastQuizResults } from '../lib/quizService';

interface DimensionScore {
  dimension: string;
  subdimension: string;
  rawScore: number;
  normalizedScore: number;
}

interface RawResults {
  sessionId: string | null;
  dimensionScores: DimensionScore[];
  careerMatches: CareerMatch[];
}

export default function QuizResults() {
  const { user } = useAuth();
  const [results, setResults] = useState<RawResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairingMatches, setRepairingMatches] = useState(false);
  const [animated, setAnimated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  function scheduleAnimate() {
    if (timer.current) clearTimeout(timer.current);
    setAnimated(false);
    timer.current = setTimeout(() => setAnimated(true), 150);
  }

  useEffect(() => {
    let cancelled = false;

    let hadLocal = false;
    const stored = localStorage.getItem('jh-quiz-raw');
    if (stored) {
      try {
        setResults(JSON.parse(stored) as RawResults);
        hadLocal = true;
        scheduleAnimate();
      } catch {
        // malformed
      }
    }

    if (!user) {
      return () => {
        cancelled = true;
        if (timer.current) clearTimeout(timer.current);
      };
    }

    if (!hadLocal) setLoading(true);

    (async () => {
      try {
        const data = await fetchLastQuizResults(user.id);
        if (cancelled) return;
        if (data) {
          persistQuizResultsLocal(
            data.sessionId ?? null,
            data.dimensionScores ?? [],
            data.careerMatches ?? [],
          );
          setResults({
            sessionId: data.sessionId ?? null,
            dimensionScores: data.dimensionScores ?? [],
            careerMatches: data.careerMatches ?? [],
          });
          scheduleAnimate();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function repairEmptyCareerMatches() {
      if (!results || results.careerMatches.length > 0 || results.dimensionScores.length === 0) {
        return;
      }

      setRepairingMatches(true);
      try {
        const careerMatches = await buildCareerMatchesFromScores(results.dimensionScores);
        if (cancelled || careerMatches.length === 0) return;

        const repairedResults = {
          ...results,
          careerMatches,
        };
        setResults(repairedResults);
        persistQuizResultsLocal(
          repairedResults.sessionId ?? null,
          repairedResults.dimensionScores,
          repairedResults.careerMatches,
        );
        scheduleAnimate();
      } finally {
        if (!cancelled) setRepairingMatches(false);
      }
    }

    repairEmptyCareerMatches();
    return () => {
      cancelled = true;
    };
  }, [results]);

  function handleRetake() {
    localStorage.removeItem('jh-quiz-results');
    localStorage.removeItem('jh-quiz-raw');
    navigate('/quiz');
  }

  if (!results) {
    if (loading) {
      return (
        <div className="jh-results-container jh-page-state">
          <p className="jh-muted-copy">Loading your results...</p>
        </div>
      );
    }
    return (
      <div className="jh-results-container jh-page-state">
        <p className="jh-muted-copy jh-mb-md">
          No results yet - take the quiz first.
        </p>
        <Link to="/quiz" className="jh-btn-primary">Take the Quiz</Link>
      </div>
    );
  }

  const topCareers = results.careerMatches.slice(0, 10);
  const topAggregates = [...results.dimensionScores]
    .filter(s => s.subdimension === '')
    .sort((a, b) => b.normalizedScore - a.normalizedScore)
    .slice(0, 5);
  const topSubdimensions = [...results.dimensionScores]
    .filter(s => s.subdimension !== '')
    .sort((a, b) => b.normalizedScore - a.normalizedScore)
    .slice(0, 5);

  return (
    <div className="jh-results-container jh-results-container--wide">
      <div className="jh-section-header jh-section-header--spacious">
        <h2>Your Results</h2>
      </div>

      <div className="jh-results-layout">

        {/* Left — Top 10 Career Matches */}
        <div className="jh-traits-card jh-results-card--stretch">
          <h3>Top Career Matches</h3>

          {repairingMatches && topCareers.length === 0 ? (
            <p className="jh-muted-copy">Loading your career matches...</p>
          ) : topCareers.length > 0 ? (
            <div className="jh-career-podium">
              {topCareers.map((m) => (
                <div key={m.rank} className="jh-career-podium-row">
                  <div className="jh-career-podium-header">
                    <span className="jh-career-rank-badge">{m.rank}</span>
                    <span className="jh-career-podium-title">{m.title}</span>
                    <span className="jh-trait-value">{m.matchScore.toFixed(1)}%</span>
                  </div>
                  <div className="jh-trait-bar">
                    <div
                      className="jh-trait-fill"
                      style={{ width: animated ? `${m.matchScore}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="jh-empty-state jh-empty-state--compact">
              <h3>Career matches are loading</h3>
              <p>Refresh this page in a moment if your matches do not appear.</p>
              <button className="jh-btn-primary" onClick={() => window.location.reload()}>
                Refresh Results
              </button>
              </div>
          )}
        </div>

        {/* Right — two stacked cards */}
        <div className="jh-results-right">

          {/* Top 5 Dimension Scores */}
          <div className="jh-traits-card jh-results-card--flex">
            <h3>Top Dimension Scores</h3>
            {topAggregates.map((s, i) => (
              <div key={i} className="jh-trait-row">
                <div className="jh-trait-label">
                  <span>{s.dimension}</span>
                  <span className="jh-trait-value">{s.normalizedScore.toFixed(1)}</span>
                </div>
                <div className="jh-trait-bar">
                  <div
                    className="jh-trait-fill"
                    style={{ width: animated ? `${s.normalizedScore}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Top 5 Subdimension Scores */}
          {topSubdimensions.length > 0 && (
            <div className="jh-traits-card jh-results-card--flex">
              <h3>Top Subdimension Scores</h3>
              {topSubdimensions.map((s, i) => (
                <div key={i} className="jh-trait-row">
                  <div className="jh-trait-label">
                    <span>{s.subdimension}</span>
                    <span className="jh-trait-value">{s.normalizedScore.toFixed(1)}</span>
                  </div>
                  <div className="jh-trait-bar">
                    <div
                      className="jh-trait-fill"
                      style={{ width: animated ? `${s.normalizedScore}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      <div className="jh-mt-lg">
        <button className="jh-btn-secondary" onClick={handleRetake}>Retake Quiz</button>
      </div>
    </div>
  );
}

