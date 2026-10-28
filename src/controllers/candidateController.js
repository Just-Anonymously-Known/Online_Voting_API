
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const Position = require('../models/Position');
const Election = require('../models/election');
const User = require('../models/User');

// Admin: create a candidate for a position
const createCandidate = async (req, res) => {
  try {
    const { name, manifesto, photoUrl } = req.body || {};
    const { electionId, positionId } = req.params;

    if (
      !mongoose.isValidObjectId(electionId) ||
      !mongoose.isValidObjectId(positionId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election or position ID'
      });
    }

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name is required'
      });
    }

    if (name.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name cannot exceed 120 characters'
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
        message:
          'Candidates can only be added to draft or scheduled elections'
      });
    }

    const position = await Position.findOne({
      _id: positionId,
      election: election._id
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found in this election'
      });
    }

    const candidate = await Candidate.create({
      name: name.trim(),
      manifesto:
        typeof manifesto === 'string' ? manifesto.trim() : '',
      photoUrl:
        typeof photoUrl === 'string' ? photoUrl.trim() : '',
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

    if (
      !mongoose.isValidObjectId(electionId) ||
      !mongoose.isValidObjectId(positionId)
    ) {
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
    })
      .sort({ name: 1 })
      .lean();

    const formattedCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        let candidateName = candidate.name;

        // Support older records containing a user reference.
        if (!candidateName && candidate.user) {
          const user = await User.findById(candidate.user)
            .select('name')
            .lean();

          candidateName = user?.name;
        }

        return {
          ...candidate,
          name: candidateName || 'Unnamed candidate'
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: formattedCandidates.length,
      candidates: formattedCandidates
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
