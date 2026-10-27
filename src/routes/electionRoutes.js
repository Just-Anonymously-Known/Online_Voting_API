
const express = require('express');
const router = express.Router();

const {
  createElection,
  getElections,
  getElectionById
} = require('../controllers/electionController');

const {
  createPosition,
  getPositionsByElection
} = require('../controllers/positionController');

const {
  createCandidate,
  getCandidatesByPosition
} = require('../controllers/candidateController');

const {
  protect,
  authorize
} = require('../middleware/authMiddleware');

// Public: view all elections
router.get('/', getElections);

// Public: view one election
router.get('/:id', getElectionById);

// Admin only: create an election
router.post('/', protect, authorize('admin'), createElection);

// Public: list positions for an election
router.get('/:electionId/positions', getPositionsByElection);

// Admin only: create a position for an election
router.post(
  '/:electionId/positions',
  protect,
  authorize('admin'),
  createPosition
);

// Public: list candidates for a position
router.get(
  '/:electionId/positions/:positionId/candidates',
  getCandidatesByPosition
);

// Admin only: create a candidate for a position
router.post(
  '/:electionId/positions/:positionId/candidates',
  protect,
  authorize('admin'),
  createCandidate
);

module.exports = router;

