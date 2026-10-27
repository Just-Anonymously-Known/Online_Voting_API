
const mongoose = require('mongoose');

const selectionSchema = new mongoose.Schema(
  {
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      required: true
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true
    }
  },
  { _id: false }
);

const voteSchema = new mongoose.Schema(
  {
    election: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      required: true
    },
    voter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    selections: {
      type: [selectionSchema],
      required: true,
      validate: {
        validator: function (selections) {
          return Array.isArray(selections) && selections.length > 0;
        },
        message: 'A ballot must contain at least one selection'
      }
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Enforce one ballot per voter per election at database level.
voteSchema.index(
  { election: 1, voter: 1 },
  { unique: true }
);

module.exports = mongoose.model('Vote', voteSchema);
