import { useEffect, useMemo, useState } from 'react'
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

    return { label: 'Open for voting', key: 'active', canVote: true }
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

function getCandidateId(id) {
  return String(id ?? '')
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
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('ballottrustToken')
    const savedUser = localStorage.getItem('ballottrustUser')

    if (!token || !savedUser) {
      navigate('/login', { replace: true })
      return undefined
    }

    try {
      const user = JSON.parse(savedUser)

      if (!user?.id || user.role !== 'voter') {
        navigate(
          user?.role === 'admin' ? '/admin/dashboard' : '/login',
          { replace: true }
        )
        return undefined
      }
    } catch {
      localStorage.removeItem('ballottrustToken')
      localStorage.removeItem('ballottrustUser')
      navigate('/login', { replace: true })
      return undefined
    }

    const controller = new AbortController()

    async function loadElection() {
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
          electionData.election ||
          electionData.data ||
          electionData

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

  const status = useMemo(
    () => getElectionStatus(election),
    [election]
  )

  const selectedCount = Object.values(selections).reduce(
    (total, candidateIds) => total + candidateIds.length,
    0
  )

  const candidateCount = Object.values(candidatesByPosition).reduce(
    (total, candidates) => total + candidates.length,
    0
  )

  const handleSelectionChange = (position, candidateId, checked) => {
    setSubmitError('')
    setShowReview(false)

    setSelections((previous) => {
      const current = previous[position._id] || []
      const limit = Math.max(1, Number(position.maxSelections) || 1)

      if (checked) {
        if (
          current.includes(candidateId) ||
          current.length >= limit
        ) {
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

    if (!status?.canVote) {
      setSubmitError('This election is not currently open for voting.')
      return
    }

    if (selectedCount === 0) {
      setSubmitError(
        'Select at least one candidate before reviewing your ballot.'
      )
      return
    }

    setShowReview(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmitBallot = async () => {
    const token = localStorage.getItem('ballottrustToken')
    const ballot = buildBallot()

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (!status?.canVote) {
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
        throw new Error(
          data.message || 'Your ballot could not be submitted.'
        )
      }

      const confirmation = data.data || {}

      setBallotConfirmation(confirmation)
      setSubmitted(true)
      setShowReview(false)
      setSelections({})
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(
        err.message || 'Something went wrong while submitting your ballot.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="election-details-page">
        <div className="election-state-card" role="status">
          <span className="election-loading-spinner" />
          <h1>Loading election</h1>
          <p>Getting election information and candidate details…</p>
        </div>
      </main>
    )
  }

  if (error || !election) {
    return (
      <main className="election-details-page">
        <div className="election-state-card election-state-error" role="alert">
          <span className="election-state-icon">!</span>
          <h1>Unable to open election</h1>
          <p>{error || 'Election not found.'}</p>
          <button
            type="button"
            className="election-primary-button"
            onClick={() => navigate('/dashboard')}
          >
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
          <span aria-hidden="true">←</span>
          Back to elections
        </button>

        <button
          type="button"
          className="election-details-brand"
          onClick={() => navigate('/dashboard')}
          aria-label="Go to BallotTrust dashboard"
        >
          <span className="election-details-brand-icon">B</span>
          BallotTrust
        </button>
      </header>

      <section className="election-details-content">
        {submitted ? (
          <section className="ballot-success-card" aria-live="polite">
            <div className="ballot-success-icon" aria-hidden="true">
              ✓
            </div>

            <p className="election-section-eyebrow">BALLOT RECEIVED</p>
            <h1>Your vote has been submitted</h1>
            <p className="ballot-success-description">
              BallotTrust has received your ballot. Thank you for participating
              in this election.
            </p>

            <div className="ballot-receipt">
              <div>
                <span>Election</span>
                <strong>{election.title}</strong>
              </div>

              {ballotConfirmation?.ballotId && (
                <div>
                  <span>Ballot reference</span>
                  <strong>{ballotConfirmation.ballotId}</strong>
                </div>
              )}

              <div>
                <span>Submitted</span>
                <strong>
                  {formatDate(ballotConfirmation?.submittedAt || new Date())}
                </strong>
              </div>

              <div>
                <span>Selections submitted</span>
                <strong>{selectedCount || 'Confirmed'}</strong>
              </div>
            </div>

            <p className="ballot-receipt-note">
              Keep your reference if one was provided. Your ballot cannot be
              changed after submission.
            </p>

            <button
              type="button"
              className="election-primary-button"
              onClick={() => navigate('/dashboard')}
            >
              Return to dashboard
              <span aria-hidden="true">→</span>
            </button>
          </section>
        ) : (
          <>
            <section className="election-details-hero">
              <div className="election-hero-topline">
                <span className="election-section-eyebrow">
                  VOTER PORTAL / ELECTION DETAILS
                </span>

                <span className={`election-details-status status-${status.key}`}>
                  <span className="election-status-dot" />
                  {status.label}
                </span>
              </div>

              <h1>{election.title || 'Untitled election'}</h1>

              <p className="election-hero-description">
                {election.description || 'No description provided.'}
              </p>

              <div className="election-details-dates">
                <div className="election-date-item">
                  <span className="election-date-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
                      <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17" />
                    </svg>
                  </span>
                  <div>
                    <span>Voting starts</span>
                    <strong>{formatDate(election.startDate)}</strong>
                  </div>
                </div>

                <div className="election-date-item">
                  <span className="election-date-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 7v5l3.5 2" />
                    </svg>
                  </span>
                  <div>
                    <span>Voting ends</span>
                    <strong>{formatDate(election.endDate)}</strong>
                  </div>
                </div>
              </div>

              <div className="election-hero-stats">
                <div>
                  <strong>{positions.length}</strong>
                  <span>{positions.length === 1 ? 'Position' : 'Positions'}</span>
                </div>
                <div>
                  <strong>{candidateCount}</strong>
                  <span>{candidateCount === 1 ? 'Candidate' : 'Candidates'}</span>
                </div>
                <div>
                  <strong>{selectedCount}</strong>
                  <span>{selectedCount === 1 ? 'Selection' : 'Selections'}</span>
                </div>
              </div>
            </section>

            {status.canVote && !showReview && (
              <div className="election-voting-banner">
                <span className="election-voting-banner-icon" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <strong>Voting is open</strong>
                  <p>Review each position and select your preferred candidate.</p>
                </div>
              </div>
            )}

            <section className="election-positions-section">
              <div className="election-positions-heading">
                <div>
                  <p className="election-section-eyebrow">MAKE AN INFORMED CHOICE</p>
                  <h2>
                    {showReview ? 'Review your ballot' : 'Positions and candidates'}
                  </h2>
                  <p>
                    {showReview
                      ? 'Check every selection before submitting your ballot.'
                      : 'Read the candidate manifestos before making your selections.'}
                  </p>
                </div>

                {status.canVote && !showReview && (
                  <span className="election-selection-counter">
                    {selectedCount} selected
                  </span>
                )}
              </div>

              {submitError && (
                <div className="election-submit-error" role="alert">
                  <span aria-hidden="true">!</span>
                  {submitError}
                </div>
              )}

              {positions.length === 0 && (
                <div className="election-details-message">
                  <strong>No positions available</strong>
                  <p>No positions have been added to this election yet.</p>
                </div>
              )}

              {!showReview && (
                <div className="election-positions-list">
                  {positions.map((position, index) => {
                    const candidates = candidatesByPosition[position._id] || []
                    const selectedIds = selections[position._id] || []
                    const selectionLimit = Math.max(
                      1,
                      Number(position.maxSelections) || 1
                    )

                    return (
                      <article
                        className="election-position-card"
                        key={position._id}
                      >
                        <div className="election-position-heading">
                          <div className="election-position-number">
                            {String(index + 1).padStart(2, '0')}
                          </div>

                          <div className="election-position-title">
                            <h3>{position.title || 'Untitled position'}</h3>
                            {position.description && (
                              <p>{position.description}</p>
                            )}
                          </div>

                          <span className="election-position-limit">
                            {status.canVote
                              ? `Choose up to ${selectionLimit}`
                              : `${candidates.length} ${
                                  candidates.length === 1 ? 'candidate' : 'candidates'
                                }`}
                          </span>
                        </div>

                        {status.canVote && (
                          <p className="election-selection-help">
                            {selectionLimit === 1
                              ? 'Select one candidate for this position.'
                              : `You may select up to ${selectionLimit} candidates for this position.`}
                          </p>
                        )}

                        <div className="election-candidates-list">
                          {candidates.map((candidate) => {
                            const candidateId = getCandidateId(candidate._id)
                            const isSelected = selectedIds.includes(candidateId)
                            const limitReached =
                              selectedIds.length >= selectionLimit

                            return (
                              <article
                                className={`election-candidate-card${
                                  isSelected ? ' candidate-selected' : ''
                                }`}
                                key={candidate._id}
                              >
                                <button
                                  type="button"
                                  className="election-candidate-profile"
                                  onClick={() => setSelectedCandidate(candidate)}
                                  aria-label={`Read more about ${candidate.name || 'candidate'}`}
                                >
                                  <span className="election-candidate-avatar">
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
                                  </span>

                                  <span className="election-candidate-info">
                                    <strong>
                                      {candidate.name || 'Unnamed candidate'}
                                    </strong>
                                    <span className="election-candidate-view">
                                      View candidate profile
                                      <span aria-hidden="true">↗</span>
                                    </span>
                                  </span>
                                </button>

                                {status.canVote && (
                                  <label
                                    className={`election-select-control${
                                      isSelected ? ' is-selected' : ''
                                    }${
                                      !isSelected && limitReached
                                        ? ' is-disabled'
                                        : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={!isSelected && limitReached}
                                      onChange={(event) =>
                                        handleSelectionChange(
                                          position,
                                          candidateId,
                                          event.target.checked
                                        )
                                      }
                                      aria-label={`Select ${candidate.name || 'candidate'} for ${position.title}`}
                                    />
                                    <span className="election-custom-checkbox">
                                      {isSelected ? '✓' : ''}
                                    </span>
                                    <span>
                                      {isSelected ? 'Selected' : 'Select'}
                                    </span>
                                  </label>
                                )}

                                <div className="election-candidate-manifesto">
                                  <span>MANIFESTO</span>
                                  <p>
                                    {candidate.manifesto ||
                                      'This candidate has not provided a manifesto.'}
                                  </p>
                                </div>
                              </article>
                            )
                          })}

                          {candidates.length === 0 && (
                            <div className="election-no-candidates">
                              <span aria-hidden="true">○</span>
                              <p>
                                No candidates have been added to this position yet.
                              </p>
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}

              {showReview && (
                <div className="ballot-review-card">
                  <div className="ballot-review-heading">
                    <span className="ballot-review-icon" aria-hidden="true">✓</span>
                    <div>
                      <h3>Check your choices</h3>
                      <p>
                        Your ballot contains {selectedCount}{' '}
                        {selectedCount === 1 ? 'selection' : 'selections'}.
                        Confirm everything before submitting.
                      </p>
                    </div>
                  </div>

                  <div className="ballot-review-list">
                    {positions.map((position) => {
                      const selectedIds = selections[position._id] || []
                      const candidates = candidatesByPosition[position._id] || []

                      if (selectedIds.length === 0) return null

                      return (
                        <div
                          className="ballot-review-position"
                          key={position._id}
                        >
                          <h4>{position.title}</h4>

                          {selectedIds.map((candidateId) => {
                            const candidate = candidates.find(
                              (item) =>
                                getCandidateId(item._id) === candidateId
                            )

                            return (
                              <div
                                className="ballot-review-candidate"
                                key={`${position._id}-${candidateId}`}
                              >
                                <span className="ballot-review-check">✓</span>
                                <span>
                                  {candidate?.name || 'Selected candidate'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>

                  <div className="ballot-review-warning">
                    <span aria-hidden="true">!</span>
                    <p>
                      Once submitted, your ballot cannot be changed. Please
                      make sure your selections are correct.
                    </p>
                  </div>

                  <div className="ballot-review-actions">
                    <button
                      type="button"
                      className="election-secondary-button"
                      disabled={submitting}
                      onClick={() => {
                        setShowReview(false)
                        setSubmitError('')
                      }}
                    >
                      ← Edit selections
                    </button>

                    <button
                      type="button"
                      className="election-primary-button"
                      disabled={submitting}
                      onClick={handleSubmitBallot}
                    >
                      {submitting ? (
                        <>
                          <span className="button-spinner" />
                          Submitting ballot…
                        </>
                      ) : (
                        <>
                          Confirm and submit
                          <span aria-hidden="true">→</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {status.canVote && !showReview && positions.length > 0 && (
                <div className="election-ballot-footer">
                  <div>
                    <strong>{selectedCount} selected</strong>
                    <span>
                      {selectedCount === 0
                        ? 'Choose your candidates to continue.'
                        : 'Review your choices before submitting.'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="election-primary-button"
                    disabled={selectedCount === 0}
                    onClick={handleReviewBallot}
                  >
                    Review ballot
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}

              {!status.canVote && (
                <div className="election-voting-notice">
                  <span aria-hidden="true">i</span>
                  <p>
                    {status.key === 'expired'
                      ? 'Voting is closed because this election has ended.'
                      : status.key === 'cancelled'
                        ? 'Voting is unavailable because this election was cancelled.'
                        : status.key === 'completed'
                          ? 'This election has been completed. Voting is closed.'
                          : status.key === 'scheduled'
                            ? 'Voting has not started yet. Check the election schedule above.'
                            : status.key === 'draft'
                              ? 'This election is still a draft and is not open to voters.'
                              : 'Voting is unavailable because this election is not active.'}
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <footer className="election-details-footer">
        <span className="election-footer-brand">
          <span className="election-details-brand-icon">B</span>
          BallotTrust
        </span>
        <span>Make your choice count.</span>
      </footer>

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
            aria-labelledby="candidate-modal-name"
          >
            <button
              type="button"
              className="candidate-modal-close"
              onClick={() => setSelectedCandidate(null)}
              aria-label="Close candidate profile"
            >
              ×
            </button>

            <div className="candidate-modal-profile">
              <div className="candidate-modal-avatar">
                {selectedCandidate.photoUrl ? (
                  <img
                    src={selectedCandidate.photoUrl}
                    alt={`${selectedCandidate.name || 'Candidate'} portrait`}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  selectedCandidate.name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>

              <p className="election-section-eyebrow">CANDIDATE PROFILE</p>
              <h2 id="candidate-modal-name">
                {selectedCandidate.name || 'Unnamed candidate'}
              </h2>
            </div>

            <div className="candidate-modal-manifesto">
              <h3>Manifesto</h3>
              <p>
                {selectedCandidate.manifesto ||
                  'This candidate has not provided a manifesto.'}
              </p>
            </div>

            <button
              type="button"
              className="election-primary-button candidate-modal-done"
              onClick={() => setSelectedCandidate(null)}
            >
              Close profile
            </button>
          </section>
        </div>
      )}
    </main>
  )
}

export default ElectionDetails