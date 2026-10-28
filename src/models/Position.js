
const mongoose = require('mongoose');
const Position = require('../models/Position');
const Election = require('../models/election');

// Admin: create a position for an election
const createPosition = async (req, res) => {
  try {
    const { title, description, maxSelections } = req.body || {};
    const { electionId } = req.params;

    if (!mongoose.isValidObjectId(electionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Position title is required'
      });
    }

    if (title.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Position title cannot exceed 100 characters'
      });
    }

    if (
      maxSelections !== undefined &&
      (!Number.isInteger(maxSelections) || maxSelections < 1)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Maximum selections must be a positive whole number'
      });
    }

    const election = await Election.findById(electionId);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    if (!['draft', 'scheduled'].includes(election.status)) {
      return res.status(400).json({
        success: false,
        message: 'Positions can only be added to draft or scheduled elections'
      });
    }

    const position = await Position.create({
      title: title.trim(),
      description,
      election: election._id,
      maxSelections: maxSelections ?? 1
    });

    return res.status(201).json({
      success: true,
      message: 'Position created successfully',
      position
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This position already exists in this election'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Create position error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create position'
    });
  }
};

// Public: list positions for an election
const getPositionsByElection = async (req, res) => {
  try {
    const { electionId } = req.params;

    if (!mongoose.isValidObjectId(electionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    const election = await Election.findById(electionId);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    const positions = await Position.find({
      election: election._id
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: positions.length,
      positions
    });
  } catch (error) {
    console.error('Get positions error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve positions'
    });
  }
};

module.exports = {
  createPosition,
  getPositionsByElection
};
