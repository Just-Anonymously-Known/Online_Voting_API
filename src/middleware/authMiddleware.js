
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token || !process.env.JWT_SECRET) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const user = await User.findById(decoded.userId).select('_id role isActive');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account not found or inactive. Please log in again.'
      });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError' ||
        error.name === 'CastError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    console.error('Authentication error:', error.message);

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

    next();
  };
};

module.exports = { protect, authorize };
