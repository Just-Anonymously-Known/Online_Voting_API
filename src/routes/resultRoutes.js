
const express = require('express');
const router = express.Router();

const {
  getElectionResults
} = require('../controllers/resultController');

const {
  protect
} = require('../middleware/authMiddleware');

// Authenticated users can view completed results.
// Administrators can also monitor active election results.
router.get('/:electionId', protect, getElectionResults);

module.exports = router;
