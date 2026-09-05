const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate
} = require('../middlewares/validator');
const authController = require('../controllers/authController');

// POST /api/auth/register
router.post('/register', validateRegister, authController.register);

// POST /api/auth/login
router.post('/login', validateLogin, authController.login);

// GET /api/auth/me  (protected)
router.get('/me', auth, authController.getMe);

// PUT /api/auth/password (protected)
router.put('/password', auth, validatePasswordChange, authController.changePassword);

// PUT /api/auth/profile (protected)
router.put('/profile', auth, validateProfileUpdate, authController.updateProfile);

module.exports = router;
