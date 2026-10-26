
const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Position title is required'],
      trim: true,
      maxlength: [100, 'Position title cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    election: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      required: [true, 'Election ID is required']
    },
    maxSelections: {
      type: Number,
      default: 1,
      min: [1, 'At least one selection must be allowed'],
      validate: {
        validator: Number.isInteger,
        message: 'Maximum selections must be a whole number'
      }
    }
  },
  { timestamps: true }
);

// Prevent duplicate position titles within the same election
positionSchema.index(
  { election: 1, title: 1 },
  { unique: true }
);

module.exports = mongoose.model('Position', positionSchema);
