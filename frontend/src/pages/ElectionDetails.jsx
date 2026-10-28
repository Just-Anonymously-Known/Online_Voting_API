
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './ElectionDetails.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

function getElectionStatus(election) {
  const rawStatus = String(election?.status || '').trim().toLowerCase()
  const start = new Date(election?.startDate).getTime()
  const end = new Date(election?.endDate).getTime()
  const now = Date.now()

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

    return { label: 'Active', key: 'active', canVote: true }
  }

  return { label: 'Status needs review', key: 'unknown', canVote: false }
}

function formatDate(value) {
  if (!value) return 'Not specified'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Not specified'

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function getCandidateId(value) {
  return typeof value === 'object' && value !== null
    ? String(value._id || value.id || '')
    : String(value || '')
}

function ElectionDetails() {
  const { electionId } = useParams()
  const navigate = useNavigate()

  const [election, setElection] = useState(null)
  const [positions, setPositions] = useState([])
  const [candidatesByPosition, setCandidatesByPosition] = useState({})
  const [selections, setSelections] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ballotConfirmation, setBallotConfirmation] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('ballottrustToken')
    const savedUser = localStorage.getItem('ballottrustUser')

    if (!token || !savedUser) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const user = JSON.parse(savedUser)

      if (!user?.id || user.role !== 'voter') {
        navigate(
          user?.role === 'admin' ? '/admin/dashboard' : '/login',
          { replace: true }
        )
        return
      }
    } catch {
      localStorage.removeItem('ballottrustToken')
      localStorage.removeItem('ballottrustUser')
      navigate('/login', { replace: true })
      return
    }

    const controller = new AbortController()

    const loadElection = async () => {
      try {
        setLoading(true)
        setError('')

        const electionResponse = await fetch(
          `${API_URL}/elections/${electionId}`,
          { signal: controller.signal }
        )
        const electionData = await electionResponse.json()

        if (!electionResponse.ok || electionData.success === false) {
          throw new Error(
            electionData.message || 'Unable to load this election.'
          )
        }

        const electionRecord =
          electionData.election || electionData.data || electionData

        setElection(electionRecord)

        const positionsResponse = await fetch(
          `${API_URL}/elections/${electionId}/positions`,
          { signal: controller.signal }
        )
        const positionsData = await positionsResponse.json()

        if (!positionsResponse.ok || positionsData.success === false) {
          throw new Error(
            positionsData.message || 'Unable to load election positions.'
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
              { signal: controller.signal }
            )
            const data = await response.json()

            if (!response.ok || data.success === false) {
              throw new Error(
                data.message ||
                  `Unable to load candidates for ${position.title}.`
              )
            }

            return [
              position._id,
              Array.isArray(data.candidates) ? data.candidates : []
            ]
          })
        )

        setCandidatesByPosition(Object.fromEntries(candidateEntries))
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Could not load election details.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadElection()

    return () => controller.abort()
  }, [electionId, navigate])

  const handleSelectionChange = (position, candidateId, checked) => {
    setSubmitError('')
    setShowReview(false)

    setSelections((previous) => {
      const current = previous[position._id] || []
      const limit = Number(position.maxSelections) || 1

      if (checked) {
        if (current.includes(candidateId) || current.length >= limit) {
          return previous
        }

        return {
          ...previous,
          [position._id]: [...current, candidateId]
        }
      }

      return {
        ...previous,
        [position._id]: current.filter((id) => id !== candidateId)
      }
    })
  }

  const selectedCount = Object.values(selections).reduce(
    (total, candidateIds) => total + candidateIds.length,
    0
  )

  const buildBallot = () => {
    const ballot = []

    for (const position of positions) {
      const candidateIds = selections[position._id] || []

      for (const candidateId of candidateIds) {
        ballot.push({
          position: position._id,
          candidate: candidateId
        })
      }
    }

    return ballot
  }

  const handleReviewBallot = () => {
    setSubmitError('')

    if (selectedCount === 0) {
      setSubmitError('Select at least one candidate before reviewing your ballot.')
      return
    }

    setShowReview(true)
  }

  const handleSubmitBallot = async () => {
    const token = localStorage.getItem('ballottrustToken')
    const ballot = buildBallot()

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (!status.canVote) {
      setSubmitError('This election is not currently open for voting.')
      setShowReview(false)
      return
    }

    if (ballot.length === 0) {
      setSubmitError('Select at least one candidate before submitting.')
      setShowReview(false)
      return
    }

    try {
      setSubmitting(true)
      setSubmitError('')

      const response = await fetch(`${API_URL}/votes/${electionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ selections: ballot })
      })

      const data = await response.json()

      if (!response.ok || data.success !== true) {
        throw new Error(data.message || 'Unable to submit your ballot.')
      }

      setBallotConfirmation(data.data || {})
      setSubmitted(true)
      setShowReview(false)
    } catch (err) {
      setSubmitError(
        err.message || 'Your ballot could not be submitted. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
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

  const status = getElectionStatus(election)

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
          <span className={`election-details-status status-${status.key}`}>
            {status.label}
          </span>

          <h1>{election.title}</h1>
          <p>{election.description || 'No description provided.'}</p>

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

        {submitted ? (
          <section className="election-vote-confirmation" role="status">
            <h2>Ballot submitted successfully</h2>
            <p>
              Your ballot has been recorded. You cannot submit another ballot
              for this election.
            </p>

            {ballotConfirmation?.ballotId && (
              <p>
                <strong>Confirmation reference:</strong>{' '}
                {ballotConfirmation.ballotId}
              </p>
            )}

            {ballotConfirmation?.submittedAt && (
              <p>
                <strong>Submitted:</strong>{' '}
                {formatDate(ballotConfirmation.submittedAt)}
              </p>
            )}

            <button type="button" onClick={() => navigate('/dashboard')}>
              Return to dashboard
            </button>
          </section>
        ) : (
          <section className="election-positions-section">
            <div className="election-positions-heading">
              <h2>Positions and candidates</h2>
              <p>
                {status.canVote
                  ? 'Select candidates for each position, then review your ballot before submitting.'
                  : 'Review the candidates participating in this election.'}
              </p>
            </div>

            {positions.length === 0 && (
              <div className="election-details-message">
                No positions have been added to this election yet.
              </div>
            )}

            <div className="election-positions-list">
              {positions.map((position) => {
                const candidates = candidatesByPosition[position._id] || []
                const selectedForPosition = selections[position._id] || []
                const limit = Number(position.maxSelections) || 1

                return (
                  <article className="election-position-card" key={position._id}>
                    <div className="election-position-heading">
                      <h3>{position.title}</h3>
                      <span>Maximum selections: {limit}</span>
                    </div>

                    {position.description && (
                      <p className="election-position-description">
                        {position.description}
                      </p>
                    )}

                    {status.canVote && candidates.length > 0 && (
                      <p>
                        Selected: {selectedForPosition.length} of {limit}
                      </p>
                    )}

                    <div className="election-candidates-list">
                      {candidates.map((candidate) => {
                        const candidateId = getCandidateId(candidate._id)
                        const checked = selectedForPosition.includes(candidateId)

                        return (
                          <label
                            className="election-candidate-card"
                            key={candidateId}
                            style={{
                              cursor: status.canVote ? 'pointer' : 'default'
                            }}
                          >
                            {status.canVote && (
                              <input
                                type={limit > 1 ? 'checkbox' : 'radio'}
                                name={`position-${position._id}`}
                                checked={checked}
                                disabled={
                                  !checked &&
                                  selectedForPosition.length >= limit
                                }
                                onChange={(event) =>
                                  handleSelectionChange(
                                    position,
                                    candidateId,
                                    event.target.checked
                                  )
                                }
                                aria-label={`Select ${candidate.name || 'candidate'} for ${position.title}`}
                              />
                            )}

                            <div className="election-candidate-avatar">
                              {candidate.photoUrl ? (
                                <img
                                  src={candidate.photoUrl}
                                  alt={`${candidate.name || 'Candidate'} portrait`}
                                  onError={(event) => {
                                    event.currentTarget.style.display = 'none'
                                  }}
                                />
                              ) : (
                                candidate.name?.charAt(0)?.toUpperCase() || '?'
                              )}
                            </div>

                            <div className="election-candidate-info">
                              <h4>{candidate.name || 'Unnamed candidate'}</h4>
                              <p>
                                {candidate.manifesto || 'No manifesto provided.'}
                              </p>
                            </div>
                          </label>
                        )
                      })}

                      {candidates.length === 0 && (
                        <p className="election-no-candidates">
                          No candidates have been added to this position yet.
                        </p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>

            {status.canVote && positions.length > 0 && (
              <section className="election-ballot-actions">
                <p>
                  <strong>{selectedCount}</strong>{' '}
                  {selectedCount === 1 ? 'selection' : 'selections'} made
                </p>

                {submitError && (
                  <p className="election-details-error" role="alert">
                    {submitError}
                  </p>
                )}

                {!showReview ? (
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={handleReviewBallot}
                  >
                    Review ballot
                  </button>
                ) : (
                  <div>
                    <h3>Review your ballot</h3>
                    <p>
                      Check your selections carefully. Once submitted, your
                      ballot cannot be changed.
                    </p>

                    <ul>
                      {positions.map((position) => {
                        const selectedIds = selections[position._id] || []
                        const candidates = candidatesByPosition[position._id] || []

                        return selectedIds.map((candidateId) => {
                          const candidate = candidates.find(
                            (item) => getCandidateId(item._id) === candidateId
                          )

                          return (
                            <li key={`${position._id}-${candidateId}`}>
                              <strong>{position.title}:</strong>{' '}
                              {candidate?.name || 'Selected candidate'}
                            </li>
                          )
                        })
                      })}
                    </ul>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setShowReview(false)}
                    >
                      Back to selections
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSubmitBallot}
                    >
                      {submitting ? 'Submitting ballot...' : 'Confirm and submit'}
                    </button>
                  </div>
                )}
              </section>
            )}

            <p className="election-voting-notice">
              {status.canVote
                ? 'Your ballot can only be submitted once. Please review your choices carefully.'
                : status.key === 'expired'
                  ? 'Voting is closed because this election has ended.'
                  : status.key === 'cancelled'
                    ? 'Voting is unavailable because this election was cancelled.'
                    : status.key === 'completed'
                      ? 'This election has been completed. Voting is closed.'
                      : 'Voting is unavailable because this election is not active.'}
            </p>
          </section>
        )}
      </section>
    </main>
  )
}

export default ElectionDetails
