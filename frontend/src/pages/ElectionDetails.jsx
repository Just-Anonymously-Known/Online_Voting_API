
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './ElectionDetails.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

function ElectionDetails() {
  const { electionId } = useParams()
  const navigate = useNavigate()

  const [election, setElection] = useState(null)
  const [positions, setPositions] = useState([])
  const [candidatesByPosition, setCandidatesByPosition] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('ballottrustToken')
    const savedUser = localStorage.getItem('ballottrustUser')

    if (!token || !savedUser) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const user = JSON.parse(savedUser)

      if (user.role !== 'voter') {
        navigate(
          user.role === 'admin' ? '/admin/dashboard' : '/login',
          { replace: true },
        )
        return
      }
    } catch {
      localStorage.removeItem('ballottrustToken')
      localStorage.removeItem('ballottrustUser')
      navigate('/login', { replace: true })
      return
    }

    const loadElection = async () => {
      try {
        setLoading(true)
        setError('')

        const electionResponse = await fetch(
          `${API_URL}/elections/${electionId}`,
        )
        const electionData = await electionResponse.json()

        if (!electionResponse.ok) {
          throw new Error(
            electionData.message || 'Unable to load this election.',
          )
        }

        const electionRecord =
          electionData.election || electionData.data || electionData

        setElection(electionRecord)

        const positionsResponse = await fetch(
          `${API_URL}/elections/${electionId}/positions`,
        )
        const positionsData = await positionsResponse.json()

        if (!positionsResponse.ok) {
          throw new Error(
            positionsData.message || 'Unable to load election positions.',
          )
        }

        const positionRecords = Array.isArray(positionsData.positions)
          ? positionsData.positions
          : []

        setPositions(positionRecords)

        const candidateEntries = await Promise.all(
          positionRecords.map(async (position) => {
            const response = await fetch(
              `${API_URL}/elections/${electionId}/positions/${position._id}/candidates`,
            )
            const data = await response.json()

            if (!response.ok) {
              throw new Error(
                data.message || `Unable to load candidates for ${position.title}.`,
              )
            }

            return [
              position._id,
              Array.isArray(data.candidates) ? data.candidates : [],
            ]
          }),
        )

        setCandidatesByPosition(Object.fromEntries(candidateEntries))
      } catch (err) {
        setError(err.message || 'Could not load election details.')
      } finally {
        setLoading(false)
      }
    }

    loadElection()
  }, [electionId, navigate])

  const formatDate = (value) => {
    if (!value) return 'Not specified'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return 'Not specified'

    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  const formatStatus = (status) => {
    if (!status) return 'Unknown'

    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  if (loading) {
    return (
      <main className="election-details-page">
        <p className="election-details-message" role="status">
          Loading election details...
        </p>
      </main>
    )
  }

  if (error || !election) {
    return (
      <main className="election-details-page">
        <div className="election-details-error" role="alert">
          <h1>Unable to open election</h1>
          <p>{error || 'Election not found.'}</p>
          <button type="button" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="election-details-page">
      <header className="election-details-header">
        <button
          className="election-back-button"
          type="button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to elections
        </button>

        <span className="election-details-brand">
          <span className="election-details-brand-icon">B</span>
          BallotTrust
        </span>
      </header>

      <section className="election-details-content">
        <div className="election-details-hero">
          <span
            className={`election-details-status status-${(
              election.status || 'unknown'
            ).toLowerCase()}`}
          >
            {formatStatus(election.status)}
          </span>

          <h1>{election.title}</h1>

          <p>
            {election.description || 'No description provided.'}
          </p>

          <div className="election-details-dates">
            <div>
              <span>Election starts</span>
              <strong>{formatDate(election.startDate)}</strong>
            </div>

            <div>
              <span>Election ends</span>
              <strong>{formatDate(election.endDate)}</strong>
            </div>
          </div>
        </div>

        <section className="election-positions-section">
          <div className="election-positions-heading">
            <h2>Positions and candidates</h2>
            <p>Review the candidates participating in this election.</p>
          </div>

          {positions.length === 0 && (
            <div className="election-details-message">
              No positions have been added to this election yet.
            </div>
          )}

          <div className="election-positions-list">
            {positions.map((position) => (
              <article className="election-position-card" key={position._id}>
                <div className="election-position-heading">
                  <h3>{position.title}</h3>
                  <span>
                    Maximum selections: {position.maxSelections || 1}
                  </span>
                </div>

                {position.description && (
                  <p className="election-position-description">
                    {position.description}
                  </p>
                )}

                <div className="election-candidates-list">
                  {(candidatesByPosition[position._id] || []).map(
                    (candidate) => (
                      <div
                        className="election-candidate-card"
                        key={candidate._id}
                      >
                        <div className="election-candidate-avatar">
                          {candidate.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>

                        <div className="election-candidate-info">
                          <h4>{candidate.name}</h4>
                          <p>
                            {candidate.manifesto || 'No manifesto provided.'}
                          </p>
                        </div>
                      </div>
                    ),
                  )}

                  {!(candidatesByPosition[position._id] || []).length && (
                    <p className="election-no-candidates">
                      No candidates have been added to this position yet.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {election.status !== 'active' && (
          <p className="election-voting-notice">
            Voting is unavailable because this election is not active.
          </p>
        )}

        {election.status === 'active' && (
          <p className="election-voting-notice">
            Review the candidates above. We'll enable ballot selection and
            submission after confirming the voting API contract.
          </p>
        )}
      </section>
    </main>
  )
}

export default ElectionDetails
