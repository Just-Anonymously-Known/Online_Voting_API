
import { useCallback, useEffect, useState } from 'react'
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
}

function AdminElectionDetails() {
  const { electionId } = useParams()
  const navigate = useNavigate()

  const [token, setToken] = useState('')
  const [election, setElection] = useState(null)
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [positionForm, setPositionForm] = useState({
    ...emptyPositionForm,
  })

  const [candidateForms, setCandidateForms] = useState({})

  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
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

      setElection(electionData.election || electionData)

      const receivedPositions = Array.isArray(positionsData)
        ? positionsData
        : positionsData.positions || []

      setPositions(receivedPositions)
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

  function resetPositionForm() {
    setPositionForm({ ...emptyPositionForm })
    setEditingId(null)
  }

  async function handlePositionSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const payload = {
        title: positionForm.title.trim(),
        description: positionForm.description.trim(),
        maxSelections: Number(positionForm.maxSelections),
      }

      if (!payload.title) {
        throw new Error('Position title is required.')
      }

      if (
        !Number.isInteger(payload.maxSelections) ||
        payload.maxSelections < 1
      ) {
        throw new Error('Maximum selections must be a positive whole number.')
      }

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

  function handleEditPosition(position) {
    setEditingId(position._id || position.id)
    setPositionForm({
      title: position.title || '',
      description: position.description || '',
      maxSelections: position.maxSelections ?? 1,
    })

    setError('')
    setMessage('')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDeletePosition(position) {
    const positionId = position._id || position.id

    if (!positionId) {
      setError('This position does not have a valid ID.')
      return
    }

    const confirmed = window.confirm(
      `Delete "${position.title}"? This cannot be undone.`,
    )

    if (!confirmed) return

    setError('')
    setMessage('')
    setDeletingId(positionId)

    try {
      await request(`/positions/${positionId}`, {
        method: 'DELETE',
      })

      if (editingId === positionId) {
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

  async function handleAddCandidate(event, positionId) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    const form = candidateForms[positionId] || {
      ...emptyCandidateForm,
    }

    try {
      /*
       * Preserves your existing candidate endpoint.
       * This endpoint must exist in your backend for candidate creation
       * to work.
       */
      await request(
        `/elections/${electionId}/positions/${positionId}/candidates`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            manifesto: form.manifesto.trim(),
          }),
        },
      )

      setCandidateForms((current) => ({
        ...current,
        [positionId]: { ...emptyCandidateForm },
      }))

      setMessage('Candidate added successfully.')
      await loadElection()
    } catch (err) {
      setError(err.message || 'Could not add candidate.')
    } finally {
      setSaving(false)
    }
  }

  function updateCandidateForm(positionId, field, value) {
    setCandidateForms((current) => ({
      ...current,
      [positionId]: {
        ...emptyCandidateForm,
        ...current[positionId],
        [field]: value,
      },
    }))
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
          onClick={() => navigate('/admin/dashboard')}
        >
          ← Back to dashboard
        </button>
        <p className="notice error-message">
          {error || 'Election not found.'}
        </p>
      </main>
    )
  }

  const electionStatus = election.effectiveStatus || election.status || 'Unknown'
  const canManagePositions = ['draft', 'scheduled'].includes(
    String(electionStatus).toLowerCase(),
  )

  return (
    <main className="admin-election-page">
      <button
        className="back-button"
        onClick={() => navigate('/admin/dashboard')}
      >
        ← Back to admin dashboard
      </button>

      <header className="admin-election-header">
        <p className="eyebrow">BALLOTTRUST ADMIN</p>
        <h1>{election.title || 'Election details'}</h1>
        <p>{election.description || 'No description provided.'}</p>
        <p>
          Status: <strong>{electionStatus}</strong>
        </p>
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

      <section className="admin-section">
        <h2>{editingId ? 'Edit position' : 'Add a position'}</h2>

        {!canManagePositions ? (
          <p>
            Positions can only be created or edited while the election is in
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
                className="back-button"
                disabled={saving}
                onClick={resetPositionForm}
              >
                Cancel editing
              </button>
            )}
          </form>
        )}
      </section>

      <section className="admin-section">
        <h2>Positions and candidates</h2>

        {positions.length === 0 ? (
          <p>No positions have been added to this election yet.</p>
        ) : (
          <div className="positions-list">
            {positions.map((position) => {
              const positionId = position._id || position.id
              const candidates = Array.isArray(position.candidates)
                ? position.candidates
                : []

              return (
                <article className="position-card" key={positionId}>
                  <h3>{position.title || 'Untitled position'}</h3>

                  {position.description && <p>{position.description}</p>}

                  <p>
                    Maximum selections:{' '}
                    <strong>{position.maxSelections ?? 1}</strong>
                  </p>

                  {canManagePositions && (
                    <div className="position-actions">
                      <button
                        type="button"
                        onClick={() => handleEditPosition(position)}
                        disabled={saving || deletingId === positionId}
                      >
                        Edit position
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePosition(position)}
                        disabled={saving || deletingId === positionId}
                      >
                        {deletingId === positionId
                          ? 'Deleting...'
                          : 'Delete position'}
                      </button>
                    </div>
                  )}

                  <h4>Candidates</h4>

                  {candidates.length === 0 ? (
                    <p>
                      Candidate records are not included in the current
                      positions response.
                    </p>
                  ) : (
                    <ul>
                      {candidates.map((candidate) => (
                        <li key={candidate._id || candidate.id}>
                          <strong>{candidate.name}</strong>
                          {candidate.manifesto && <p>{candidate.manifesto}</p>}
                        </li>
                      ))}
                    </ul>
                  )}

                  <form
                    className="admin-form candidate-form"
                    onSubmit={(event) =>
                      handleAddCandidate(event, positionId)
                    }
                  >
                    <h4>Add candidate</h4>

                    <label>
                      Candidate name
                      <input
                        type="text"
                        value={candidateForms[positionId]?.name || ''}
                        onChange={(event) =>
                          updateCandidateForm(
                            positionId,
                            'name',
                            event.target.value,
                          )
                        }
                        placeholder="Full name"
                        maxLength={120}
                        required
                      />
                    </label>

                    <label>
                      Manifesto
                      <textarea
                        value={candidateForms[positionId]?.manifesto || ''}
                        onChange={(event) =>
                          updateCandidateForm(
                            positionId,
                            'manifesto',
                            event.target.value,
                          )
                        }
                        placeholder="Candidate's manifesto (optional)"
                        maxLength={3000}
                        rows={3}
                      />
                    </label>

                    <button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Add candidate'}
                    </button>
                  </form>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

export default AdminElectionDetails
