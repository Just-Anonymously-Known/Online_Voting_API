
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,}$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters']
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
        validator(password) {
          return PASSWORD_REGEX.test(password);
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

    emailVerified: {
      type: Boolean,
      default: false
    },

    phoneVerified: {
      type: Boolean,
      default: false
    },

    emailVerificationCodeHash: {
      type: String,
      select: false
    },

    emailVerificationExpires: {
      type: Date,
      select: false
    },

    phoneVerificationPinId: {
      type: String,
      select: false
    },

    phoneVerificationExpires: {
      type: Date,
      select: false
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
