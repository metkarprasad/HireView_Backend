const express = require('express');
const {
  signup,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  updateProfile,
  googleAuth,
  googleCallback,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.post('/resetpassword', resetPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.put('/profile', protect, updateProfile);

// Google OAuth 2.0 routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

module.exports = router;
