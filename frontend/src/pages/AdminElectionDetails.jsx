import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './AdminElectionDetails.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

const emptyPositionForm = {
  title: '',
  description: '',
  maxSelections: 1,
}

const emptyCandidateForm = {
  name: '',
  manifesto: '',
  photo: null,
  flyer: null,
  manifestoImages: [],
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
  const [editingId, setEditingId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPositionId, setSelectedPositionId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [positionForm, setPositionForm] = useState({ ...emptyPositionForm })
  const [candidateForm, setCandidateForm] = useState({ ...emptyCandidateForm })

  const request = useCallback(
    async (path, options = {}) => {
      const isFormData =
        typeof FormData !== 'undefined' && options.body instanceof FormData

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

      const data = await response.json().catch(() => ({}))

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message || data.error || `Request failed (${response.status}).`,
        )
      }

      return data
    },
    [token],
  )

  const loadElection = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [electionData, positionsData] = await Promise.all([
        request(`/elections/${electionId}`),
        request(`/positions/election/${electionId}`),
      ])

      const loadedElection = electionData.election || electionData
      const receivedPositions = Array.isArray(positionsData)
        ? positionsData
        : positionsData.positions || []

      const positionsWithCandidates = await Promise.all(
        receivedPositions.map(async (position) => {
          const positionId = position._id || position.id

          if (!positionId) {
            return {
              ...position,
              candidates: [],
              candidatesLoadError: true,
            }
          }

          try {
            const candidateData = await request(
              `/elections/${electionId}/positions/${positionId}/candidates`,
            )

            return {
              ...position,
              candidates: Array.isArray(candidateData)
                ? candidateData
                : candidateData.candidates || [],
              candidatesLoadError: false,
            }
          } catch (candidateError) {
            console.error(
              `Could not load candidates for position ${positionId}:`,
              candidateError,
            )

            return {
              ...position,
              candidates: [],
              candidatesLoadError: true,
            }
          }
        }),
      )

      setElection(loadedElection)
      setPositions(positionsWithCandidates)

      setSelectedPositionId((currentId) => {
        const stillExists = positionsWithCandidates.some(
          (position) => String(position._id || position.id) === currentId,
        )

        if (stillExists) return currentId

        const firstPosition = positionsWithCandidates[0]
        return firstPosition
          ? String(firstPosition._id || firstPosition.id)
          : ''
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
    if (token && electionId) {
      loadElection()
    }
  }, [token, electionId, loadElection])

  const electionStatus =
    election?.effectiveStatus || election?.status || 'Unknown'

  const canManagePositions = ['draft', 'scheduled'].includes(
    String(electionStatus).toLowerCase(),
  )

  const totalCandidates = useMemo(
    () =>
      positions.reduce(
        (total, position) =>
          total + (Array.isArray(position.candidates) ? position.candidates.length : 0),
        0,
      ),
    [positions],
  )

  const selectedPosition = useMemo(
    () =>
      positions.find(
        (position) =>
          String(position._id || position.id) === selectedPositionId,
      ) || null,
    [positions, selectedPositionId],
  )

  function clearNotices() {
    setError('')
    setMessage('')
  }

  function resetPositionForm() {
    setPositionForm({ ...emptyPositionForm })
    setEditingId(null)
  }

  function handleEditPosition(position) {
    setEditingId(position._id || position.id)
    setPositionForm({
      title: position.title || '',
      description: position.description || '',
      maxSelections: position.maxSelections ?? 1,
    })
    clearNotices()
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
      if (editingId) {
        await request(`/positions/${editingId}`, {
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
    const positionId = position._id || position.id

    if (!positionId) {
      setError('This position does not have a valid ID.')
      return
    }

    const confirmed = window.confirm(
      `Delete "${position.title}"? Make sure this is the correct position.`,
    )

    if (!confirmed) return

    clearNotices()
    setDeletingId(positionId)

    try {
      await request(`/positions/${positionId}`, { method: 'DELETE' })

      if (editingId === positionId) resetPositionForm()

      setMessage('Position deleted successfully.')
      await loadElection()
    } catch (err) {
      setError(err.message || 'Could not delete position.')
    } finally {
      setDeletingId(null)
    }
  }

  function updateCandidateForm(field, value) {
    setCandidateForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleManifestoImagesChange(fileList) {
    const files = Array.from(fileList || [])

    if (files.length > 5) {
      setError('Select no more than 5 manifesto images.')
      updateCandidateForm('manifestoImages', files.slice(0, 5))
      return
    }

    setError('')
    updateCandidateForm('manifestoImages', files)
  }

  async function handleAddCandidate(event) {
    event.preventDefault()
    clearNotices()

    if (!selectedPositionId) {
      setError('Select a position before adding a candidate.')
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

    if (candidateForm.manifestoImages.length > 5) {
      setError('You can upload a maximum of 5 manifesto images.')
      return
    }

    setSaving(true)

    try {
      const body = new FormData()
      body.append('name', candidateForm.name.trim())
      body.append('manifesto', candidateForm.manifesto.trim())

      if (candidateForm.photo) {
        body.append('photo', candidateForm.photo)
      }

      if (candidateForm.flyer) {
        body.append('flyer', candidateForm.flyer)
      }

      candidateForm.manifestoImages.forEach((file) => {
        body.append('manifestoImages', file)
      })

      await request(
        `/elections/${electionId}/positions/${selectedPositionId}/candidates`,
        {
          method: 'POST',
          body,
        },
      )

      setCandidateForm({ ...emptyCandidateForm })
      setMessage('Candidate added successfully.')
      await loadElection()
    } catch (err) {
      setError(err.message || 'Could not add candidate.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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
          className="back-button"
          type="button"
          onClick={() => navigate('/admin/dashboard')}
        >
          ← Back to admin dashboard
        </button>
        <p className="notice error-message">
          {error || 'Election not found.'}
        </p>
      </main>
    )
  }

  return (
    <main className="admin-election-page">
      <button
        className="back-button"
        type="button"
        onClick={() => navigate('/admin/dashboard')}
      >
        ← Back to admin dashboard
      </button>

      <header className="admin-election-header">
        <p className="eyebrow">BALLOTTRUST ADMIN</p>
        <h1>{election.title || 'Election details'}</h1>
        <p>{election.description || 'No description provided.'}</p>
        <span
          className={`election-status status-${String(electionStatus).toLowerCase()}`}
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

      <nav className="election-tabs" aria-label="Election management sections">
        <button
          type="button"
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => {
            clearNotices()
            setActiveTab('overview')
          }}
        >
          Overview
        </button>
        <button
          type="button"
          className={activeTab === 'positions' ? 'active' : ''}
          onClick={() => {
            clearNotices()
            setActiveTab('positions')
          }}
        >
          Positions
          <span>{positions.length}</span>
        </button>
        <button
          type="button"
          className={activeTab === 'candidates' ? 'active' : ''}
          onClick={() => {
            clearNotices()
            setActiveTab('candidates')
          }}
        >
          Candidates
          <span>{totalCandidates}</span>
        </button>
      </nav>

      {activeTab === 'overview' && (
        <section className="admin-section overview-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ELECTION SUMMARY</p>
              <h2>Election overview</h2>
              <p>Review the election before managing positions and candidates.</p>
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
            <button
              type="button"
              onClick={() => setActiveTab('positions')}
            >
              Manage positions →
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('candidates')}
            >
              View candidates →
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
                <h2>{editingId ? 'Edit position' : 'Add a position'}</h2>
              </div>
            </div>

            {!canManagePositions ? (
              <p>
                Positions can only be created or edited while the election is
                in draft or scheduled status.
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
                    placeholder="Describe the position (optional)"
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
                      : editingId
                        ? 'Save changes'
                        : 'Add position'}
                  </button>

                  {editingId && (
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
                <p>{positions.length} position(s) in this election</p>
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
                  const positionId = position._id || position.id
                  const candidates = Array.isArray(position.candidates)
                    ? position.candidates
                    : []

                  return (
                    <article className="position-card" key={positionId}>
                      <div className="position-card-heading">
                        <div>
                          <h3>{position.title || 'Untitled position'}</h3>
                          <p>
                            {position.description ||
                              'No description provided.'}
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
                          Candidate data could not be loaded for this
                          position. Try refreshing the page.
                        </p>
                      )}

                      <div className="position-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPositionId(String(positionId))
                            setActiveTab('candidates')
                            clearNotices()
                          }}
                        >
                          View candidates
                        </button>

                        {canManagePositions && (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => handleEditPosition(position)}
                              disabled={saving || deletingId === positionId}
                            >
                              Edit position
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => handleDeletePosition(position)}
                              disabled={saving || deletingId === positionId}
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
              <h2>Candidates</h2>
              <p>Browse candidate profiles and their campaign materials.</p>
            </div>
          </div>

          {positions.length === 0 ? (
            <div className="empty-state">
              <h3>Create a position first</h3>
              <p>
                Candidates must belong to a position. Create one in the
                Positions tab before adding candidates.
              </p>
              <button type="button" onClick={() => setActiveTab('positions')}>
                Go to positions
              </button>
            </div>
          ) : (
            <>
              <label className="position-filter">
                Filter by position
                <select
                  value={selectedPositionId}
                  onChange={(event) => setSelectedPositionId(event.target.value)}
                >
                  {positions.map((position) => (
                    <option
                      key={position._id || position.id}
                      value={String(position._id || position.id)}
                    >
                      {position.title || 'Untitled position'}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPosition && (
                <>
                  <div className="candidate-list-heading">
                    <div>
                      <h3>{selectedPosition.title}</h3>
                      <p>
                        {selectedPosition.candidates.length}{' '}
                        {selectedPosition.candidates.length === 1
                          ? 'candidate'
                          : 'candidates'}
                      </p>
                    </div>
                  </div>

                  {selectedPosition.candidatesLoadError && (
                    <p className="notice error-message">
                      Candidate data could not be loaded. Refresh the page to
                      try again.
                    </p>
                  )}

                  {selectedPosition.candidates.length === 0 ? (
                    <div className="empty-state">
                      <h3>No candidates for this position yet</h3>
                      <p>Add a candidate using the form below.</p>
                    </div>
                  ) : (
                    <div className="candidate-list">
                      {selectedPosition.candidates.map((candidate) => (
                        <article
                          className="candidate-card"
                          key={candidate._id || candidate.id}
                        >
                          <div className="candidate-summary">
                            {candidate.photoUrl ? (
                              <img
                                className="candidate-photo"
                                src={candidate.photoUrl}
                                alt={`${candidate.name || 'Candidate'} portrait`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="candidate-photo candidate-photo-placeholder">
                                No photo
                              </div>
                            )}

                            <div className="candidate-details">
                              <h4>{candidate.name || 'Unnamed candidate'}</h4>
                              <p className="candidate-manifesto">
                                {candidate.manifesto ||
                                  'No manifesto provided.'}
                              </p>
                            </div>
                          </div>

                          {candidate.flyerUrl && (
                            <div className="candidate-media-block">
                              <h5>Campaign flyer</h5>
                              <a
                                href={candidate.flyerUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  className="candidate-flyer"
                                  src={candidate.flyerUrl}
                                  alt={`${candidate.name || 'Candidate'} campaign flyer`}
                                  loading="lazy"
                                />
                              </a>
                            </div>
                          )}

                          {Array.isArray(candidate.manifestoImages) &&
                            candidate.manifestoImages.length > 0 && (
                              <div className="candidate-media-block">
                                <h5>Manifesto images</h5>
                                <div className="manifesto-image-grid">
                                  {candidate.manifestoImages.map(
                                    (imageUrl, index) => (
                                      <a
                                        href={imageUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        key={`${imageUrl}-${index}`}
                                      >
                                        <img
                                          src={imageUrl}
                                          alt={`${candidate.name || 'Candidate'} manifesto image ${index + 1}`}
                                          loading="lazy"
                                        />
                                      </a>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                        </article>
                      ))}
                    </div>
                  )}

                  {canManagePositions && (
                    <form
                      className="admin-form candidate-form"
                      onSubmit={handleAddCandidate}
                    >
                      <h3>Add candidate</h3>
                      <p>
                        Adding a candidate to:{' '}
                        <strong>{selectedPosition.title}</strong>
                      </p>

                      <label>
                        Candidate name
                        <input
                          type="text"
                          value={candidateForm.name}
                          onChange={(event) =>
                            updateCandidateForm('name', event.target.value)
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
                            updateCandidateForm('manifesto', event.target.value)
                          }
                          placeholder="Candidate's manifesto (optional)"
                          maxLength={3000}
                          rows={4}
                        />
                      </label>

                      <label>
                        Candidate photo (optional)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            updateCandidateForm(
                              'photo',
                              event.target.files?.[0] || null,
                            )
                          }
                        />
                        {candidateForm.photo && (
                          <span className="file-selection">
                            Selected: {candidateForm.photo.name}
                          </span>
                        )}
                      </label>

                      <label>
                        Campaign flyer (optional)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            updateCandidateForm(
                              'flyer',
                              event.target.files?.[0] || null,
                            )
                          }
                        />
                        {candidateForm.flyer && (
                          <span className="file-selection">
                            Selected: {candidateForm.flyer.name}
                          </span>
                        )}
                      </label>

                      <label>
                        Manifesto images (up to 5, optional)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(event) =>
                            handleManifestoImagesChange(event.target.files)
                          }
                        />
                        <span className="field-help">
                          JPEG, PNG or WebP. Maximum 5 MB per image.
                        </span>
                        {candidateForm.manifestoImages.length > 0 && (
                          <span className="file-selection">
                            Selected:{' '}
                            {candidateForm.manifestoImages
                              .map((file) => file.name)
                              .join(', ')}
                          </span>
                        )}
                      </label>

                      <button type="submit" disabled={saving}>
                        {saving ? 'Uploading candidate...' : 'Add candidate'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

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