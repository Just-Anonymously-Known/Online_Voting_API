
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const electionRoutes = require('./routes/electionRoutes');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '10kb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Online Voting System API is running',
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Election routes
app.use('/api/elections', electionRoutes);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

module.exports = app;
