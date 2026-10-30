import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

function formatDate(date) {
  if (!date) return 'Not specified'

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not specified'
  }

  return parsedDate.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function getElectionStatus(election) {
  const rawStatus = String(election?.status || '').trim().toLowerCase()
  const now = Date.now()
  const start = new Date(election?.startDate).getTime()
  const end = new Date(election?.endDate).getTime()

  if (rawStatus === 'cancelled') {
    return { label: 'Cancelled', key: 'cancelled', canVote: false }
  }

  if (rawStatus === 'completed') {
    return { label: 'Completed', key: 'completed', canVote: false }
  }

  if (rawStatus === 'draft') {
    return { label: 'Draft', key: 'draft', canVote: false }
  }

  if (rawStatus === 'upcoming' || rawStatus === 'scheduled') {
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return { label: 'Scheduled', key: 'scheduled', canVote: false }
    }

    if (now >= end) {
      return { label: 'Expired', key: 'expired', canVote: false }
    }

    if (now < start) {
      return { label: 'Scheduled', key: 'scheduled', canVote: false }
    }

    return {
      label: 'Awaiting activation',
      key: 'awaiting-activation',
      canVote: false
    }
  }

  if (rawStatus === 'active') {
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      end <= start
    ) {
      return { label: 'Status needs review', key: 'unknown', canVote: false }
    }

    if (now < start) {
      return { label: 'Scheduled', key: 'scheduled', canVote: false }
    }

    if (now >= end) {
      return { label: 'Expired', key: 'expired', canVote: false }
    }

    return { label: 'Open for voting', key: 'active', canVote: true }
  }

  return { label: 'Status needs review', key: 'unknown', canVote: false }
}

function getFilterGroup(status) {
  if (status.canVote) return 'open'

  if (['scheduled', 'awaiting-activation'].includes(status.key)) {
    return 'upcoming'
  }

  if (['completed', 'expired', 'cancelled'].includes(status.key)) {
    return 'closed'
  }

  return 'other'
}

