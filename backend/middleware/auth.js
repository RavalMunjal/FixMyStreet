const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized: No authentication token provided',
        });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fixmystreet_super_secret_jwt_key_2026'
      );

      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized: User account no longer exists',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired: Please log in again',
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Not authorized: Invalid authentication token',
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Bearer token required in authorization header',
    });
  }
};

module.exports = { protect };
