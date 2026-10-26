
const express = require('express');
const router = express.Router();

const {
  createElection,
  getElections,
  getElectionById
} = require('../controllers/electionController');

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

module.exports = router;
