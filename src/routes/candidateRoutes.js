
const express = require('express');
const router = express.Router();

const {
  createCandidate,
  getCandidatesByPosition,
  getCandidateById,
  updateCandidate,
  deleteCandidate
} = require('../controllers/candidateController');

const {
  protect,
  authorize
} = require('../middleware/authMiddleware');

const {
  candidateMediaUpload
} = require('../middleware/candidateUpload');

// Public: list candidates for a position.
router.get(
  '/:electionId/positions/:positionId/candidates',
  getCandidatesByPosition
);

// Admin: create a candidate.
router.post(
  '/:electionId/positions/:positionId/candidates',
  protect,
  authorize('admin'),
  candidateMediaUpload,
  createCandidate
);

// Admin: view candidate details.
router.get(
  '/:electionId/positions/:positionId/candidates/:candidateId',
  protect,
  authorize('admin'),
  getCandidateById
);

// Admin: update candidate details and optional media.
router.patch(
  '/:electionId/positions/:positionId/candidates/:candidateId',
  protect,
  authorize('admin'),
  candidateMediaUpload,
  updateCandidate
);

// Admin: delete a candidate with no recorded votes.
router.delete(
  '/:electionId/positions/:positionId/candidates/:candidateId',
  protect,
  authorize('admin'),
  deleteCandidate
);

module.exports = router;
