
const express = require('express');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Online Voting System API is running'
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Handle unknown routes (keep this last)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = app;
