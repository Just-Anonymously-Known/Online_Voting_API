
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Auth.css'

const API_URL = 'http://localhost:5500/api/auth'

function VerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const savedEmail = sessionStorage.getItem('ballottrust-verification-email') || ''
  const [email, setEmail] = useState(location.state?.email || savedEmail)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleVerify(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!email.trim() || !/^\d{6}$/.test(code.trim())) {
      setError('Enter your email address and the 6-digit code.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Email verification failed.')
      }

      sessionStorage.removeItem('ballottrust-verification-email')
      setMessage('Email verified successfully. You can now sign in.')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      setError(err.message || 'Could not connect to the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setMessage('')

    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }

    setResending(true)

    try {
      const response = await fetch(`${API_URL}/resend-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Could not resend the code.')
      }

      setMessage(data.message || 'If your account can receive a new code, check your email inbox and spam folder.')
    } catch (err) {
      setError(err.message || 'Could not connect to the server. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link to="/" className="auth-brand">BallotTrust</Link>
        <div className="auth-heading">
          <span className="auth-eyebrow">ACCOUNT SECURITY</span>
          <h1>Verify your email</h1>
          <p>Enter the 6-digit code sent to your email address to activate your account.</p>
        </div>

        <form className="auth-form" onSubmit={handleVerify}>
          <label htmlFor="verification-email">Email address</label>
          <input
            id="verification-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="verification-code">6-digit verification code</label>
          <input
            id="verification-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            autoComplete="one-time-code"
            required
          />

          {error && <p className="auth-alert auth-alert-error" role="alert">{error}</p>}
          {message && <p className="auth-alert auth-alert-success" role="status">{message}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Verifying…' : 'Verify email'}
          </button>

          <button
            className="auth-secondary"
            type="button"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? 'Sending…' : 'Resend verification code'}
          </button>
        </form>

        <p className="auth-switch">
          Already verified? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}

export default VerifyEmail
