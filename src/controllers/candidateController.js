
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const Position = require('../models/Position');
const Election = require('../models/election');

// Admin: create a candidate for a position
const createCandidate = async (req, res) => {
  try {
    const { name, manifesto, photoUrl } = req.body;
    const { electionId, positionId } = req.params;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name is required'
      });
    }

    if (!mongoose.isValidObjectId(electionId) ||
        !mongoose.isValidObjectId(positionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election or position ID'
      });
    }

    const election = await Election.findById(electionId);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    if (election.status === 'completed' || election.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Candidates cannot be added to a completed or cancelled election'
      });
    }

    const position = await Position.findOne({
      _id: positionId,
      election: electionId
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found in this election'
      });
    }

    const candidate = await Candidate.create({
      name: name.trim(),
      manifesto,
      photoUrl,
      position: position._id,
      election: election._id
    });

    return res.status(201).json({
      success: true,
      message: 'Candidate created successfully',
      candidate
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Create candidate error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create candidate'
    });
  }
};

// Public: list candidates for a position
const getCandidatesByPosition = async (req, res) => {
  try {
    const { electionId, positionId } = req.params;

    if (!mongoose.isValidObjectId(electionId) ||
        !mongoose.isValidObjectId(positionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election or position ID'
      });
    }

    const position = await Position.findOne({
      _id: positionId,
      election: electionId
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found in this election'
      });
    }

    const candidates = await Candidate.find({
      position: position._id,
      election: electionId
    }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: candidates.length,
      candidates
    });
  } catch (error) {
    console.error('Get candidates error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve candidates'
    });
  }
};

module.exports = {
  createCandidate,
  getCandidatesByPosition
};
