
const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Candidate name is required'],
      trim: true,
      maxlength: [120, 'Candidate name cannot exceed 120 characters']
    },
    manifesto: {
      type: String,
      trim: true,
      default: '',
      maxlength: [3000, 'Manifesto cannot exceed 3000 characters']
    },
    photoUrl: {
      type: String,
      trim: true,
      default: ''
    },
    flyerUrl: {
      type: String,
      trim: true,
      default: ''
    },
    manifestoImages: {
      type: [{
        type: String,
        trim: true
      }],
      default: [],
      validate: {
        validator: function (images) {
          return images.length <= 5;
        },
        message: 'A maximum of 5 manifesto images is allowed'
      }
    },
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      required: [true, 'Position is required']
    },
    election: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      required: [true, 'Election is required']
    }
  },
  { timestamps: true }
);

candidateSchema.index({ position: 1, name: 1 });

module.exports = mongoose.model('Candidate', candidateSchema);
