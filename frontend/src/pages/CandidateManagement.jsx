
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import './CandidateManagement.css'

const API_URL = 'https://ballottrust-api.onrender.com/api'

const EMPTY_FORM = {
  name: '',
  manifesto: '',
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

async function apiRequest(url, options = {}) {
  const token = localStorage.getItem('ballottrustToken')

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  // Let the browser set the multipart boundary for FormData.
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.message || data.error || 'The request failed.'
    )
  }

  return data
}

function CandidateManagement() {
  const { electionId, positionId } = useParams()
  const navigate = useNavigate()
  const photoInputRef = useRef(null)

  const [candidates, setCandidates] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('')
  const [editingId, setEditingId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const baseUrl =
    `${API_URL}/elections/${electionId}` +
    `/positions/${positionId}/candidates`

  // Verify the logged-in user is an administrator.
  useEffect(() => {
    const token = localStorage.getItem('ballottrustToken')
    const rawUser = localStorage.getItem('ballottrustUser')

    if (!token || !rawUser) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const user = JSON.parse(rawUser)

      if (user.role !== 'admin') {
        navigate('/dashboard', { replace: true })
      }
    } catch {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  // Create and clean up the local image preview URL.
  useEffect(() => {
    if (!photo) {
      setPhotoPreview('')
      return
    }

    const previewUrl = URL.createObjectURL(photo)
    setPhotoPreview(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [photo])

  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await apiRequest(baseUrl)
      const list = data.candidates || data.data?.candidates

      setCandidates(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err.message || 'Could not load candidates.')
    } finally {
      setLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    loadCandidates()
  }, [loadCandidates])

  function updateField(event) {
    const { name, value } = event.target

    setForm(current => ({
      ...current,
      [name]: value,
    }))
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setNotice('')

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('The photo must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    setPhoto(file)
  }

  function clearSelectedPhoto() {
    setPhoto(null)

    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setPhoto(null)
    setExistingPhotoUrl('')
    setEditingId(null)

    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }
  }

  function startEditing(candidate) {
    setEditingId(candidate._id)

    setForm({
      name: candidate.name || '',
      manifesto: candidate.manifesto || '',
    })

    setPhoto(null)
    setExistingPhotoUrl(candidate.photoUrl || '')

    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }

    setError('')
    setNotice('')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setNotice('')

    if (!form.name.trim()) {
      setError('Please enter the candidate name.')
      return
    }

    setSaving(true)

    try {
      const body = new FormData()

      body.append('name', form.name.trim())
      body.append('manifesto', form.manifesto.trim())

      // Match the existing backend Multer field name.
      if (photo) {
        body.append('photo', photo)
      }

      const url = editingId
        ? `${baseUrl}/${editingId}`
        : baseUrl

      await apiRequest(url, {
        method: editingId ? 'PATCH' : 'POST',
        body,
      })

      const wasEditing = Boolean(editingId)

      resetForm()

      setNotice(
        wasEditing
          ? 'Candidate updated successfully.'
          : 'Candidate added successfully.'
      )

      await loadCandidates()
    } catch (err) {
      setError(err.message || 'Could not save the candidate.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(candidate) {
    const confirmed = window.confirm(
      `Delete ${candidate.name}? This action cannot be undone.`
    )

    if (!confirmed) return

    setDeletingId(candidate._id)
    setError('')
    setNotice('')

    try {
      await apiRequest(`${baseUrl}/${candidate._id}`, {
        method: 'DELETE',
      })

      setCandidates(current =>
        current.filter(item => item._id !== candidate._id)
      )

      if (editingId === candidate._id) {
        resetForm()
      }

      setNotice(`${candidate.name} was deleted.`)
    } catch (err) {
      setError(err.message || 'Could not delete the candidate.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="candidate-page">
      <header className="candidate-header">
        <Link to="/admin/dashboard" className="candidate-brand">
          <span className="candidate-brand-mark">B</span>
          <span>BallotTrust</span>
        </Link>

        <Link
          to={`/admin/elections/${electionId}`}
          className="candidate-back-link"
        >
          ← Back to election
        </Link>
      </header>

      <div className="candidate-content">
        <section className="candidate-intro">
          <span className="candidate-eyebrow">
            ELECTION ADMINISTRATION
          </span>

          <h1>Candidate management</h1>

          <p>
            Add and maintain the candidates standing for this position.
            Changes are saved to your BallotTrust backend.
          </p>

          <div className="candidate-summary">
            <div>
              <span className="candidate-summary-label">
                Total candidates
              </span>
              <strong>{candidates.length}</strong>
            </div>

            <div>
              <span className="candidate-summary-label">
                Management
              </span>
              <strong>Administrator</strong>
            </div>
          </div>
        </section>

        {error && (
          <div
            className="candidate-alert candidate-alert-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            className="candidate-alert candidate-alert-success"
            role="status"
          >
            {notice}
          </div>
        )}

        <section className="candidate-form-card">
          <div className="candidate-section-heading">
            <div>
              <span className="candidate-eyebrow">
                {editingId ? 'EDIT DETAILS' : 'NEW ENTRY'}
              </span>

              <h2>
                {editingId ? 'Update candidate' : 'Add a candidate'}
              </h2>
            </div>

            {editingId && (
              <button
                type="button"
                className="candidate-button candidate-button-secondary"
                onClick={resetForm}
              >
                Cancel editing
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="candidate-form">
            <label>
              Candidate name <span aria-hidden="true">*</span>

              <input
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="Enter full name"
                required
                maxLength={120}
              />
            </label>

            <div className="candidate-photo-field">
              <label htmlFor="candidate-photo">
                Candidate photo
              </label>

              <p>
                Select a photo from your device. JPG, PNG, or WebP,
                up to 5 MB.
              </p>

              <input
                ref={photoInputRef}
                id="candidate-photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
              />

              {(photoPreview || existingPhotoUrl) && (
                <div className="candidate-photo-preview">
                  <img
                    src={photoPreview || existingPhotoUrl}
                    alt="Candidate photo preview"
                    className="candidate-avatar"
                  />

                  <div className="candidate-photo-preview-details">
                    <strong>
                      {photo
                        ? 'New photo selected'
                        : 'Current candidate photo'}
                    </strong>

                    {photo && (
                      <small>
                        {photo.name} · {(photo.size / 1024).toFixed(0)} KB
                      </small>
                    )}

                    {photo && (
                      <button
                        type="button"
                        className="candidate-button candidate-button-secondary"
                        onClick={clearSelectedPhoto}
                      >
                        Remove selected photo
                      </button>
                    )}
                  </div>
                </div>
              )}

              {editingId && !photo && existingPhotoUrl && (
                <small>
                  Choose a new file only if you want to replace the
                  current photo.
                </small>
              )}
            </div>

            <label>
              Manifesto

              <textarea
                name="manifesto"
                value={form.manifesto}
                onChange={updateField}
                placeholder="Describe the candidate's goals and priorities..."
                rows={5}
                maxLength={5000}
              />
            </label>

            <div className="candidate-form-actions">
              <button
                type="submit"
                className="candidate-button candidate-button-primary"
                disabled={saving}
              >
                {saving
                  ? photo
                    ? 'Uploading photo and saving...'
                    : 'Saving...'
                  : editingId
                    ? 'Save changes'
                    : '+ Add candidate'}
              </button>
            </div>
          </form>
        </section>

        <section className="candidate-list-section">
          <div className="candidate-section-heading">
            <div>
              <span className="candidate-eyebrow">
                CANDIDATE DIRECTORY
              </span>

              <h2>Registered candidates</h2>
            </div>

            <button
              type="button"
              className="candidate-button candidate-button-secondary"
              onClick={loadCandidates}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="candidate-state">
              <span className="candidate-spinner" />
              <p>Loading candidates...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="candidate-state candidate-empty">
              <div className="candidate-empty-icon">＋</div>
              <h3>No candidates yet</h3>
              <p>Add the first candidate using the form above.</p>
            </div>
          ) : (
            <div className="candidate-grid">
              {candidates.map(candidate => (
                <article
                  className="candidate-card"
                  key={candidate._id}
                >
                  <div className="candidate-card-top">
                    {candidate.photoUrl ? (
                      <img
                        className="candidate-avatar"
                        src={candidate.photoUrl}
                        alt={`${candidate.name}'s portrait`}
                        onError={event => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="candidate-avatar candidate-avatar-fallback">
                        {(candidate.name || '?')
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}

                    <div className="candidate-card-name">
                      <h3>{candidate.name}</h3>
                      <span>Candidate</span>
                    </div>
                  </div>

                  <div className="candidate-manifesto">
                    <span className="candidate-summary-label">
                      MANIFESTO
                    </span>

                    <p>
                      {candidate.manifesto ||
                        'No manifesto has been added yet.'}
                    </p>
                  </div>

                  <div className="candidate-card-actions">
                    <button
                      type="button"
                      className="candidate-button candidate-button-secondary"
                      onClick={() => startEditing(candidate)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="candidate-button candidate-button-danger"
                      onClick={() => handleDelete(candidate)}
                      disabled={deletingId === candidate._id}
                    >
                      {deletingId === candidate._id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default CandidateManagement
