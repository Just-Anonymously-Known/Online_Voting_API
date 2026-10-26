
const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Election title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    startDate: {
      type: Date,
      required: [true, 'Election start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'Election end date is required'],
      validate: {
        validator: function (value) {
          return !this.startDate || value > this.startDate;
        },
        message: 'End date must be after start date'
      }
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'completed', 'cancelled'],
      default: 'draft'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Election', electionSchema);
