
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

// List candidates for a position (public endpoint)
router.get(
  '/:electionId/positions/:positionId/candidates',
  getCandidatesByPosition
);

// Create a candidate (authenticated administrator only)
router.post(
  '/:electionId/positions/:positionId/candidates',
  protect,
  authorize('admin'),
  createCandidate
);

module.exports = router;
