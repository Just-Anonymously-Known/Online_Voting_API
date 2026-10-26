
const Position = require('../models/Position');
const Election = require('../models/election');

// Create a position for an election
const createPosition = async (req, res) => {
  try {
    const { title, description, maxSelections } = req.body;
    const { electionId } = req.params;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Position title is required'
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

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    console.error('Create position error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create position'
    });
  }
};

// Get all positions for an election
const getPositionsByElection = async (req, res) => {
  try {
    const { electionId } = req.params;

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
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

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
