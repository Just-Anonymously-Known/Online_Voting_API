
const express = require('express');
const router = express.Router();

const {
  createPosition,
  getPositionsByElection,
  getPositionById,
  updatePosition,
  deletePosition
} = require('../controllers/positionController');

const { protect } = require('../middleware/authMiddleware');

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Administrator access required'
    });
  }

  next();
};

// List positions for an election
router.get('/election/:electionId', protect, getPositionsByElection);

// Create a position
router.post('/election/:electionId', protect, requireAdmin, createPosition);

// Get a single position
router.get('/:positionId', protect, getPositionById);

// Update a position
router.patch('/:positionId', protect, requireAdmin, updatePosition);

// Delete a position
router.delete('/:positionId', protect, requireAdmin, deletePosition);

module.exports = router;
