import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Snackbar from './Snackbar';
import { hasSavedQuizResults } from '../lib/jobsService';

export default function Layout() {
  const { user, userProfile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [serverHasQuizResults, setServerHasQuizResults] = useState<boolean | null>(null);

  const localHasQuiz =
    typeof window !== 'undefined' &&
    Boolean(localStorage.getItem('jh-quiz-raw') || localStorage.getItem('jh-quiz-results'));
  const hasResults = localHasQuiz || (Boolean(user) && serverHasQuizResults === true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setServerHasQuizResults(null);
      return;
    }
    setServerHasQuizResults(null);
    (async () => {
      try {
        const hasResults = await hasSavedQuizResults(user.id);
        if (cancelled) return;
        setServerHasQuizResults(hasResults);
      } catch {
        if (!cancelled) setServerHasQuizResults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header>
        <nav className="jh-navbar">
          <div className="jh-navbar-inner">
            <NavLink to="/" className="jh-brand" onClick={closeMenu}>JobHarmony</NavLink>

            <button
              className={`jh-hamburger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation"
            >
              <span /><span /><span />
            </button>

            <ul className={`jh-nav-links${menuOpen ? ' open' : ''}`}>
              <li>
                <NavLink to="/" end className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                  Home
                </NavLink>
              </li>
              {hasResults && (
                <li>
                  <NavLink to="/jobs" end className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                    Jobs
                  </NavLink>
                </li>
              )}
              <li>
                <NavLink to="/quiz" className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                  Quiz
                </NavLink>
              </li>

              {hasResults && (
                <li>
                  <NavLink to="/quiz/results" className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                    Results
                  </NavLink>
                </li>
              )}

              {user && !loading && userProfile?.role === 'job_seeker' && (
                <>
                  <li>
                    <NavLink to="/candidate/dashboard" className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                      Dashboard
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/jobs/saved" className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                      Saved
                    </NavLink>
                  </li>
                </>
              )}

              {user && !loading && (
                <li>
                  <NavLink to="/profile/edit" className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                    Edit Profile
                  </NavLink>
                </li>
              )}

              {!user && !loading && (
                <>
                  <li>
                    <NavLink to="/login" className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                      Login
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/signup" className={({ isActive }) => 'jh-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
                      Signup
                    </NavLink>
                  </li>
                </>
              )}

              {/* User chip inside nav for mobile layout */}
              {user && !loading && (
                <li className="jh-nav-user-chip">
                  <span className="jh-nav-user-email">{user.email}</span>
                  <button
                    type="button"
                    className="jh-nav-user-signout"
                    onClick={async () => {
                      await handleSignOut();
                      closeMenu();
                    }}
                  >
                    Sign out
                  </button>
                </li>
              )}
            </ul>

            {user && !loading ? (
              <div className="jh-user-chip jh-user-chip--desktop">
                <span className="jh-user-chip-email">{user.email}</span>
                <span className="jh-user-chip-sep" />
                <button type="button" className="jh-user-chip-signout" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </nav>
      </header>

      <main role="main">
        <Outlet />
      </main>

      <footer className="jh-footer">
        <div className="jh-footer-content">
          <div>
            <div className="jh-footer-brand">JobHarmony</div>
            <p className="jh-footer-copy">
              &copy; 2026 JobHarmony. All rights reserved.
            </p>
          </div>
          <ul className="jh-footer-links">
            <li><NavLink to="/">Home</NavLink></li>
            <li><NavLink to="/quiz">Quiz</NavLink></li>
            {hasResults && <li><NavLink to="/jobs">Jobs</NavLink></li>}
            {user && <li><NavLink to="/profile/edit">Edit Profile</NavLink></li>}
          </ul>
        </div>
      </footer>

      <Snackbar />
    </>
  );
}
