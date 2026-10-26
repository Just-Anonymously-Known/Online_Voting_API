
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Auth.css'

const API_URL = 'http://localhost:5500/api/auth'

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
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

    if (form.password !== form.confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,}$/

    if (!strongPassword.test(form.password)) {
      setError(
        'Use at least 12 characters, including uppercase and lowercase letters, a number, and a special character, with no spaces.',
      )
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.')
      }

      sessionStorage.setItem('ballottrust-verification-email', form.email.trim())
      setMessage(data.message || 'Account created. Check your email.')

      navigate('/verify-email', {
        state: { email: form.email.trim() },
      })
    } catch (err) {
      setError(
        err.message ||
          'Unable to connect to BallotTrust. Please check that the backend is running.',
      )
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
          <span className="auth-kicker">JOIN BALLOTTRUST</span>
          <h1>Create your account</h1>
          <p>Get started with a verified account for digital elections.</p>
        </div>

        {error && <div className="auth-alert error" role="alert">{error}</div>}
        {message && <div className="auth-alert success" role="status">{message}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            required
          />

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

          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="Enter your phone number"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            placeholder="At least 12 characters"
            required
          />

          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Enter your password again"
            required
          />

          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Show passwords
          </label>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>

        <p className="auth-legal">
          Email verification is required before a voter can log in.
        </p>
      </section>
    </main>
  )
}

export default Register
