
const express = require('express');
const { register, login } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// Temporary authentication test endpoint
router.get('/me', protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    data: {
      userId: req.user.id,
      role: req.user.role
    }
  });
});

module.exports = router;
