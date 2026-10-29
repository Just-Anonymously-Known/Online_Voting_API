
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const electionRoutes = require('./routes/electionRoutes');
const positionRoutes = require('./routes/positionRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const voteRoutes = require('./routes/voteRoutes');
const resultRoutes = require('./routes/resultRoutes');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    }
  })
);

app.use(express.json({ limit: '10kb' }));

// Health check
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Online Voting System API is running'
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Candidate routes must be registered before the general election router
app.use('/api/elections', candidateRoutes);

// Election routes
app.use('/api/elections', electionRoutes);

// Position routes
app.use('/api/positions', positionRoutes);

// Voting routes
app.use('/api/votes', voteRoutes);

// Election results routes
app.use('/api/results', resultRoutes);

// Handle unknown routes
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});


app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

    return res.status(status).json({
      success: false,
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Each image must be 5 MB or smaller.'
          : 'The uploaded files are invalid or exceed the allowed limits.'
    });
  }

  if (
    err.message === 'Only JPEG, PNG and WebP images are allowed.'
  ) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'This origin is not allowed.'
    });
  }

  console.error('Unhandled application error:', err.message);

  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.'
  });
});

module.exports = app;
