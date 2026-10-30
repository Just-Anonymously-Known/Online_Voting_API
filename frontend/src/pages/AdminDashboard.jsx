import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminDashboard.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

function formatDate(value) {
  if (!value) return 'Not specified'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not specified'

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getStatus(election) {
  const status = String(election.status || '').toLowerCase()
  const now = Date.now()
  const start = new Date(election.startDate).getTime()
  const end = new Date(election.endDate).getTime()

  if (['cancelled', 'completed', 'draft'].includes(status)) return status

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 'needs review'
  }

  if (now >= end) return 'expired'
  if (now < start) return 'scheduled'

  return status === 'active' ? 'active' : 'awaiting activation'
}

function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase() || '?'
  )
}

function AdminDashboard() {
  const navigate = useNavigate()

  const [elections, setElections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
  })

  const [selectedResultsId, setSelectedResultsId] = useState('')
  const [resultsData, setResultsData] = useState(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsError, setResultsError] = useState('')
  const [selectedPositionId, setSelectedPositionId] = useState('')

  const getToken = () => localStorage.getItem('ballottrustToken')

  const loadElections = useCallback(async () => {
    const token = getToken()

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/elections`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to load elections.')
      }

      setElections(Array.isArray(data.elections) ? data.elections : [])
    } catch (err) {
      setError(err.message || 'Could not load elections.')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    try {
      const token = getToken()
      const savedUser = localStorage.getItem('ballottrustUser')

      if (!token || !savedUser) {
        navigate('/login', { replace: true })
        return
      }

      const user = JSON.parse(savedUser)

      if (user?.role !== 'admin') {
        navigate('/dashboard', { replace: true })
        return
      }
    } catch {
      localStorage.removeItem('ballottrustToken')
      localStorage.removeItem('ballottrustUser')
      navigate('/login', { replace: true })
      return
    }

    loadElections()
  }, [navigate, loadElections])

  const electionStats = useMemo(() => {
    const stats = {
      total: elections.length,
      active: 0,
      scheduled: 0,
      completed: 0,
    }

    elections.forEach((election) => {
      const status = getStatus(election)

      if (status === 'active') stats.active += 1

      if (status === 'scheduled' || status === 'awaiting activation') {
        stats.scheduled += 1
      }

      if (status === 'completed') stats.completed += 1
    })

    return stats
  }, [elections])

  const resultEligibleElections = useMemo(() => {
    const now = Date.now()

    return elections.filter((election) => {
      const status = String(election.status || '').trim().toLowerCase()
      const start = new Date(election.startDate).getTime()
      const end = new Date(election.endDate).getTime()

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
      ) {
        return false
      }

      // The API permits admins to view active-election results only
      // while the election is within its scheduled voting window.
      if (status === 'active') return now >= start && now < end
      if (status === 'completed') return now >= end
      return false
    })
  }, [elections])

  const loadResults = async (electionId) => {
    setSelectedResultsId(electionId)
    setResultsData(null)
    setResultsError('')
    setSelectedPositionId('')

    if (!electionId) return

    try {
      setResultsLoading(true)

      const response = await fetch(`${API_URL}/results/${electionId}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      })

      const data = await response.json()

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to load election results.')
      }

      setResultsData(data)

      const firstPosition = Array.isArray(data.results)
        ? data.results[0]
        : null

      setSelectedPositionId(
        firstPosition ? String(firstPosition.positionId) : ''
      )
    } catch (err) {
      setResultsError(err.message || 'Could not load election results.')
    } finally {
      setResultsLoading(false)
    }
  }

  const selectedPosition = useMemo(() => {
    if (!Array.isArray(resultsData?.results)) return null

    return (
      resultsData.results.find(
        (position) => String(position.positionId) === selectedPositionId
      ) || null
    )
  }, [resultsData, selectedPositionId])

  const positionCandidates = useMemo(() => {
    const sourceCandidates = Array.isArray(selectedPosition?.candidates)
      ? selectedPosition.candidates
      : []

    const totalVotes = sourceCandidates.reduce(
      (total, candidate) => total + (Number(candidate.votes) || 0),
      0
    )

    const candidates = sourceCandidates
      .map((candidate) => {
        const votes = Math.max(0, Number(candidate.votes) || 0)

        return {
          ...candidate,
          votes,
          percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
        }
      })
      .sort((a, b) => b.votes - a.votes || String(a.name || '').localeCompare(String(b.name || '')))

    const leadingCandidate = candidates[0] && candidates[0].votes > 0
      ? candidates[0]
      : null

    return {
      totalVotes,
      candidateCount: candidates.length,
      leadingCandidate,
      leadingPercentage: leadingCandidate ? leadingCandidate.percentage : 0,
      candidates,
    }
  }, [selectedPosition])

  const handleFormChange = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }))
  }

  const createElection = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    const start = new Date(form.startDate)
    const end = new Date(form.endDate)

    if (!form.title.trim()) {
      setError('Enter an election title.')
      return
    }

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setError('Choose valid dates. The end date must be after the start date.')
      return
    }

    try {
      setSaving(true)

      const response = await fetch(`${API_URL}/elections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
      })

      const data = await response.json()

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to create election.')
      }

      setNotice('Election created successfully as a draft.')
      setForm({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
      })

      await loadElections()
    } catch (err) {
      setError(err.message || 'Unable to create election.')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (election, nextStatus) => {
    setError('')
    setNotice('')

    if (!window.confirm(`Change "${election.title}" to ${nextStatus}?`)) {
      return
    }

    try {
      setSaving(true)

      const response = await fetch(
        `${API_URL}/elections/${election._id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      )

      const data = await response.json()

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to update election status.')
      }

      setNotice(data.message || `Election status changed to ${nextStatus}.`)
      await loadElections()

      if (selectedResultsId === election._id && nextStatus === 'completed') {
        await loadResults(election._id)
      }
    } catch (err) {
      setError(err.message || 'Unable to update election status.')
    } finally {
      setSaving(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('ballottrustToken')
    localStorage.removeItem('ballottrustUser')
    navigate('/login', { replace: true })
  }

  return (
    <main className="admin-dashboard-page">
      <aside className="admin-sidebar">
        <a
          className="admin-sidebar-brand"
          href="#overview"
          aria-label="BallotTrust dashboard"
        >
          <span className="admin-brand-icon">B</span>
          <span>
            BallotTrust
            <small>ADMIN CONSOLE</small>
          </span>
        </a>

        <p className="admin-nav-caption">WORKSPACE</p>

        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          <a className="is-active" href="#overview">
            <span>▦</span>Dashboard
          </a>
          <a href="#elections">
            <span>◷</span>Elections
          </a>
          <a href="#create-election">
            <span>＋</span>Create election
          </a>
          <a href="#results">
            <span>▤</span>Results
          </a>
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-profile">
            <span className="admin-profile-avatar">A</span>
            <span>
              <strong>Administrator</strong>
              <small>Election manager</small>
            </span>
          </div>

          <button
            className="admin-sidebar-logout"
            type="button"
            onClick={logout}
          >
            <span>↪</span>Log out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            Workspace <span>/</span> Dashboard
          </div>

          <div className="admin-header-actions">
            <span className="admin-live-indicator">
              <i /> System overview
            </span>
            <button
              className="admin-button admin-button-secondary"
              type="button"
              onClick={loadElections}
              disabled={loading}
            >
              <span aria-hidden="true">↻</span>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        <div className="admin-dashboard-content" id="overview">
          <section className="admin-dashboard-intro">
            <div>
              <p className="admin-eyebrow">OVERVIEW</p>
              <h1>Good day, Administrator</h1>
              <p>Here’s what’s happening across your elections.</p>
            </div>

            <a
              className="admin-button admin-button-primary"
              href="#create-election"
            >
              <span>＋</span> Create election
            </a>
          </section>

          {error && (
            <div className="admin-alert admin-alert-error" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="admin-alert admin-alert-success" role="status">
              {notice}
            </div>
          )}

          <section className="admin-stats-grid" aria-label="Election overview">
            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-stat-icon icon-green">▦</span>
                <span className="admin-stat-kicker">ALL RECORDS</span>
              </div>
              <span className="admin-stat-label">Total elections</span>
              <strong>{loading ? '—' : electionStats.total}</strong>
              <span className="admin-stat-footnote">All recorded elections</span>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-stat-icon icon-blue">◉</span>
                <span className="admin-stat-kicker">LIVE NOW</span>
              </div>
              <span className="admin-stat-label">Active elections</span>
              <strong>{loading ? '—' : electionStats.active}</strong>
              <span className="admin-stat-footnote">Currently running</span>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-stat-icon icon-amber">◷</span>
                <span className="admin-stat-kicker">UP NEXT</span>
              </div>
              <span className="admin-stat-label">Scheduled</span>
              <strong>{loading ? '—' : electionStats.scheduled}</strong>
              <span className="admin-stat-footnote">Upcoming elections</span>
            </article>

            <article className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-stat-icon icon-purple">✓</span>
                <span className="admin-stat-kicker">CLOSED</span>
              </div>
              <span className="admin-stat-label">Completed</span>
              <strong>{loading ? '—' : electionStats.completed}</strong>
              <span className="admin-stat-footnote">Ready for final review</span>
            </article>
          </section>

          <section className="admin-overview-grid">
            <article className="admin-panel admin-status-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-eyebrow">ELECTION HEALTH</p>
                  <h2>Election status</h2>
                </div>
              </div>

              <div className="admin-status-visual">
                <div
                  className="admin-status-ring"
                  style={{
                    '--active': electionStats.total
                      ? (electionStats.active / electionStats.total) * 100
                      : 0,
                  }}
                >
                  <div>
                    <strong>{loading ? '—' : electionStats.total}</strong>
                    <span>Total</span>
                  </div>
                </div>

                <div className="admin-status-legend">
                  <span>
                    <i className="legend-active" />Active
                    <strong>{electionStats.active}</strong>
                  </span>
                  <span>
                    <i className="legend-scheduled" />Scheduled
                    <strong>{electionStats.scheduled}</strong>
                  </span>
                  <span>
                    <i className="legend-completed" />Completed
                    <strong>{electionStats.completed}</strong>
                  </span>
                  <span>
                    <i className="legend-other" />Other
                    <strong>
                      {Math.max(
                        0,
                        electionStats.total -
                          electionStats.active -
                          electionStats.scheduled -
                          electionStats.completed
                      )}
                    </strong>
                  </span>
                </div>
              </div>

              <p className="admin-panel-note">
                Status totals are calculated from elections returned by the API.
              </p>
            </article>

            <article className="admin-panel admin-quick-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-eyebrow">SHORTCUTS</p>
                  <h2>Quick actions</h2>
                </div>
              </div>

              <a className="admin-quick-action" href="#create-election">
                <span className="quick-action-icon">＋</span>
                <span>
                  <strong>Create an election</strong>
                  <small>Set up a new voting event</small>
                </span>
                <b>→</b>
              </a>

              <a className="admin-quick-action" href="#elections">
                <span className="quick-action-icon">☷</span>
                <span>
                  <strong>Manage elections</strong>
                  <small>Update status and candidates</small>
                </span>
                <b>→</b>
              </a>

              <a className="admin-quick-action" href="#results">
                <span className="quick-action-icon">▤</span>
                <span>
                  <strong>Review results</strong>
                  <small>Compare candidate vote totals</small>
                </span>
                <b>→</b>
              </a>
            </article>
          </section>

          <section className="admin-panel admin-results-panel" id="results">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">RESULTS CENTRE</p>
                <h2>Candidate vote breakdown</h2>
                <p>Review results by election and position.</p>
              </div>
            </div>

            <label
              className="admin-results-select-label"
              htmlFor="results-election"
            >
              Select election
              <select
                id="results-election"
                value={selectedResultsId}
                onChange={(event) => loadResults(event.target.value)}
                disabled={
                  loading ||
                  resultEligibleElections.length === 0 ||
                  resultsLoading
                }
              >
                <option value="">Choose an election</option>
                {resultEligibleElections.map((election) => (
                  <option key={election._id} value={election._id}>
                    {election.title} — {String(election.status).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>

            {resultEligibleElections.length === 0 && !loading && (
              <p className="admin-empty-state">
                There are no active or completed elections to display yet.
              </p>
            )}

            {resultsLoading && (
              <p className="admin-empty-state" role="status">
                Loading candidate results…
              </p>
            )}

            {resultsError && (
              <div className="admin-alert admin-alert-error" role="alert">
                {resultsError}
              </div>
            )}

            {resultsData && !resultsLoading && (
              <>
                <div className="admin-results-summary">
                  <div>
                    <span className="admin-stat-label">Selected election</span>
                    <strong>
                      {resultsData.election?.title || 'Election results'}
                    </strong>
                  </div>

                  <span
                    className={`admin-status ${
                      resultsData.provisional
                        ? 'admin-status-active'
                        : 'admin-status-completed'
                    }`}
                  >
                    {resultsData.provisional ? 'Provisional results' : 'Final results'}
                  </span>
                </div>

                <div className="admin-results-metrics" aria-label="Position result summary">
                  <article className="admin-results-metric">
                    <span className="admin-results-metric-label">Candidates</span>
                    <strong>{selectedPosition ? positionCandidates.candidateCount : '—'}</strong>
                    <small>In selected position</small>
                  </article>
                  <article className="admin-results-metric">
                    <span className="admin-results-metric-label">Total votes</span>
                    <strong>{selectedPosition ? positionCandidates.totalVotes.toLocaleString() : '—'}</strong>
                    <small>Recorded for this position</small>
                  </article>
                  <article className="admin-results-metric admin-results-metric-leader">
                    <span className="admin-results-metric-label">Leading candidate</span>
                    <strong>{positionCandidates.leadingCandidate?.name || 'No votes yet'}</strong>
                    <small>
                      {positionCandidates.leadingCandidate
                        ? `${positionCandidates.leadingCandidate.percentage.toFixed(1)}% of votes`
                        : 'No leading candidate'}
                    </small>
                  </article>
                </div>

                {Array.isArray(resultsData.results) &&
                resultsData.results.length > 0 ? (
                  <>
                    <label
                      className="admin-results-select-label"
                      htmlFor="results-position"
                    >
                      Position
                      <select
                        id="results-position"
                        value={selectedPositionId}
                        onChange={(event) =>
                          setSelectedPositionId(event.target.value)
                        }
                      >
                        {resultsData.results.map((position) => (
                          <option
                            key={position.positionId}
                            value={String(position.positionId)}
                          >
                            {position.positionTitle}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedPosition && (
                      <div className="admin-position-results">
                        <div className="admin-results-heading">
                          <div>
                            <h3>{selectedPosition.positionTitle}</h3>
                            <p>Votes received by each candidate</p>
                          </div>

                          <div className="admin-position-total">
                            <strong>
                              {positionCandidates.totalVotes.toLocaleString()}
                            </strong>
                            <span>Total votes</span>
                          </div>
                        </div>

                        {positionCandidates.candidates.length > 0 && (
                          <div className="admin-results-chart">
                            <div className="admin-results-chart-heading">
                              <div>
                                <h4>Vote distribution</h4>
                                <p>Share of recorded votes by candidate</p>
                              </div>
                              <span>{positionCandidates.totalVotes.toLocaleString()} total</span>
                            </div>

                            <div className="admin-chart-bars">
                              {positionCandidates.candidates.map((candidate, index) => (
                                <div className="admin-chart-row" key={`chart-${String(candidate.candidateId)}`}>
                                  <div className="admin-chart-label">
                                    <span className="admin-chart-rank">{index + 1}</span>
                                    <span className="admin-chart-name" title={candidate.name}>{candidate.name}</span>
                                    <strong>{candidate.percentage.toFixed(1)}%</strong>
                                  </div>
                                  <div
                                    className="admin-chart-track"
                                    role="img"
                                    aria-label={`${candidate.name}: ${candidate.percentage.toFixed(1)} percent`}
                                  >
                                    <div
                                      className={`admin-chart-fill${index === 0 && candidate.votes > 0 ? ' is-leading' : ''}`}
                                      style={{ width: `${candidate.percentage}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {positionCandidates.candidates.length === 0 ? (
                          <p className="admin-empty-state">
                            No candidates were found for this position.
                          </p>
                        ) : (
                          <div className="admin-candidate-results">
                            {positionCandidates.candidates.map(
                              (candidate, index) => (
                                <article
                                  className="admin-candidate-result"
                                  key={String(candidate.candidateId)}
                                >
                                  <div className="admin-candidate-info">
                                    {candidate.photoUrl ? (
                                      <img
                                        className="admin-candidate-photo"
                                        src={candidate.photoUrl}
                                        alt=""
                                        loading="lazy"
                                      />
                                    ) : (
                                      <span
                                        className="admin-candidate-avatar"
                                        aria-hidden="true"
                                      >
                                        {initials(candidate.name)}
                                      </span>
                                    )}

                                    <div className="admin-candidate-name">
                                      <strong>{candidate.name}</strong>
                                      <span>
                                        {candidate.votes.toLocaleString()} votes
                                      </span>
                                    </div>

                                    <strong className="admin-candidate-percentage">
                                      {candidate.percentage.toFixed(1)}%
                                    </strong>
                                  </div>

                                  <div
                                    className="admin-candidate-bar-track"
                                    role="img"
                                    aria-label={`${candidate.name}: ${candidate.votes} votes, ${candidate.percentage.toFixed(1)} percent`}
                                  >
                                    <div
                                      className={`admin-candidate-bar${
                                        index === 0 && candidate.votes > 0
                                          ? ' admin-candidate-bar-leading'
                                          : ''
                                      }`}
                                      style={{
                                        width: `${candidate.percentage}%`,
                                      }}
                                    />
                                  </div>
                                </article>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="admin-empty-state">
                    No positions were returned for this election.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="admin-panel" id="create-election">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">SET UP</p>
                <h2>Create an election</h2>
                <p>New elections are created as drafts.</p>
              </div>
            </div>

            <form onSubmit={createElection} className="admin-election-form">
              <label>
                Election title
                <input
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  maxLength={150}
                  required
                  placeholder="e.g. Student Union Election 2027"
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  maxLength={2000}
                  rows={3}
                  placeholder="Describe the purpose of this election"
                />
              </label>

              <div className="admin-date-grid">
                <label>
                  Start date and time
                  <input
                    type="datetime-local"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label>
                  End date and time
                  <input
                    type="datetime-local"
                    name="endDate"
                    value={form.endDate}
                    onChange={handleFormChange}
                    required
                  />
                </label>
              </div>

              <button
                className="admin-button admin-button-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Create draft election'}
              </button>
            </form>
          </section>

          <section className="admin-panel" id="elections">
            <div className="admin-section-heading admin-election-list-heading">
              <div>
                <p className="admin-eyebrow">MANAGEMENT</p>
                <h2>Existing elections</h2>
                <p>{elections.length} election(s) found</p>
              </div>

              <button
                className="admin-button admin-button-secondary"
                type="button"
                onClick={loadElections}
                disabled={loading}
              >
                {loading ? 'Loading…' : '↻ Refresh list'}
              </button>
            </div>

            {loading ? (
              <p role="status">Loading elections…</p>
            ) : elections.length === 0 ? (
              <p className="admin-empty-state">
                No elections found. Create your first election above.
              </p>
            ) : (
              <div className="admin-election-table-wrap">
                <table className="admin-election-table">
                  <thead>
                    <tr>
                      <th>Election</th>
                      <th>Start date</th>
                      <th>End date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elections.map((election) => {
                      const status = getStatus(election)
                      const rawStatus = String(
                        election.status || ''
                      ).toLowerCase()

                      return (
                        <tr key={election._id}>
                          <td>
                            <div className="admin-table-election">
                              <strong>{election.title}</strong>
                              <span>
                                {election.description ||
                                  'No description provided.'}
                              </span>
                            </div>
                          </td>
                          <td>{formatDate(election.startDate)}</td>
                          <td>{formatDate(election.endDate)}</td>
                          <td>
                            <span
                              className={`admin-status admin-status-${status.replace(/\s+/g, '-')}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td>
                            <div className="admin-table-actions">
                              <button
                                className="admin-button admin-button-secondary"
                                type="button"
                                onClick={() =>
                                  navigate(`/admin/elections/${election._id}`)
                                }
                              >
                                Manage
                              </button>

                              {rawStatus === 'draft' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateStatus(election, 'scheduled')
                                  }
                                  disabled={saving}
                                >
                                  Schedule
                                </button>
                              )}

                              {['scheduled', 'upcoming'].includes(rawStatus) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateStatus(election, 'active')
                                  }
                                  disabled={saving}
                                >
                                  Activate
                                </button>
                              )}

                              {rawStatus === 'active' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateStatus(election, 'completed')
                                  }
                                  disabled={saving}
                                >
                                  Complete
                                </button>
                              )}

                              {!['completed', 'cancelled'].includes(
                                rawStatus
                              ) && (
                                <button
                                  className="admin-button-danger"
                                  type="button"
                                  onClick={() =>
                                    updateStatus(election, 'cancelled')
                                  }
                                  disabled={saving}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="admin-footer">
            <span>BallotTrust Admin Console</span>
            <span>Manage elections with confidence.</span>
          </footer>
        </div>
      </div>
    </main>
  )
}

export default AdminDashboard