function Dashboard() {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [elections, setElections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('ballottrustToken')
    const savedUser = localStorage.getItem('ballottrustUser')

    if (!token || !savedUser) {
      navigate('/login', { replace: true })
      return undefined
    }

    let currentUser

    try {
      currentUser = JSON.parse(savedUser)

      if (
        !currentUser?.id ||
        !['voter', 'admin'].includes(currentUser.role)
      ) {
        throw new Error('Invalid saved user information')
      }
    } catch {
      localStorage.removeItem('ballottrustToken')
      localStorage.removeItem('ballottrustUser')
      navigate('/login', { replace: true })
      return undefined
    }

    if (currentUser.role === 'admin') {
      navigate('/admin/dashboard', { replace: true })
      return undefined
    }

    setUser(currentUser)

    const controller = new AbortController()

    async function fetchElections() {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(`${API_URL}/elections`, {
          signal: controller.signal
        })

        const data = await response.json()

        if (!response.ok || data.success === false) {
          throw new Error(data.message || 'Unable to load elections.')
        }

        setElections(Array.isArray(data.elections) ? data.elections : [])
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Could not connect to BallotTrust.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchElections()

    return () => controller.abort()
  }, [navigate, refreshKey])

  const handleLogout = () => {
    localStorage.removeItem('ballottrustToken')
    localStorage.removeItem('ballottrustUser')
    navigate('/login', { replace: true })
  }

  const filteredElections = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return elections.filter((election) => {
      const title = String(election.title || '').toLowerCase()
      const description = String(election.description || '').toLowerCase()
      const status = getElectionStatus(election)

      const matchesSearch =
        !query || title.includes(query) || description.includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        getFilterGroup(status) === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [elections, searchTerm, statusFilter])

  const electionCounts = useMemo(() => {
    return elections.reduce(
      (counts, election) => {
        const status = getElectionStatus(election)
        counts.all += 1
        counts[getFilterGroup(status)] += 1
        return counts
      },
      { all: 0, open: 0, upcoming: 0, closed: 0, other: 0 }
    )
  }, [elections])

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== 'all'

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a
          href="/dashboard"
          className="dashboard-brand"
          onClick={(event) => {
            event.preventDefault()
            navigate('/dashboard')
          }}
          aria-label="BallotTrust dashboard"
        >
          <span className="dashboard-brand-icon">B</span>
          <span>BallotTrust</span>
        </a>

        <div className="dashboard-header-actions">
          <div className="dashboard-user">
            <span className="dashboard-user-avatar" aria-hidden="true">
              {(user?.name || 'V').trim().charAt(0).toUpperCase()}
            </span>
            <div className="dashboard-user-details">
              <span className="dashboard-user-label">Signed in as</span>
              <span className="dashboard-user-name">
                {user?.name || 'Voter'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="dashboard-logout"
            onClick={handleLogout}
          >
            <span aria-hidden="true">↪</span>
            Log out
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <section className="dashboard-welcome">
          <div className="dashboard-welcome-copy">
            <p className="dashboard-kicker">VOTER PORTAL</p>

            <h1>
              Welcome{user?.name ? `, ${user.name}` : ''}
            </h1>

            <p>
              Your voice matters. Explore elections, learn about the candidates,
              and make your vote count.
            </p>
          </div>

          <div className="dashboard-welcome-mark" aria-hidden="true">
            <span className="welcome-mark-check">✓</span>
            <span className="welcome-mark-ring" />
          </div>

          <div className="dashboard-welcome-footer">
            <span className="dashboard-security-mark" aria-hidden="true">✓</span>
            Secure voting starts with an informed choice.
          </div>
        </section>

        <section className="dashboard-elections">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-section-eyebrow">YOUR VOTING SPACE</p>
              <h2>Explore elections</h2>
              <p>Review election schedules, check eligibility periods, and open an election to learn more.</p>
            </div>

            {!loading && !error && (
              <div className="dashboard-total-count">
                <strong>{elections.length}</strong>
                <span>{elections.length === 1 ? 'Election' : 'Elections'}</span>
              </div>
            )}
          </div>

          {!loading && !error && elections.length > 0 && (
            <>
              <div className="dashboard-election-tools">
                <label className="dashboard-search">
                  <span className="dashboard-search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="10.8" cy="10.8" r="6.8" />
                      <path d="m16 16 4.2 4.2" />
                    </svg>
                  </span>

                  <input
                    type="search"
                    placeholder="Search by election name or description"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    aria-label="Search elections"
                  />

                  {searchTerm && (
                    <button
                      type="button"
                      className="dashboard-clear-search"
                      onClick={() => setSearchTerm('')}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </label>

                <button
                  type="button"
                  className={`dashboard-filter-button${statusFilter === 'all' ? ' filter-active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                  aria-pressed={statusFilter === 'all'}
                >
                  All <span>{electionCounts.all}</span>
                </button>

                <button
                  type="button"
                  className={`dashboard-filter-button${statusFilter === 'open' ? ' filter-active' : ''}`}
                  onClick={() => setStatusFilter('open')}
                  aria-pressed={statusFilter === 'open'}
                >
                  Open <span>{electionCounts.open}</span>
                </button>

                <button
                  type="button"
                  className={`dashboard-filter-button${statusFilter === 'upcoming' ? ' filter-active' : ''}`}
                  onClick={() => setStatusFilter('upcoming')}
                  aria-pressed={statusFilter === 'upcoming'}
                >
                  Upcoming <span>{electionCounts.upcoming}</span>
                </button>

                <button
                  type="button"
                  className={`dashboard-filter-button${statusFilter === 'closed' ? ' filter-active' : ''}`}
                  onClick={() => setStatusFilter('closed')}
                  aria-pressed={statusFilter === 'closed'}
                >
                  Closed <span>{electionCounts.closed}</span>
                </button>
              </div>

              <div className="dashboard-results-line" aria-live="polite">
                <span>
                  Showing <strong>{filteredElections.length}</strong>{' '}
                  of <strong>{elections.length}</strong>{' '}
                  {elections.length === 1 ? 'election' : 'elections'}
                </span>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className="dashboard-reset-filters"
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('all')
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </>
          )}

          {loading && (
            <div className="dashboard-message dashboard-loading" role="status">
              <span className="dashboard-spinner" aria-hidden="true" />
              <div>
                <strong>Loading elections</strong>
                <p>Getting the latest election information…</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="dashboard-error" role="alert">
              <span className="dashboard-state-icon" aria-hidden="true">!</span>
              <div className="dashboard-state-content">
                <h3>Unable to load elections</h3>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && elections.length === 0 && (
            <div className="dashboard-empty">
              <span className="dashboard-empty-icon" aria-hidden="true">▤</span>
              <h3>No elections available yet</h3>
              <p>
                Elections will appear here when they are published and available
                to voters.
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            elections.length > 0 &&
            filteredElections.length === 0 && (
              <div className="dashboard-empty dashboard-filter-empty">
                <span className="dashboard-empty-icon" aria-hidden="true">⌕</span>
                <h3>No matching elections</h3>
                <p>
                  Try a different search term or clear your filters to see all
                  elections.
                </p>
                <button
                  type="button"
                  className="dashboard-reset-button"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                  }}
                >
                  Clear search and filters
                </button>
              </div>
            )}

          {!loading && !error && filteredElections.length > 0 && (
            <div className="election-grid">
              {filteredElections.map((election) => {
                const status = getElectionStatus(election)

                return (
                  <article className="election-card" key={election._id}>
                    <div className="election-card-top">
                      <span
                        className={`election-status status-${status.key}`}
                      >
                        <span className="election-status-dot" aria-hidden="true" />
                        {status.label}
                      </span>

                      <span className="election-card-type">Election</span>
                    </div>

                    <div className="election-card-content">
                      <h3>{election.title || 'Untitled election'}</h3>

                      <p className="election-description">
                        {election.description || 'No description provided for this election.'}
                      </p>
                    </div>

                    <div className="election-dates">
                      <div className="election-date-row">
                        <span className="election-date-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none">
                            <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
                            <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17" />
                          </svg>
                        </span>
                        <p>
                          <span>Starts</span>
                          <strong>{formatDate(election.startDate)}</strong>
                        </p>
                      </div>

                      <div className="election-date-row">
                        <span className="election-date-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="8.5" />
                            <path d="M12 7v5l3.5 2" />
                          </svg>
                        </span>
                        <p>
                          <span>Ends</span>
                          <strong>{formatDate(election.endDate)}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="election-card-footer">
                      <span className="election-card-hint">
                        {status.canVote
                          ? 'Voting is currently open'
                          : status.key === 'scheduled' ||
                              status.key === 'awaiting-activation'
                            ? 'Check the election schedule'
                            : status.key === 'expired' ||
                                status.key === 'completed' ||
                                status.key === 'cancelled'
                              ? 'Review election details'
                              : 'Review election status'}
                      </span>

                      <button
                        type="button"
                        className="election-view-button"
                        onClick={() => navigate(`/elections/${election._id}`)}
                      >
                        View election
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>

      <footer className="dashboard-footer">
        <div className="dashboard-footer-brand">
          <span className="dashboard-footer-mark">B</span>
          <span>BallotTrust</span>
        </div>
        <p>Secure, transparent voting.</p>
      </footer>
    </main>
  )
}

export default Dashboard