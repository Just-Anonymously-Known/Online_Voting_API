
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

  const completedElections = useMemo(
    () =>
      elections.filter(
        (election) =>
          String(election.status || '').toLowerCase() === 'completed'
      ),
    [elections]
  )

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
    const candidates = Array.isArray(selectedPosition?.candidates)
      ? selectedPosition.candidates
      : []

    const totalVotes = candidates.reduce(
      (total, candidate) => total + (Number(candidate.votes) || 0),
      0
    )

    return {
      totalVotes,
      candidates: [...candidates]
        .map((candidate) => {
          const votes = Number(candidate.votes) || 0

          return {
            ...candidate,
            votes,
            percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
          }
        })
        .sort((a, b) => b.votes - a.votes),
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

    const confirmed = window.confirm(
      `Change "${election.title}" to ${nextStatus}?`
    )

    if (!confirmed) return

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
      <header className="admin-dashboard-header">
        <div className="admin-dashboard-brand">
          <span className="admin-brand-icon">B</span>
          <span>BallotTrust</span>
          <span className="admin-role-label">Admin</span>
        </div>

        <div className="admin-header-actions">
          <button type="button" onClick={loadElections} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <section className="admin-dashboard-content">
        <div className="admin-dashboard-intro">
          <p className="admin-eyebrow">ADMINISTRATION</p>
          <h1>Election management</h1>
          <p>Monitor elections, manage candidates, and review certified results.</p>
        </div>

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
            <span className="admin-stat-label">Total elections</span>
            <strong>{loading ? '—' : electionStats.total}</strong>
            <span className="admin-stat-footnote">All recorded elections</span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Active</span>
            <strong>{loading ? '—' : electionStats.active}</strong>
            <span className="admin-stat-footnote">Currently running</span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Scheduled</span>
            <strong>{loading ? '—' : electionStats.scheduled}</strong>
            <span className="admin-stat-footnote">Upcoming elections</span>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-label">Completed</span>
            <strong>{loading ? '—' : electionStats.completed}</strong>
            <span className="admin-stat-footnote">Ready for results review</span>
          </article>
        </section>

        <section className="admin-panel admin-results-panel">
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">RESULTS CENTRE</p>
              <h2>Candidate vote breakdown</h2>
              <p>Select a completed election to compare votes by position.</p>
            </div>
          </div>

          <label className="admin-results-select-label" htmlFor="results-election">
            Select completed election
            <select
              id="results-election"
              value={selectedResultsId}
              onChange={(event) => loadResults(event.target.value)}
              disabled={loading || completedElections.length === 0 || resultsLoading}
            >
              <option value="">Choose an election</option>
              {completedElections.map((election) => (
                <option key={election._id} value={election._id}>
                  {election.title}
                </option>
              ))}
            </select>
          </label>

          {completedElections.length === 0 && !loading && (
            <p className="admin-empty-state">
              No completed elections yet. Results become available after an
              election is completed.
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
                  <span className="admin-stat-label">Election</span>
                  <strong>{resultsData.election?.title || 'Election results'}</strong>
                </div>
                <span className="admin-status admin-status-completed">
                  Completed
                </span>
              </div>

              {Array.isArray(resultsData.results) &&
              resultsData.results.length > 0 ? (
                <>
                  <label className="admin-results-select-label" htmlFor="results-position">
                    Position
                    <select
                      id="results-position"
                      value={selectedPositionId}
                      onChange={(event) => setSelectedPositionId(event.target.value)}
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

                      {positionCandidates.candidates.length === 0 ? (
                        <p className="admin-empty-state">
                          No candidates were found for this position.
                        </p>
                      ) : (
                        <div className="admin-candidate-results">
                          {positionCandidates.candidates.map((candidate, index) => (
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
                                  <span className="admin-candidate-avatar" aria-hidden="true">
                                    {(candidate.name || '?').trim().charAt(0).toUpperCase()}
                                  </span>
                                )}

                                <div className="admin-candidate-name">
                                  <strong>{candidate.name}</strong>
                                  <span>
                                    {candidate.votes.toLocaleString()} votes
                                  </span>
                                </div>
                              </div>

                              <div className="admin-candidate-chart">
                                <div
                                  className="admin-candidate-bar-track"
                                  role="img"
                                  aria-label={`${candidate.name}: ${candidate.votes} votes, ${candidate.percentage.toFixed(1)} percent`}
                                >
                                  <div
                                    className={`admin-candidate-bar${index === 0 && candidate.votes > 0 ? ' admin-candidate-bar-leading' : ''}`}
                                    style={{
                                      width: `${candidate.percentage}%`,
                                    }}
                                  />
                                </div>
                                <strong className="admin-candidate-percentage">
                                  {candidate.percentage.toFixed(1)}%
                                </strong>
                              </div>
                            </article>
                          ))}
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

        <section className="admin-panel">
          <h2>Create an election</h2>
          <p>New elections are created as drafts.</p>

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

            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create draft election'}
            </button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-section-heading">
            <div>
              <h2>Existing elections</h2>
              <p>{elections.length} election(s) found</p>
            </div>
          </div>

          {loading ? (
            <p role="status">Loading elections…</p>
          ) : elections.length === 0 ? (
            <p className="admin-empty-state">No elections found.</p>
          ) : (
            <div className="admin-election-list">
              {elections.map((election) => {
                const status = getStatus(election)

                return (
                  <article className="admin-election-card" key={election._id}>
                    <div className="admin-election-card-top">
                      <div>
                        <h3>{election.title}</h3>
                        <p>{election.description || 'No description provided.'}</p>
                      </div>

                      <span
                        className={`admin-status admin-status-${status.replace(/\s+/g, '-')}`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="admin-election-dates">
                      <span>
                        <strong>Starts:</strong> {formatDate(election.startDate)}
                      </span>
                      <span>
                        <strong>Ends:</strong> {formatDate(election.endDate)}
                      </span>
                    </div>

                    <div className="admin-election-actions">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/elections/${election._id}`)}
                      >
                        Manage positions &amp; candidates
                      </button>

                      {String(election.status).toLowerCase() === 'draft' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => updateStatus(election, 'scheduled')}
                        >
                          Schedule
                        </button>
                      )}

                      {['scheduled', 'upcoming'].includes(
                        String(election.status).toLowerCase()
                      ) && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => updateStatus(election, 'active')}
                        >
                          Activate
                        </button>
                      )}

                      {String(election.status).toLowerCase() === 'active' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => updateStatus(election, 'completed')}
                        >
                          Complete
                        </button>
                      )}

                      {!['completed', 'cancelled'].includes(
                        String(election.status).toLowerCase()
                      ) && (
                        <button
                          type="button"
                          className="admin-button-danger"
                          disabled={saving}
                          onClick={() => updateStatus(election, 'cancelled')}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default AdminDashboard
