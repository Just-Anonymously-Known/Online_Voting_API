
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

function Dashboard() {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [elections, setElections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('ballottrustToken')
    const savedUser = localStorage.getItem('ballottrustUser')

    if (!token || !savedUser) {
      navigate('/login', { replace: true })
      return
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
      return
    }

    if (currentUser.role === 'admin') {
      navigate('/admin/dashboard', { replace: true })
      return
    }

    setUser(currentUser)

    const fetchElections = async () => {
      try {
        const response = await fetch(`${API_URL}/elections`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load elections.')
        }

        setElections(Array.isArray(data.elections) ? data.elections : [])
      } catch (err) {
        setError(err.message || 'Could not connect to BallotTrust.')
      } finally {
        setLoading(false)
      }
    }

    fetchElections()
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('ballottrustToken')
    localStorage.removeItem('ballottrustUser')
    navigate('/login', { replace: true })
  }

  const formatDate = (date) => {
    if (!date) return 'Not specified'

    const parsedDate = new Date(date)

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Not specified'
    }

    return parsedDate.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  const formatStatus = (status) => {
    if (!status) return 'Unknown'

    return status.charAt(0).toUpperCase() + status.slice(1)
  }

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
        >
          <span className="dashboard-brand-icon">B</span>
          <span>BallotTrust</span>
        </a>

        <div className="dashboard-header-actions">
          <span className="dashboard-user-name">
            {user?.name || 'Voter'}
          </span>

          <button
            type="button"
            className="dashboard-logout"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-welcome">
          <p className="dashboard-kicker">VOTER PORTAL</p>

          <h1>
            Welcome{user?.name ? `, ${user.name}` : ''}
          </h1>

          <p>
            Your voice matters. Explore elections and make your vote count.
          </p>
        </div>

        <section className="dashboard-elections">
          <div className="dashboard-section-heading">
            <div>
              <h2>Available elections</h2>
              <p>Review election schedules and current status.</p>
            </div>

            {!loading && !error && (
              <span className="dashboard-count">
                {elections.length}{' '}
                {elections.length === 1 ? 'election' : 'elections'}
              </span>
            )}
          </div>

          {loading && (
            <div className="dashboard-message" role="status">
              <span className="dashboard-spinner" aria-hidden="true" />
              Loading elections...
            </div>
          )}

          {!loading && error && (
            <div className="dashboard-error" role="alert">
              <h3>Unable to load elections</h3>
              <p>{error}</p>

              <button
                type="button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && elections.length === 0 && (
            <div className="dashboard-empty">
              <h3>No elections found</h3>
              <p>
                Elections will appear here when they are available.
              </p>
            </div>
          )}

          {!loading && !error && elections.length > 0 && (
            <div className="election-grid">
              {elections.map((election) => {
                const status = formatStatus(election.status)

                return (
                  <article
                    className="election-card"
                    key={election._id}
                  >
                    <div className="election-card-top">
                      <span
                        className={`election-status status-${status.toLowerCase()}`}
                      >
                        {status}
                      </span>
                    </div>

                    <h3>{election.title}</h3>

                    <p className="election-description">
                      {election.description || 'No description provided.'}
                    </p>

                    <div className="election-dates">
                      <p>
                        <strong>Starts</strong>
                        <span>{formatDate(election.startDate)}</span>
                      </p>

                      <p>
                        <strong>Ends</strong>
                        <span>{formatDate(election.endDate)}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      className="election-view-button"
                      onClick={() =>
                        navigate(`/elections/${election._id}`)
                      }
                    >
                      View election
                      <span aria-hidden="true">→</span>
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>

      <footer className="dashboard-footer">
        <p>BallotTrust · Secure, transparent voting.</p>
      </footer>
    </main>
  )
}

export default Dashboard
