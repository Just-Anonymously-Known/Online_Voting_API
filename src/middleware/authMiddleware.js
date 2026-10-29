
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (
    typeof authHeader !== 'string' ||
    !/^Bearer\s+\S+$/i.test(authHeader.trim())
  ) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }

  const token = authHeader.trim().split(/\s+/)[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('JWT_SECRET is not configured');

    return res.status(500).json({
      success: false,
      message: 'Authentication service is not configured'
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256']
    });
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    console.error('JWT verification error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to authenticate request'
    });
  }

  if (
    !decoded ||
    typeof decoded !== 'object' ||
    typeof decoded.userId !== 'string' ||
    !mongoose.isValidObjectId(decoded.userId)
  ) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }

  try {
    const user = await User.findById(decoded.userId)
      .select('_id role isActive')
      .lean();

    if (!user || user.isActive !== true) {
      return res.status(401).json({
        success: false,
        message: 'Account not found or inactive. Please log in again.'
      });
    }

    req.user = {
      id: String(user._id),
      role: user.role
    };

    return next();
  } catch (error) {
    console.error('Authentication database error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to authenticate request'
    });
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }

    return next();
  };
};

module.exports = {
  protect,
  authorize
};
