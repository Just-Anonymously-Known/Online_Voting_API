
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Auth.css'

const API_URL = 'https://ballottrust-api.onrender.com/api/auth'

function Login() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to log in.')
      }

      setMessage(
        'Login accepted by the server. Dashboard access still needs to be connected.',
      )
    } catch (err) {
      setError(err.message || 'Unable to connect to BallotTrust.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-icon">B</span>
          BallotTrust
        </Link>

        <div className="auth-heading">
          <span className="auth-kicker">WELCOME BACK</span>
          <h1>Log in to your account</h1>
          <p>Sign in to continue to BallotTrust.</p>
        </div>

        {error && <div className="auth-alert error" role="alert">{error}</div>}
        {message && <div className="auth-alert success" role="status">{message}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />

          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Show password
          </label>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <p className="auth-switch">
          <Link to="/">← Back to homepage</Link>
        </p>
      </section>
    </main>
  )
}

export default Login
