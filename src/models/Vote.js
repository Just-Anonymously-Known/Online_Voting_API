
const mongoose = require('mongoose');

const selectionSchema = new mongoose.Schema(
  {
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      required: [true, 'Position is required']
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: [true, 'Candidate is required']
    }
  },
  { _id: false }
);

const voteSchema = new mongoose.Schema(
  {
    election: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      required: [true, 'Election is required']
    },
    voter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Voter is required']
    },
    selections: {
      type: [selectionSchema],
      required: true,
      validate: [
        {
          validator: selections =>
            Array.isArray(selections) && selections.length > 0,
          message: 'A ballot must contain at least one selection'
        },
        {
          validator: selections => {
            const candidateIds = selections.map(
              selection => String(selection.candidate)
            );

            return candidateIds.length === new Set(candidateIds).size;
          },
          message: 'A candidate cannot be selected more than once'
        }
      ]
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  { timestamps: true }
);

// One ballot per voter per election.
voteSchema.index(
  { election: 1, voter: 1 },
  { unique: true, name: 'unique_voter_ballot_per_election' }
);

module.exports = mongoose.model('Vote', voteSchema);
