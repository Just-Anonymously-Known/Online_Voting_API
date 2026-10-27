
const mongoose = require('mongoose');
const Vote = require('../models/Vote');
const Election = require('../models/election');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');

const castVote = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { selections } = req.body;
    const voterId = req.user.id;

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

    if (
      election.status !== 'active' ||
      now < new Date(election.startDate) ||
      now > new Date(election.endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: 'This election is not currently open for voting'
      });
    }

    // Validate every selection before recording the ballot.
    const selectedPositions = new Set();
    const selectionsByPosition = new Map();

    for (const selection of selections) {
      if (
        !selection ||
        !mongoose.isValidObjectId(selection.position) ||
        !mongoose.isValidObjectId(selection.candidate)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Each selection must contain valid position and candidate IDs'
        });
      }

      const positionId = String(selection.position);
      const candidateId = String(selection.candidate);

      if (!selectionsByPosition.has(positionId)) {
        selectionsByPosition.set(positionId, []);
      }

      const candidatesForPosition = selectionsByPosition.get(positionId);

      if (candidatesForPosition.includes(candidateId)) {
        return res.status(400).json({
          success: false,
          message: 'You cannot select the same candidate more than once'
        });
      }

      candidatesForPosition.push(candidateId);
      selectedPositions.add(positionId);
    }

    const positionIds = [...selectedPositions];

    const positions = await Position.find({
      _id: { $in: positionIds },
      election: election._id
    });

    if (positions.length !== positionIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected positions do not belong to this election'
      });
    }

    for (const position of positions) {
      const chosenCandidates =
        selectionsByPosition.get(String(position._id)) || [];

      if (chosenCandidates.length > position.maxSelections) {
        return res.status(400).json({
          success: false,
          message: `You may select at most ${position.maxSelections} candidate(s) for ${position.title}`
        });
      }
    }

    const candidateIds = selections.map(
      selection => String(selection.candidate)
    );

    const candidates = await Candidate.find({
      _id: { $in: candidateIds },
      election: election._id,
      position: { $in: positionIds }
    });

    if (candidates.length !== candidateIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more candidates do not match the selected positions'
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
          message: 'Each candidate must belong to the position selected for them'
        });
      }
    }

    // The unique database index on election + voter is the final
    // protection against duplicate ballot submissions.
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
    // Handle concurrent duplicate submissions safely.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted a ballot for this election'
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
