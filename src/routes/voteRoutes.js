
const express = require('express');
const router = express.Router();

const { castVote } = require('../controllers/voteController');
const {
  protect,
  authorize
} = require('../middleware/authMiddleware');

// Authenticated voters submit their ballot.
router.post(
  '/:electionId',
  protect,
  authorize('voter'),
  castVote
);

module.exports = router;
