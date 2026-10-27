
const express = require('express');
const router = express.Router();

const {
  getElectionResults
} = require('../controllers/resultController');

const {
  protect
} = require('../middleware/authMiddleware');

// Authenticated users can view results after an election is completed.
router.get(
  '/:electionId',
  protect,
  getElectionResults
);

module.exports = router;