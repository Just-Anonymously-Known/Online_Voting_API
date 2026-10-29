
const mongoose = require('mongoose');
const Vote = require('../models/Vote');
const Election = require('../models/election');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');

const getElectionResults = async (req, res) => {
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

    const isAdmin = req.user?.role === 'admin';
    const status = String(election.status || '')
      .trim()
      .toLowerCase();

    const now = new Date();
    const start = new Date(election.startDate);
    const end = new Date(election.endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res.status(400).json({
        success: false,
        message: 'Election dates are invalid. Results are unavailable.'
      });
    }

    // Admins may view provisional results only while
    // the election is active and within its voting window.
    if (status === 'active') {
      if (!isAdmin || now < start || now >= end) {
        return res.status(403).json({
          success: false,
          message:
            'Results are unavailable until the election is completed'
        });
      }
    } else if (status === 'completed') {
      // Never release final results before the scheduled end date.
      if (now < end) {
        return res.status(403).json({
          success: false,
          message:
            'Final results are unavailable before the election end date'
        });
      }
    } else {
      // Draft, scheduled, cancelled and unknown statuses.
      return res.status(403).json({
        success: false,
        message: 'Results are unavailable for this election'
      });
    }

    const positions = await Position.find({
      election: election._id
    }).sort({ title: 1 });

    const results = await Promise.all(
      positions.map(async (position) => {
        const candidates = await Candidate.find({
          election: election._id,
          position: position._id
        }).sort({ name: 1 });

        const totals = await Vote.aggregate([
          {
            $match: {
              election: election._id
            }
          },
          {
            $unwind: '$selections'
          },
          {
            $match: {
              'selections.position': position._id
            }
          },
          {
            $group: {
              _id: '$selections.candidate',
              votes: { $sum: 1 }
            }
          }
        ]);

        const totalsByCandidate = new Map(
          totals.map((item) => [
            String(item._id),
            item.votes
          ])
        );

        const candidateResults = candidates.map((candidate) => ({
          candidateId: candidate._id,
          name: candidate.name,
          photoUrl: candidate.photoUrl,
          votes: totalsByCandidate.get(String(candidate._id)) || 0
        }));

        // This is the total number of selections for this position,
        // not necessarily the number of unique voters.
        const totalVotes = candidateResults.reduce(
          (sum, candidate) => sum + candidate.votes,
          0
        );

        return {
          positionId: position._id,
          positionTitle: position.title,
          totalVotes,
          candidates: candidateResults.map((candidate) => ({
            ...candidate,
            percentage: totalVotes > 0
              ? Number(
                  ((candidate.votes / totalVotes) * 100).toFixed(2)
                )
              : 0
          }))
        };
      })
    );

    return res.status(200).json({
      success: true,
      election: {
        id: election._id,
        title: election.title,
        status
      },
      provisional: status !== 'completed',
      results
    });
  } catch (error) {
    console.error('Get election results error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve election results'
    });
  }
};

module.exports = {
  getElectionResults
};
