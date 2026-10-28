
const express = require('express');
const router = express.Router();

const {
  createCandidate,
  getCandidatesByPosition
} = require('../controllers/candidateController');

const {
  protect,
  authorize
} = require('../middleware/authMiddleware');

const {
  candidateMediaUpload
} = require('../middleware/candidateUpload');

// List candidates for a position (public endpoint)
router.get(
  '/:electionId/positions/:positionId/candidates',
  getCandidatesByPosition
);

// Create a candidate with optional image uploads (admin only)
router.post(
  '/:electionId/positions/:positionId/candidates',
  protect,
  authorize('admin'),
  candidateMediaUpload,
  createCandidate
);

module.exports = router;
