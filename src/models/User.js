
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [12, 'Password must be at least 12 characters'],
      validate: {
        validator: function (password) {
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,}$/.test(password);
        },
        message:
          'Password must be at least 12 characters and include uppercase, lowercase, a number, and a special character, with no spaces'
      }
    },

    role: {
      type: String,
      enum: ['voter', 'admin'],
      default: 'voter'
    },

    // Verification status
    emailVerified: {
      type: Boolean,
      default: false
    },

    phoneVerified: {
      type: Boolean,
      default: false
    },

    // Email OTP verification
    emailVerificationCodeHash: {
      type: String,
      select: false
    },

    emailVerificationExpires: {
      type: Date,
      select: false
    },

    // Phone OTP verification (for future SMS integration)
    phoneVerificationPinId: {
      type: String,
      select: false
    },

    phoneVerificationExpires: {
      type: Date,
      select: false
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Hash the password before saving a new password
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 12);
});

// Compare a submitted password with the stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
