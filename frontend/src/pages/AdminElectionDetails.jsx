
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './AdminElectionDetails.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

const EMPTY_POSITION = {
  title: '',
  description: '',
  maxSelections: 1,
}

const EMPTY_CANDIDATE = {
  name: '',
  manifesto: '',
  photoUrl: '',
}

function getId(item) {
  return item?._id || item?.id || ''
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || data.error || `Request failed (${response.status}).`
    )
  }

  return data
}

function AdminElectionDetails() {
  const { electionId } = useParams()
  const navigate = useNavigate()

  const [token, setToken] = useState('')
  const [election, setElection] = useState(null)
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPositionId, setSelectedPositionId] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [editingPositionId, setEditingPositionId] = useState(null)
  const [editingCandidateId, setEditingCandidateId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [positionForm, setPositionForm] = useState({ ...EMPTY_POSITION })
  const [candidateForm, setCandidateForm] = useState({ ...EMPTY_CANDIDATE })

  const request = useCallback(
    async (path, options = {}) => {
      const isFormData =
        typeof FormData !== 'undefined' &&
        options.body instanceof FormData

      const headers = {
        ...(options.body && !isFormData
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
      })

      return readResponse(response)
    },
    [token]
  )

  function clearNotices() {
    setError('')
    setMessage('')
  }

  const loadElection = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [electionResponse, positionsResponse] = await Promise.all([
        request(`/elections/${electionId}`),
        request(`/positions/election/${electionId}`),
      ])

      const loadedElection =
        electionResponse.election ||
        electionResponse.data ||
        electionResponse

      const receivedPositions = Array.isArray(positionsResponse)
        ? positionsResponse
        : positionsResponse.positions ||
          positionsResponse.data?.positions ||
          []

      const loadedPositions = await Promise.all(
        receivedPositions.map(async (position) => {
          const positionId = getId(position)

          if (!positionId) {
            return {
              ...position,
              candidates: [],
              candidatesLoadError: true,
            }
          }

          try {
            const response = await request(
              `/elections/${electionId}/positions/${positionId}/candidates`
            )

            const candidates = Array.isArray(response)
              ? response
              : response.candidates ||
                response.data?.candidates ||
                []

            return {
              ...position,
              candidates,
              candidatesLoadError: false,
            }
          } catch (err) {
            console.error('Could not load candidates:', err)

            return {
              ...position,
              candidates: [],
              candidatesLoadError: true,
            }
          }
        })
      )

      setElection(loadedElection)
      setPositions(loadedPositions)

      setSelectedPositionId((currentId) => {
        if (
          loadedPositions.some(
            (position) =>
              String(getId(position)) === String(currentId)
          )
        ) {
          return currentId
        }

        return loadedPositions.length
          ? String(getId(loadedPositions[0]))
          : ''
      })

      setSelectedCandidate((current) => {
        if (!current) return null

        for (const position of loadedPositions) {
          const candidate = position.candidates.find(
            (item) => String(getId(item)) === String(getId(current))
          )

          if (candidate) return candidate
        }

        return null
      })
    } catch (err) {
      setError(err.message || 'Could not load election details.')
    } finally {
      setLoading(false)
    }
  }, [electionId, request])

  useEffect(() => {
    const savedToken = localStorage.getItem('ballottrustToken')
    const savedUser = localStorage.getItem('ballottrustUser')

    if (!savedToken || !savedUser) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const user = JSON.parse(savedUser)

      if (user.role !== 'admin') {
        navigate('/dashboard', { replace: true })
        return
      }

      setToken(savedToken)
    } catch {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (token && electionId) loadElection()
  }, [token, electionId, loadElection])

  const electionStatus =
    election?.effectiveStatus || election?.status || 'Unknown'

  const canManage = ['draft', 'scheduled'].includes(
    String(electionStatus).toLowerCase()
  )

  const totalCandidates = useMemo(
    () =>
      positions.reduce(
        (total, position) => total + (position.candidates?.length || 0),
        0
      ),
    [positions]
  )

  const selectedPosition = useMemo(
    () =>
      positions.find(
        (position) =>
          String(getId(position)) === String(selectedPositionId)
      ) || null,
    [positions, selectedPositionId]
  )

  function openTab(tab) {
    clearNotices()
    setActiveTab(tab)
  }

  function resetPositionForm() {
    setPositionForm({ ...EMPTY_POSITION })
    setEditingPositionId(null)
  }

  function resetCandidateForm() {
    setCandidateForm({ ...EMPTY_CANDIDATE })
    setEditingCandidateId(null)
  }

  function handleEditPosition(position) {
    clearNotices()
    setEditingPositionId(getId(position))
    setPositionForm({
      title: position.title || '',
      description: position.description || '',
      maxSelections: position.maxSelections ?? 1,
    })
    setActiveTab('positions')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handlePositionSubmit(event) {
    event.preventDefault()
    clearNotices()

    const payload = {
      title: positionForm.title.trim(),
      description: positionForm.description.trim(),
      maxSelections: Number(positionForm.maxSelections),
    }

    if (!payload.title) {
      setError('Position title is required.')
      return
    }

    if (
      !Number.isInteger(payload.maxSelections) ||
      payload.maxSelections < 1
    ) {
      setError('Maximum selections must be a positive whole number.')
      return
    }

    setSaving(true)

    try {
      if (editingPositionId) {
        await request(`/positions/${editingPositionId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        setMessage('Position updated successfully.')
      } else {
        await request(`/positions/election/${electionId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage('Position created successfully.')
      }

      resetPositionForm()
      await loadElection()
    } catch (err) {
      setError(err.message || 'Could not save position.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePosition(position) {
    const positionId = getId(position)

    if (!positionId) {
      setError('Position ID is missing.')
      return
    }

    if (
      !window.confirm(
        `Delete "${position.title}"? This may affect its candidates.`
      )
    ) {
      return
    }

    clearNotices()
    setDeletingId(positionId)

    try {
      await request(`/positions/${positionId}`, {
        method: 'DELETE',
      })

      if (String(editingPositionId) === String(positionId)) {
        resetPositionForm()
      }

      setMessage('Position deleted successfully.')
      await loadElection()
    } catch (err) {
      setError(err.message || 'Could not delete position.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleEditCandidate(candidate) {
    if (!canManage) {
      setError('This election does not allow candidate editing.')
      return
    }

    const candidateId = getId(candidate)

    if (!candidateId) {
      setError('Candidate ID is missing.')
      return
    }

    clearNotices()
    setEditingCandidateId(String(candidateId))
    setCandidateForm({
      name: candidate.name || '',
      manifesto: candidate.manifesto || '',
      photoUrl: candidate.photoUrl || '',
    })
    setActiveTab('candidates')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCandidateSubmit(event) {
    event.preventDefault()
    clearNotices()

    if (!selectedPositionId) {
      setError('Select a position first.')
      return
    }

    if (!candidateForm.name.trim()) {
      setError('Candidate name is required.')
      return
    }

    if (candidateForm.manifesto.trim().length > 3000) {
      setError('Manifesto cannot exceed 3000 characters.')
      return
    }

    if (!canManage) {
      setError('Candidates cannot be changed in this election status.')
      return
    }

    const payload = {
      name: candidateForm.name.trim(),
      manifesto: candidateForm.manifesto.trim(),
      photoUrl: candidateForm.photoUrl.trim(),
    }

    setSaving(true)

    try {
      const editing = Boolean(editingCandidateId)

      const endpoint = editing
        ? `/elections/${electionId}/positions/${selectedPositionId}/candidates/${editingCandidateId}`
        : `/elections/${electionId}/positions/${selectedPositionId}/candidates`

      await request(endpoint, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })

      resetCandidateForm()
      setMessage(
        editing
          ? 'Candidate updated successfully.'
          : 'Candidate added successfully.'
      )
      await loadElection()
    } catch (err) {
      setError(err.message || 'Could not save candidate.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCandidate(candidate) {
    const candidateId = getId(candidate)

    if (!candidateId || !selectedPositionId) {
      setError('Candidate or position ID is missing.')
      return
    }

    if (
      !window.confirm(
        `Delete "${candidate.name || 'this candidate'}"? This cannot be undone.`
      )
    ) {
      return
    }

    clearNotices()
    setDeletingId(candidateId)

    try {
      await request(
        `/elections/${electionId}/positions/${selectedPositionId}/candidates/${candidateId}`,
        { method: 'DELETE' }
      )

      if (String(getId(selectedCandidate)) === String(candidateId)) {
        setSelectedCandidate(null)
      }

      if (String(editingCandidateId) === String(candidateId)) {
        resetCandidateForm()
      }

      setMessage('Candidate deleted successfully.')
      await loadElection()
    } catch (err) {
      setError(err.message || 'Could not delete candidate.')
    } finally {
      setDeletingId(null)
    }
  }

  function goToCandidateManagement(position) {
    const positionId = getId(position)

    if (!positionId) {
      setError('Position ID is missing.')
      return
    }

    navigate(
      `/admin/elections/${electionId}/positions/${positionId}/candidates`
    )
  }

  if (loading && !election) {
    return (
      <main className="admin-election-page">
        <p>Loading election details...</p>
      </main>
    )
  }

  if (!election) {
    return (
      <main className="admin-election-page">
        <button
          type="button"
          className="back-button"
          onClick={() => navigate('/admin/dashboard')}
        >
          ← Back to admin dashboard
        </button>

        {error && (
          <p className="notice error-message" role="alert">
            {error}
          </p>
        )}

        <button type="button" onClick={loadElection}>
          Try again
        </button>
      </main>
    )
  }

  return (
    <main className="admin-election-page">
      <button
        type="button"
        className="back-button"
        onClick={() => navigate('/admin/dashboard')}
      >
        ← Back to admin dashboard
      </button>

      <header className="admin-election-header">
        <p className="eyebrow">BALLOTTRUST ADMIN</p>
        <h1>{election.title || 'Election details'}</h1>
        <p>{election.description || 'No description provided.'}</p>

        <span
          className={`election-status status-${String(
            electionStatus
          ).toLowerCase()}`}
        >
          {electionStatus}
        </span>
      </header>

      {error && (
        <div className="notice error-message" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="notice success-message" role="status">
          {message}
        </div>
      )}

      <div className="admin-election-layout">
        <aside className="admin-election-sidebar">
          <p className="sidebar-label">ELECTION MANAGEMENT</p>

          <button
            type="button"
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => openTab('overview')}
          >
            <span className="sidebar-icon">▦</span>
            <span>Overview</span>
          </button>

          <button
            type="button"
            className={activeTab === 'positions' ? 'active' : ''}
            onClick={() => openTab('positions')}
          >
            <span className="sidebar-icon">☷</span>
            <span>Positions</span>
            <span className="sidebar-count">{positions.length}</span>
          </button>

          <button
            type="button"
            className={activeTab === 'candidates' ? 'active' : ''}
            onClick={() => openTab('candidates')}
          >
            <span className="sidebar-icon">♙</span>
            <span>Candidates</span>
            <span className="sidebar-count">{totalCandidates}</span>
          </button>

          <div className="sidebar-election-status">
            <span>Status</span>
            <strong>{electionStatus}</strong>
          </div>
        </aside>

        <div className="admin-election-content">
          {activeTab === 'overview' && (
            <section className="admin-section overview-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">ELECTION SUMMARY</p>
                  <h2>Election overview</h2>
                  <p>
                    Review your election before managing positions and
                    candidates.
                  </p>
                </div>
              </div>

              <div className="election-summary-grid">
                <article className="summary-card">
                  <span className="summary-icon">▦</span>
                  <span>Positions</span>
                  <strong>{positions.length}</strong>
                </article>

                <article className="summary-card">
                  <span className="summary-icon">♙</span>
                  <span>Candidates</span>
                  <strong>{totalCandidates}</strong>
                </article>

                <article className="summary-card">
                  <span className="summary-icon">◷</span>
                  <span>Election status</span>
                  <strong className="summary-status">{electionStatus}</strong>
                </article>
              </div>

              <div className="election-information">
                <h3>Election information</h3>

                <dl>
                  <div>
                    <dt>Title</dt>
                    <dd>{election.title || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Description</dt>
                    <dd>{election.description || 'No description provided.'}</dd>
                  </div>
                  <div>
                    <dt>Start date</dt>
                    <dd>
                      {election.startDate
                        ? new Date(election.startDate).toLocaleString()
                        : 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt>End date</dt>
                    <dd>
                      {election.endDate
                        ? new Date(election.endDate).toLocaleString()
                        : 'Not specified'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="overview-actions">
                <button type="button" onClick={() => openTab('positions')}>
                  Manage positions →
                </button>
                <button type="button" onClick={() => openTab('candidates')}>
                  Manage candidates →
                </button>
              </div>
            </section>
          )}

          {activeTab === 'positions' && (
            <>
              <section className="admin-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">POSITION SETUP</p>
                    <h2>{editingPositionId ? 'Edit position' : 'Add a position'}</h2>
                  </div>
                </div>

                {!canManage ? (
                  <p>
                    Positions can only be changed while the election is in
                    draft or scheduled status.
                  </p>
                ) : (
                  <form onSubmit={handlePositionSubmit} className="admin-form">
                    <label>
                      Position title
                      <input
                        type="text"
                        value={positionForm.title}
                        onChange={(event) =>
                          setPositionForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="e.g. President"
                        maxLength={100}
                        required
                      />
                    </label>

                    <label>
                      Description
                      <textarea
                        value={positionForm.description}
                        onChange={(event) =>
                          setPositionForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Describe the position"
                        maxLength={500}
                        rows={3}
                      />
                    </label>

                    <label>
                      Maximum selections
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={positionForm.maxSelections}
                        onChange={(event) =>
                          setPositionForm((current) => ({
                            ...current,
                            maxSelections: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <div className="form-actions">
                      <button type="submit" disabled={saving}>
                        {saving
                          ? 'Saving...'
                          : editingPositionId
                            ? 'Save changes'
                            : 'Add position'}
                      </button>

                      {editingPositionId && (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={saving}
                          onClick={resetPositionForm}
                        >
                          Cancel editing
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </section>

              <section className="admin-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">YOUR ELECTION</p>
                    <h2>Manage positions</h2>
                    <p>{positions.length} position(s)</p>
                  </div>
                </div>

                {positions.length === 0 ? (
                  <div className="empty-state">
                    <h3>No positions yet</h3>
                    <p>Add your first position using the form above.</p>
                  </div>
                ) : (
                  <div className="positions-list">
                    {positions.map((position) => {
                      const positionId = getId(position)
                      const candidates = position.candidates || []

                      return (
                        <article className="position-card" key={positionId}>
                          <div className="position-card-heading">
                            <div>
                              <h3>{position.title || 'Untitled position'}</h3>
                              <p>
                                {position.description || 'No description provided.'}
                              </p>
                            </div>

                            <span className="count-pill">
                              {candidates.length}{' '}
                              {candidates.length === 1 ? 'candidate' : 'candidates'}
                            </span>
                          </div>

                          <p>
                            Maximum selections:{' '}
                            <strong>{position.maxSelections ?? 1}</strong>
                          </p>

                          {position.candidatesLoadError && (
                            <p className="candidate-load-warning">
                              Candidate data could not be loaded for this position.
                            </p>
                          )}

                          <div className="position-actions">
                            <button
                              type="button"
                              onClick={() => goToCandidateManagement(position)}
                            >
                              Manage candidates →
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setSelectedPositionId(String(positionId))
                                openTab('candidates')
                              }}
                            >
                              View in this page
                            </button>

                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => handleEditPosition(position)}
                                >
                                  Edit position
                                </button>

                                <button
                                  type="button"
                                  className="danger-button"
                                  disabled={deletingId === positionId}
                                  onClick={() => handleDeletePosition(position)}
                                >
                                  {deletingId === positionId
                                    ? 'Deleting...'
                                    : 'Delete position'}
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === 'candidates' && (
            <section className="admin-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CANDIDATE MANAGEMENT</p>
                  <h2>Manage candidates</h2>
                  <p>View and manage candidates for each position.</p>
                </div>
              </div>

              {positions.length === 0 ? (
                <div className="empty-state">
                  <h3>No positions available</h3>
                  <p>Create a position before adding candidates.</p>
                  <button type="button" onClick={() => openTab('positions')}>
                    Go to positions
                  </button>
                </div>
              ) : (
                <>
                  <label className="position-selector">
                    Select position
                    <select
                      value={selectedPositionId}
                      onChange={(event) => {
                        setSelectedPositionId(event.target.value)
                        resetCandidateForm()
                        setSelectedCandidate(null)
                        clearNotices()
                      }}
                    >
                      {positions.map((position) => (
                        <option key={getId(position)} value={String(getId(position))}>
                          {position.title || 'Untitled position'}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedPosition && (
                    <>
                      <div className="candidate-position-summary">
                        <h3>{selectedPosition.title}</h3>
                        <p>
                          {selectedPosition.description ||
                            'No position description provided.'}
                        </p>
                        <span className="count-pill">
                          {selectedPosition.candidates.length}{' '}
                          {selectedPosition.candidates.length === 1
                            ? 'candidate'
                            : 'candidates'}
                        </span>
                      </div>

                      {selectedPosition.candidatesLoadError && (
                        <p className="candidate-load-warning">
                          Candidates could not be loaded. Refresh election data
                          and try again.
                        </p>
                      )}

                      {selectedPosition.candidates.length === 0 ? (
                        <div className="empty-state">
                          <h3>No candidates yet</h3>
                          <p>Add the first candidate using the form below.</p>
                        </div>
                      ) : (
                        <div className="candidate-list">
                          {selectedPosition.candidates.map((candidate) => {
                            const candidateId = getId(candidate)

                            return (
                              <article className="candidate-card" key={candidateId}>
                                <div className="candidate-card-main">
                                  {candidate.photoUrl ? (
                                    <img
                                      className="candidate-photo"
                                      src={candidate.photoUrl}
                                      alt={`${candidate.name || 'Candidate'} portrait`}
                                      loading="lazy"
                                      onError={(event) => {
                                        event.currentTarget.style.display = 'none'
                                      }}
                                    />
                                  ) : (
                                    <div className="candidate-photo-placeholder">
                                      {(candidate.name || 'C').trim().charAt(0).toUpperCase()}
                                    </div>
                                  )}

                                  <div className="candidate-card-info">
                                    <h3>{candidate.name || 'Unnamed candidate'}</h3>
                                    <p className="candidate-manifesto-preview">
                                      {candidate.manifesto
                                        ? candidate.manifesto.length > 180
                                          ? `${candidate.manifesto.slice(0, 180)}...`
                                          : candidate.manifesto
                                        : 'No manifesto provided.'}
                                    </p>
                                  </div>
                                </div>

                                <div className="candidate-card-actions">
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => setSelectedCandidate(candidate)}
                                  >
                                    View details
                                  </button>

                                  {canManage && (
                                    <>
                                      <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => handleEditCandidate(candidate)}
                                      >
                                        Edit candidate
                                      </button>

                                      <button
                                        type="button"
                                        className="danger-button"
                                        disabled={
                                          saving ||
                                          String(deletingId) === String(candidateId)
                                        }
                                        onClick={() => handleDeleteCandidate(candidate)}
                                      >
                                        {String(deletingId) === String(candidateId)
                                          ? 'Deleting...'
                                          : 'Delete candidate'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      )}

                      {canManage && (
                        <form
                          className="admin-form candidate-form"
                          onSubmit={handleCandidateSubmit}
                        >
                          <h3>{editingCandidateId ? 'Edit candidate' : 'Add candidate'}</h3>
                          <p>
                            Position: <strong>{selectedPosition.title}</strong>
                          </p>

                          <label>
                            Candidate name
                            <input
                              type="text"
                              value={candidateForm.name}
                              onChange={(event) =>
                                setCandidateForm((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                              placeholder="Full name"
                              maxLength={120}
                              required
                            />
                          </label>

                          <label>
                            Manifesto
                            <textarea
                              value={candidateForm.manifesto}
                              onChange={(event) =>
                                setCandidateForm((current) => ({
                                  ...current,
                                  manifesto: event.target.value,
                                }))
                              }
                              placeholder="Candidate's manifesto"
                              maxLength={3000}
                              rows={4}
                            />
                          </label>

                          <label>
                            Candidate photo URL
                            <input
                              type="url"
                              value={candidateForm.photoUrl}
                              onChange={(event) =>
                                setCandidateForm((current) => ({
                                  ...current,
                                  photoUrl: event.target.value,
                                }))
                              }
                              placeholder="https://example.com/photo.jpg"
                            />
                          </label>

                          <div className="candidate-form-actions">
                            <button type="submit" disabled={saving}>
                              {saving
                                ? 'Saving...'
                                : editingCandidateId
                                  ? 'Save candidate changes'
                                  : 'Add candidate'}
                            </button>

                            {editingCandidateId && (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={saving}
                                onClick={resetCandidateForm}
                              >
                                Cancel editing
                              </button>
                            )}
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </>
              )}

              {selectedCandidate && (
                <div
                  className="candidate-modal-backdrop"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                      setSelectedCandidate(null)
                    }
                  }}
                >
                  <section
                    className="candidate-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="candidate-modal-title"
                  >
                    <button
                      type="button"
                      className="candidate-modal-close secondary-button"
                      onClick={() => setSelectedCandidate(null)}
                    >
                      Close
                    </button>

                    <p className="eyebrow">CANDIDATE PROFILE</p>
                    <h2 id="candidate-modal-title">
                      {selectedCandidate.name || 'Unnamed candidate'}
                    </h2>
                    <p className="candidate-modal-position">
                      Position: {selectedPosition?.title || 'Not specified'}
                    </p>

                    {selectedCandidate.photoUrl && (
                      <img
                        className="candidate-modal-photo"
                        src={selectedCandidate.photoUrl}
                        alt={`${selectedCandidate.name || 'Candidate'} portrait`}
                      />
                    )}

                    <h3>Manifesto</h3>
                    <p className="candidate-modal-manifesto">
                      {selectedCandidate.manifesto || 'No manifesto provided.'}
                    </p>
                  </section>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="admin-election-footer">
        <span>BallotTrust Admin Console</span>
        <button
          type="button"
          className="secondary-button"
          onClick={loadElection}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh election data'}
        </button>
      </footer>
    </main>
  )
}

export default AdminElectionDetails
