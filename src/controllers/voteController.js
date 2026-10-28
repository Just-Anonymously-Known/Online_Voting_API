
const mongoose = require('mongoose');
const Vote = require('../models/Vote');
const Election = require('../models/election');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');

const normalizeStatus = (status) => {
  if (typeof status !== 'string') return '';

  const value = status.trim().toLowerCase();

  // Support legacy election records without changing the database.
  if (value === 'upcoming') return 'scheduled';

  return value;
};

const castVote = async (req, res) => {
  try {
    const { electionId } = req.params;
    const selections = req.body?.selections;
    const voterId = req.user?.id;

    if (!mongoose.isValidObjectId(voterId)) {
      return res.status(401).json({
        success: false,
        message: 'A valid authenticated voter is required'
      });
    }

    if (!mongoose.isValidObjectId(electionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    if (!Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your ballot must contain at least one selection'
      });
    }

    const election = await Election.findById(electionId);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    const now = new Date();
    const start = new Date(election.startDate);
    const end = new Date(election.endDate);
    const status = normalizeStatus(election.status);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res.status(400).json({
        success: false,
        message: 'Election dates are invalid. Voting is unavailable.'
      });
    }

    // Only explicitly active elections within the voting window accept votes.
    if (status !== 'active' || now < start || now >= end) {
      return res.status(400).json({
        success: false,
        message: 'This election is not currently open for voting'
      });
    }

    const selectionsByPosition = new Map();
    const seenCandidates = new Set();

    // Validate the submitted selections and reject duplicate candidates.
    for (const selection of selections) {
      if (
        !selection ||
        !mongoose.isValidObjectId(selection.position) ||
        !mongoose.isValidObjectId(selection.candidate)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Each selection must contain valid position and candidate IDs'
        });
      }

      const positionId = String(selection.position);
      const candidateId = String(selection.candidate);

      if (seenCandidates.has(candidateId)) {
        return res.status(400).json({
          success: false,
          message: 'You cannot select the same candidate more than once'
        });
      }

      seenCandidates.add(candidateId);

      if (!selectionsByPosition.has(positionId)) {
        selectionsByPosition.set(positionId, []);
      }

      selectionsByPosition.get(positionId).push(candidateId);
    }

    const positionIds = [...selectionsByPosition.keys()];

    const positions = await Position.find({
      _id: { $in: positionIds },
      election: election._id
    });

    if (positions.length !== positionIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more positions do not belong to this election'
      });
    }

    const positionsById = new Map(
      positions.map(position => [String(position._id), position])
    );

    for (const [positionId, candidateIdsForPosition] of selectionsByPosition) {
      const position = positionsById.get(positionId);

      if (
        !position ||
        !Number.isInteger(position.maxSelections) ||
        position.maxSelections < 1
      ) {
        return res.status(400).json({
          success: false,
          message: 'A selected position has an invalid selection limit'
        });
      }

      if (candidateIdsForPosition.length > position.maxSelections) {
        return res.status(400).json({
          success: false,
          message:
            `You may select at most ${position.maxSelections} candidate(s) for ${position.title}`
        });
      }
    }

    const candidateIds = [...seenCandidates];

    const candidates = await Candidate.find({
      _id: { $in: candidateIds },
      election: election._id
    });

    if (candidates.length !== candidateIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more candidates do not belong to this election'
      });
    }

    const candidatePositionMap = new Map(
      candidates.map(candidate => [
        String(candidate._id),
        String(candidate.position)
      ])
    );

    for (const selection of selections) {
      if (
        candidatePositionMap.get(String(selection.candidate)) !==
        String(selection.position)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Each candidate must belong to the selected position'
        });
      }
    }

    // Check whether this voter has already submitted a ballot.
    const existingBallot = await Vote.findOne({
      election: election._id,
      voter: voterId
    });

    if (existingBallot) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted a ballot for this election'
      });
    }

    // The database's unique ballot index remains the final safeguard
    // against simultaneous duplicate submissions.
    const ballot = await Vote.create({
      election: election._id,
      voter: voterId,
      selections: selections.map(selection => ({
        position: selection.position,
        candidate: selection.candidate
      }))
    });

    return res.status(201).json({
      success: true,
      message: 'Your ballot has been submitted successfully',
      data: {
        ballotId: ballot._id,
        electionId: ballot.election,
        submittedAt: ballot.submittedAt
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted a ballot for this election'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Cast vote error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to submit your ballot'
    });
  }
};

module.exports = {
  castVote
};
