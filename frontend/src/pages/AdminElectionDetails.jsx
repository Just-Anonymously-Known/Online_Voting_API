
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './AdminElectionDetails.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

function AdminElectionDetails() {
  const { electionId } = useParams()
  const navigate = useNavigate()

  const [token, setToken] = useState('')
  const [election, setElection] = useState(null)
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [positionForm, setPositionForm] = useState({
    title: '',
    description: '',
  })

  const [candidateForms, setCandidateForms] = useState({})

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed.')
    }

    return data
  }, [token])

  const loadElection = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [electionData, positionsData] = await Promise.all([
        request(`/elections/${electionId}`),
        request(`/elections/${electionId}/positions`),
      ])

      setElection(electionData.election || electionData)
      setPositions(
        Array.isArray(positionsData)
          ? positionsData
          : positionsData.positions || []
      )
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
    if (token) loadElection()
  }, [token, loadElection])

  async function handleAddPosition(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      await request(`/elections/${electionId}/positions`, {
        method: 'POST',
        body: JSON.stringify(positionForm),
      })

      setPositionForm({ title: '', description: '' })
      setMessage('Position added successfully.')
      await loadElection()
    } catch (err) {
      setError(err.message || 'Could not add position.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCandidate(event, positionId) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    const form = candidateForms[positionId] || {
      name: '',
      manifesto: '',
    }

    try {
      await request(
        `/elections/${electionId}/positions/${positionId}/candidates`,
        {
          method: 'POST',
          body: JSON.stringify(form),
        }
      )

      setCandidateForms((current) => ({
        ...current,
        [positionId]: { name: '', manifesto: '' },
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
        name: '',
        manifesto: '',
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
        <button onClick={() => navigate('/admin/dashboard')}>
          Back to dashboard
        </button>
        <p className="error-message">{error || 'Election not found.'}</p>
      </main>
    )
  }

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
        <h1>{election.title}</h1>
        <p>{election.description || 'No description provided.'}</p>
        <p>
          Status: <strong>{election.effectiveStatus || election.status}</strong>
        </p>
      </header>

      {error && <div className="notice error-message">{error}</div>}
      {message && <div className="notice success-message">{message}</div>}

      <section className="admin-section">
        <h2>Add a position</h2>
        <form onSubmit={handleAddPosition} className="admin-form">
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
              rows="3"
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add position'}
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>Positions and candidates</h2>

        {positions.length === 0 ? (
          <p>No positions have been added to this election yet.</p>
        ) : (
          <div className="positions-list">
            {positions.map((position) => {
              const positionId = position._id || position.id
              const candidates = position.candidates || []

              return (
                <article className="position-card" key={positionId}>
                  <h3>{position.title || position.name}</h3>
                  {position.description && <p>{position.description}</p>}

                  <h4>Candidates</h4>

                  {candidates.length === 0 ? (
                    <p>No candidates listed for this position yet.</p>
                  ) : (
                    <ul>
                      {candidates.map((candidate) => (
                        <li key={candidate._id || candidate.id}>
                          <strong>{candidate.name}</strong>
                          {candidate.manifesto && (
                            <p>{candidate.manifesto}</p>
                          )}
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
                            event.target.value
                          )
                        }
                        placeholder="Full name"
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
                            event.target.value
                          )
                        }
                        placeholder="Candidate's manifesto (optional)"
                        rows="3"
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
