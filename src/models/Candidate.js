
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

    photoPublicId: {
      type: String,
      trim: true,
      default: ''
    },

    flyerUrl: {
      type: String,
      trim: true,
      default: ''
    },

    flyerPublicId: {
      type: String,
      trim: true,
      default: ''
    },

    manifestoImages: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      default: [],
      validate: {
        validator: (images) => images.length <= 5,
        message: 'A maximum of 5 manifesto images is allowed'
      }
    },

    manifestoImagePublicIds: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      default: [],
      validate: {
        validator: function (publicIds) {
          // Support legacy records that have URLs but no stored public IDs.
          if (publicIds.length === 0) {
            return true;
          }

          return (
            publicIds.length === this.manifestoImages.length &&
            publicIds.every((publicId) => publicId.length > 0)
          );
        },
        message:
          'Manifesto image URLs and Cloudinary public IDs must match'
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
  {
    timestamps: true
  }
);

// Supports listing candidates by position and name.
candidateSchema.index({
  position: 1,
  name: 1
});

module.exports = mongoose.model('Candidate', candidateSchema);
