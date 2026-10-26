
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

// Email codes expire after 10 minutes.
const OTP_TTL_MS = 10 * 60 * 1000;

// Temporary in-memory limits. We'll move these to shared middleware/storage
// before production deployment.
const resendLimits = new Map();
const verifyLimits = new Map();

const MAX_RESENDS_PER_WINDOW = 3;
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

const generateVerificationCode = () =>
  crypto.randomInt(100000, 1000000).toString();

const hashVerificationCode = (code) =>
  crypto.createHash('sha256').update(code).digest('hex');

const isStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,}$/.test(password);

const normalizeEmail = (email) => email.trim().toLowerCase();

const getLimitState = (map, key, windowMs) => {
  const now = Date.now();
  let state = map.get(key);

  if (!state || now - state.startedAt >= windowMs) {
    state = { startedAt: now, count: 0 };
    map.set(key, state);
  }

  return state;
};

const sendVerificationEmail = async (user, code) => {
  const safeName = user.name.replace(/[&<>"']/g, '');

  await sendEmail({
    to: user.email,
    subject: 'Verify your BallotTrust account',
    html: `
      <p>Hello ${safeName},</p>
      <p>Your BallotTrust email verification code is:</p>
      <h2>${code}</h2>
      <p>This code expires in 10 minutes. Do not share it with anyone.</p>
    `
  });
};

const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof phone !== 'string' || !phone.trim() ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone and password are required'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 12 characters and include uppercase, lowercase, a number, and a special character, with no spaces'
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = phone.trim();

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email or phone number already exists'
      });
    }

    const code = generateVerificationCode();

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password,
      role: 'voter',
      emailVerified: false,
      phoneVerified: false,
      emailVerificationCodeHash: hashVerificationCode(code),
      emailVerificationExpires: new Date(Date.now() + OTP_TTL_MS)
    });

    try {
      await sendVerificationEmail(user, code);
    } catch (emailError) {
      console.error('Verification email failed:', emailError.message);

      // The account remains unverified; the user can request a new code.
      return res.status(502).json({
        success: false,
        message: 'Your account was created, but the email could not be sent. Please request a new verification code.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Account created. Check your email for the verification code.',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email or phone number already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Registration error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during registration'
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (
      typeof email !== 'string' || !email.trim() ||
      typeof code !== 'string' || !/^\d{6}$/.test(code)
    ) {
      return res.status(400).json({
        success: false,
        message: 'A valid email and six-digit verification code are required'
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const limit = getLimitState(verifyLimits, normalizedEmail, VERIFY_WINDOW_MS);

    if (limit.count >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many verification attempts. Try again in 15 minutes.'
      });
    }

    const user = await User.findOne({ email: normalizedEmail })
      .select('+emailVerificationCodeHash +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or verification code'
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified'
      });
    }

    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is invalid or expired. Request a new code.'
      });
    }

    limit.count += 1;

    const suppliedHash = Buffer.from(hashVerificationCode(code), 'hex');
    const storedHash = Buffer.from(user.emailVerificationCodeHash, 'hex');

    const matches =
      suppliedHash.length === storedHash.length &&
      crypto.timingSafeEqual(suppliedHash, storedHash);

    if (!matches) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect verification code'
      });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    verifyLimits.delete(normalizedEmail);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to verify email at this time'
    });
  }
};

const resendEmailCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required'
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const limit = getLimitState(resendLimits, normalizedEmail, RESEND_WINDOW_MS);

    if (limit.count >= MAX_RESENDS_PER_WINDOW) {
      return res.status(429).json({
        success: false,
        message: 'Too many resend requests. Try again in 15 minutes.'
      });
    }

    limit.count += 1;

    const user = await User.findOne({ email: normalizedEmail })
      .select('+emailVerificationCodeHash +emailVerificationExpires');

    // Use the same response for unknown, already-verified and eligible accounts
    // to reduce email-address enumeration.
    const genericResponse = {
      success: true,
      message: 'If the account exists and needs verification, a code will be sent.'
    };

    if (!user || user.emailVerified) {
      return res.status(200).json(genericResponse);
    }

    const code = generateVerificationCode();

    user.emailVerificationCodeHash = hashVerificationCode(code);
    user.emailVerificationExpires = new Date(Date.now() + OTP_TTL_MS);
    await user.save();

    try {
      await sendVerificationEmail(user, code);
    } catch (emailError) {
      console.error('Resend verification email failed:', emailError.message);
      return res.status(502).json({
        success: false,
        message: 'Unable to send a verification email right now. Please try again later.'
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Resend email code error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to process the request at this time'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({
      email: normalizeEmail(email)
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account is inactive'
      });
    }

    // Preserve existing admin access during rollout.
    // New voter accounts must verify their email before login.
    if (user.role !== 'admin' && !user.emailVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.'
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during login'
    });
  }
};

module.exports = {
  register,
  verifyEmail,
  resendEmailCode,
  login
};
