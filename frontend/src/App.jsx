
import { Link, Routes, Route, useNavigate } from 'react-router-dom'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import './App.css'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="ballottrust">
      <header className="navbar">
        <Link className="brand" to="/">
          <span className="brand-icon">B</span>
          BallotTrust
        </Link>

        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#security">Security</a>
        </nav>

        <div className="nav-actions">
          <button className="btn btn-outline" onClick={() => navigate('/login')}>
            Log in
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/register')}>
            Get started
          </button>
        </div>
      </header>

      <main>
        <section className="hero-section" id="home">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="status-dot" />
              A better way to vote
            </span>

            <h1>
              Every vote matters.
              <br />
              <span>Every voice counts.</span>
            </h1>

            <p className="hero-description">
              Run elections with confidence. BallotTrust helps schools,
              associations, and organizations manage elections through a
              simple, transparent, and secure digital experience.
            </p>

            <div className="hero-actions">
              <button
                className="btn btn-primary btn-large"
                onClick={() => navigate('/register')}
              >
                Get started <span aria-hidden="true">→</span>
              </button>
              <a className="btn btn-outline btn-large" href="#how-it-works">
                See how it works
              </a>
            </div>

            <div className="trust-note">
              <span className="trust-check">✓</span>
              Email verification
              <span className="trust-separator">·</span>
              <span className="trust-check">✓</span>
              Voter access controls
            </div>
          </div>

          <div className="hero-visual" aria-label="Election dashboard preview">
            <div className="visual-glow" />
            <div className="election-card">
              <div className="card-top">
                <div>
                  <span className="card-label">ELECTION OVERVIEW</span>
                  <h2>Student Union Election</h2>
                </div>
                <span className="demo-badge">Preview</span>
              </div>

              <div className="election-status">
                <span className="status-dot" />
                Election dashboard preview
              </div>

              <div className="candidate-preview">
                <div className="candidate-avatar avatar-one">A</div>
                <div className="candidate-details">
                  <strong>Candidate profile</strong>
                  <span>President · Manifesto available</span>
                </div>
                <span className="preview-arrow">↗</span>
              </div>

              <div className="candidate-preview">
                <div className="candidate-avatar avatar-two">B</div>
                <div className="candidate-details">
                  <strong>Candidate profile</strong>
                  <span>Vice President · Manifesto available</span>
                </div>
                <span className="preview-arrow">↗</span>
              </div>

              <div className="card-footer">
                <span className="footer-icon">✓</span>
                Designed for accountable elections
              </div>
            </div>

            <div className="floating-note">
              <span className="floating-icon">✦</span>
              <div>
                <strong>Built around trust</strong>
                <span>Clear election workflows</span>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-strip" id="features">
          <div className="strip-item">
            <span className="strip-icon">01</span>
            <div>
              <strong>Verified accounts</strong>
              <span>Email verification and account controls</span>
            </div>
          </div>

          <div className="strip-item">
            <span className="strip-icon">02</span>
            <div>
              <strong>Organized elections</strong>
              <span>Elections, positions, and candidates</span>
            </div>
          </div>

          <div className="strip-item">
            <span className="strip-icon">03</span>
            <div>
              <strong>Transparent results</strong>
              <span>Clear results and election reporting</span>
            </div>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <span className="section-kicker">SIMPLE BY DESIGN</span>
            <h2>From setup to results, in one place.</h2>
            <p>
              BallotTrust is being built to make running an organizational
              election easier for administrators and voters alike.
            </p>
          </div>

          <div className="steps-grid">
            <article className="step-card">
              <span className="step-number">01</span>
              <h3>Set up your election</h3>
              <p>
                Administrators configure election details, positions,
                candidates, and voting dates.
              </p>
            </article>

            <article className="step-card">
              <span className="step-number">02</span>
              <h3>Verify and participate</h3>
              <p>
                Voters create accounts, verify their email, and access
                elections they are eligible to participate in.
              </p>
            </article>

            <article className="step-card">
              <span className="step-number">03</span>
              <h3>Review the outcome</h3>
              <p>
                Authorized results and reports help organizations understand
                election outcomes.
              </p>
            </article>
          </div>
        </section>

        <section className="security-section" id="security">
          <div className="security-mark">✓</div>
          <div>
            <span className="section-kicker">SECURITY FIRST</span>
            <h2>Trust should be built into the process.</h2>
            <p>
              BallotTrust already has backend account verification and
              role-based access controls. We're extending the platform with
              secure voting, ballot privacy, and auditable election workflows.
            </p>
          </div>
        </section>

        <section className="final-cta">
          <span className="section-kicker">BALLOTTRUST</span>
          <h2>Make every election count.</h2>
          <p>
            A clearer, more organized way for communities to make decisions.
          </p>
          <button
            className="btn btn-primary btn-large"
            onClick={() => navigate('/register')}
          >
            Explore BallotTrust <span aria-hidden="true">→</span>
          </button>
        </section>
      </main>

      <footer className="footer">
        <Link className="brand" to="/">
          <span className="brand-icon">B</span>
          BallotTrust
        </Link>
        <span>Digital elections, designed around trust.</span>
        <span>© {new Date().getFullYear()} BallotTrust</span>
      </footer>
    </div>
  )
}

function LoginPlaceholder() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-icon">B</span>
          BallotTrust
        </Link>
        <div className="auth-heading">
          <h1>Login page coming next</h1>
          <p>We're connecting the authentication pages to your backend.</p>
        </div>
        <Link className="auth-submit" to="/register">
          Create an account
        </Link>
        <p className="auth-switch">
          <Link to="/">← Back to homepage</Link>
        </p>
      </section>
    </main>
  )
}

function NotFound() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Page not found</h1>
        <p>The page you requested doesn't exist.</p>
        <p className="auth-switch">
          <Link to="/">Return to BallotTrust</Link>
        </p>
      </section>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/login" element={<LoginPlaceholder />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
