
const mongoose = require('mongoose');
const Position = require('../models/Position');
const Election = require('../models/election');
const Candidate = require('../models/Candidate');
const Vote = require('../models/Vote');

const isValidId = (id) => mongoose.isValidObjectId(id);

const canManageElection = (election) => {
  const status = String(election.status || '').trim().toLowerCase();

  return ['draft', 'scheduled', 'upcoming'].includes(status);
};

// Create a position for an election.
const createPosition = async (req, res) => {
  try {
    const { electionId } = req.params;
    const {
      title,
      description = '',
      maxSelections = 1
    } = req.body || {};

    if (!isValidId(electionId)) {
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
      typeof description !== 'string' ||
      description.length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: 'Description must be text and cannot exceed 500 characters'
      });
    }

    if (!Number.isInteger(maxSelections) || maxSelections < 1) {
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

    if (!canManageElection(election)) {
      return res.status(400).json({
        success: false,
        message:
          'Positions can only be added to draft or scheduled elections'
      });
    }

    const position = await Position.create({
      title: title.trim(),
      description: description.trim(),
      election: election._id,
      maxSelections
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

// Get all positions for an election.
const getPositionsByElection = async (req, res) => {
  try {
    const { electionId } = req.params;

    if (!isValidId(electionId)) {
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

// Get one position by ID.
const getPositionById = async (req, res) => {
  try {
    const { positionId } = req.params;

    if (!isValidId(positionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position ID'
      });
    }

    const position = await Position.findById(positionId);

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    return res.status(200).json({
      success: true,
      position
    });
  } catch (error) {
    console.error('Get position error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve position'
    });
  }
};

// Update a position.
const updatePosition = async (req, res) => {
  try {
    const { positionId } = req.params;
    const { title, description, maxSelections } = req.body || {};

    if (!isValidId(positionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position ID'
      });
    }

    const position = await Position.findById(positionId);

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    const election = await Election.findById(position.election);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Associated election not found'
      });
    }

    if (!canManageElection(election)) {
      return res.status(400).json({
        success: false,
        message:
          'Only positions in draft or scheduled elections can be edited'
      });
    }

    const updates = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Position title cannot be empty'
        });
      }

      if (title.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Position title cannot exceed 100 characters'
        });
      }

      updates.title = title.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== 'string' ||
        description.length > 500
      ) {
        return res.status(400).json({
          success: false,
          message: 'Description must be text and cannot exceed 500 characters'
        });
      }

      updates.description = description.trim();
    }

    if (maxSelections !== undefined) {
      if (!Number.isInteger(maxSelections) || maxSelections < 1) {
        return res.status(400).json({
          success: false,
          message: 'Maximum selections must be a positive whole number'
        });
      }

      updates.maxSelections = maxSelections;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update'
      });
    }

    // Do not change the selection limit if ballots already
    // contain selections for this position.
    if (updates.maxSelections !== undefined) {
      const hasRecordedVotes = await Vote.exists({
        election: election._id,
        'selections.position': position._id
      });

      if (hasRecordedVotes) {
        return res.status(409).json({
          success: false,
          message:
            'Cannot change the selection limit for a position with recorded votes'
        });
      }
    }

    Object.assign(position, updates);
    await position.save();

    return res.status(200).json({
      success: true,
      message: 'Position updated successfully',
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

    console.error('Update position error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update position'
    });
  }
};

// Delete a position only when it has no candidates or votes.
const deletePosition = async (req, res) => {
  try {
    const { positionId } = req.params;

    if (!isValidId(positionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position ID'
      });
    }

    const position = await Position.findById(positionId);

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    const election = await Election.findById(position.election);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Associated election not found'
      });
    }

    if (!canManageElection(election)) {
      return res.status(400).json({
        success: false,
        message:
          'Only positions in draft or scheduled elections can be deleted'
      });
    }

    const [candidateExists, voteExists] = await Promise.all([
      Candidate.exists({
        position: position._id,
        election: election._id
      }),
      Vote.exists({
        election: election._id,
        'selections.position': position._id
      })
    ]);

    if (candidateExists || voteExists) {
      return res.status(409).json({
        success: false,
        message:
          'Cannot delete a position that has candidates or votes associated with it'
      });
    }

    await position.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Position deleted successfully'
    });
  } catch (error) {
    console.error('Delete position error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete position'
    });
  }
};

module.exports = {
  createPosition,
  getPositionsByElection,
  getPositionById,
  updatePosition,
  deletePosition
};
