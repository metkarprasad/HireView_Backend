const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const emailService = require('../services/emailService');

// Helper to generate 6-digit secure numeric OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Helper to hash OTP or token with SHA-256
const hashSecret = (secret) => {
  return crypto.createHash('sha256').update(String(secret).trim()).digest('hex');
};

// Generate Token helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkey123', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// @desc    Register a user (creates unverified user and sends OTP)
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res, next) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide username, email, and password' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if user already exists
    let user = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: username.trim() }],
    });

    const otp = generateOTP();
    const otpHash = hashSecret(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (user) {
      // If user exists and is already verified
      if (user.emailVerified || user.status === 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: 'An active account already exists with this email or username. Please sign in.',
        });
      }

      // If user exists but is unverified, update credentials and send a fresh OTP
      user.username = username.trim();
      user.password = password; // pre-save will bcrypt hash
      user.otpHash = otpHash;
      user.otpPurpose = 'EMAIL_VERIFICATION';
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;
      user.otpLastSentAt = new Date();
      await user.save();

      await emailService.sendVerificationEmail(user.email, user.username, otp);

      return res.status(200).json({
        success: true,
        requiresVerification: true,
        message: 'A verification code has been sent to your email.',
        email: user.email,
      });
    }

    // New user creation
    user = new User({
      username: username.trim(),
      email: normalizedEmail,
      password,
      emailVerified: false,
      status: 'PENDING_VERIFICATION',
      otpHash,
      otpPurpose: 'EMAIL_VERIFICATION',
      otpExpiresAt,
      otpAttempts: 0,
      otpLastSentAt: new Date(),
    });

    await user.save();

    await emailService.sendVerificationEmail(user.email, user.username, otp);

    res.status(201).json({
      success: true,
      requiresVerification: true,
      message: 'Account created successfully. Please verify your email with the 6-digit code sent.',
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP for Email Verification or Password Reset
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  const { email, otp, purpose = 'EMAIL_VERIFICATION' } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Please provide email and 6-digit verification code' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address' });
    }

    // Check OTP Purpose
    if (!user.otpPurpose || user.otpPurpose !== purpose) {
      return res.status(400).json({ success: false, message: 'Invalid verification request or purpose mismatch.' });
    }

    // Check Expiration
    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.',
      });
    }

    // Check Max Attempts
    if (user.otpAttempts >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new verification code.',
      });
    }

    // Compare Hash
    const incomingHash = hashSecret(otp);
    if (incomingHash !== user.otpHash) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      const attemptsLeft = Math.max(0, 5 - user.otpAttempts);
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${attemptsLeft} attempt(s) remaining.`,
      });
    }

    // OTP is valid - clear OTP fields
    user.otpHash = undefined;
    user.otpPurpose = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;

    if (purpose === 'EMAIL_VERIFICATION') {
      user.emailVerified = true;
      user.status = 'ACTIVE';
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully! You can now sign in to your account.',
      });
    }

    if (purpose === 'FORGOT_PASSWORD') {
      // Generate short-lived reset authorization token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetAuthorizationToken = hashSecret(resetToken);
      user.resetAuthorizationExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Verification code confirmed. Please set your new password.',
        resetToken,
      });
    }

    return res.status(400).json({ success: false, message: 'Unsupported verification purpose.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend OTP with 60-second cooldown
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOtp = async (req, res, next) => {
  const { email, purpose = 'EMAIL_VERIFICATION' } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Please provide email address' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address' });
    }

    if (purpose === 'EMAIL_VERIFICATION' && user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This email is already verified. Please sign in.',
      });
    }

    // 60-Second Cooldown Enforcement
    if (user.otpLastSentAt) {
      const elapsedMs = Date.now() - user.otpLastSentAt.getTime();
      if (elapsedMs < 60000) {
        const remainingSeconds = Math.ceil((60000 - elapsedMs) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSeconds} second(s) before requesting another code.`,
          retryAfter: remainingSeconds,
        });
      }
    }

    const otp = generateOTP();
    user.otpHash = hashSecret(otp);
    user.otpPurpose = purpose;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    if (purpose === 'FORGOT_PASSWORD') {
      await emailService.sendPasswordResetOtpEmail(user.email, user.username, otp);
    } else {
      await emailService.sendVerificationEmail(user.email, user.username, otp);
    }

    res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user with email verification protection
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide an email and password' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check for user (must explicitly select password since select: false)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if account was registered with Google (no password set)
    if (!user.password) {
      if (user.googleId || user.authProvider === 'google') {
        return res.status(400).json({
          success: false,
          message: 'This account was registered using Google Sign-In. Please click "Continue with Google" to sign in.',
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Protect Login: Block unverified users
    if (!user.emailVerified || user.status === 'PENDING_VERIFICATION') {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Your email address has not been verified yet. Please verify your email before signing in.',
        email: user.email,
      });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact support.',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - send 6-digit OTP to email
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Please provide your email address' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address' });
    }

    // Cooldown check for forgot password requests
    if (user.otpLastSentAt && user.otpPurpose === 'FORGOT_PASSWORD') {
      const elapsedMs = Date.now() - user.otpLastSentAt.getTime();
      if (elapsedMs < 60000) {
        const remainingSeconds = Math.ceil((60000 - elapsedMs) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSeconds} second(s) before requesting another reset code.`,
          retryAfter: remainingSeconds,
        });
      }
    }

    const otp = generateOTP();
    user.otpHash = hashSecret(otp);
    user.otpPurpose = 'FORGOT_PASSWORD';
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    await emailService.sendPasswordResetOtpEmail(user.email, user.username, otp);

    res.status(200).json({
      success: true,
      message: 'A 6-digit password reset code has been sent to your email.',
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using reset authorization token
// @route   POST /api/auth/resetpassword and PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  const token = req.body.resetToken || req.params.resettoken;
  const newPassword = req.body.newPassword || req.body.password;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid reset authorization token and new password',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters in length',
    });
  }

  const hashedToken = hashSecret(token);

  try {
    const user = await User.findOne({
      $or: [
        {
          resetAuthorizationToken: hashedToken,
          resetAuthorizationExpiresAt: { $gt: new Date() },
        },
        {
          resetPasswordToken: hashedToken,
          resetPasswordExpire: { $gt: new Date() },
        },
      ],
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset authorization. Please request a new code.',
      });
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    user.resetAuthorizationToken = undefined;
    user.resetAuthorizationExpiresAt = undefined;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.otpHash = undefined;
    user.otpPurpose = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now sign in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.body.username) user.username = req.body.username.trim();
    if (req.body.email) user.email = req.body.email.toLowerCase().trim();
    if (req.body.password) user.password = req.body.password;

    await user.save();

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate Google OAuth 2.0 / OpenID Connect Login Flow
// @route   GET /api/auth/google
// @access  Public
exports.googleAuth = async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!clientId || !clientSecret) {
      console.warn('[GOOGLE OAUTH] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from environment.');
      return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
    }

    // Determine callback URL
    const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    // Generate tamper-proof signed CSRF state
    const rawState = crypto.randomBytes(16).toString('hex');
    const secret = process.env.JWT_SECRET || 'supersecretkey123';
    const hmacSig = crypto.createHmac('sha256', secret).update(rawState).digest('hex');
    const state = `${rawState}.${hmacSig}`;

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', callbackUrl);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('state', state);

    return res.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('[GOOGLE OAUTH ERROR] Failed to initiate Google Auth:', error.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?error=google_failed`);
  }
};

// @desc    Handle Google OAuth 2.0 Callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = async (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.warn('[GOOGLE OAUTH] User cancelled or OAuth error returned:', oauthError);
      return res.redirect(`${frontendUrl}/login?error=google_cancelled`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=missing_code`);
    }

    // Validate CSRF state signature
    if (!state || !state.includes('.')) {
      console.warn('[GOOGLE OAUTH] Missing or malformed state parameter in callback');
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    const [rawState, sig] = state.split('.');
    const secret = process.env.JWT_SECRET || 'supersecretkey123';
    const expectedSig = crypto.createHmac('sha256', secret).update(rawState).digest('hex');

    if (sig !== expectedSig) {
      console.warn('[GOOGLE OAUTH] Invalid CSRF state signature received');
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    // 1. Exchange authorization code for Google access token
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    const { access_token } = tokenResponse.data;

    // 2. Fetch authenticated user profile from Google OpenID Userinfo
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      timeout: 10000,
    });

    const googleProfile = profileResponse.data;

    if (!googleProfile || !googleProfile.email) {
      console.warn('[GOOGLE OAUTH] Google profile is missing verified email');
      return res.redirect(`${frontendUrl}/login?error=missing_email`);
    }

    const normalizedEmail = googleProfile.email.toLowerCase().trim();
    const googleId = googleProfile.sub;
    const profileImage = googleProfile.picture || '';
    const cleanName = (googleProfile.name || normalizedEmail.split('@')[0]).trim() || 'Candidate';

    // 3. Find or create user
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists with matching verified email
      user = await User.findOne({ email: normalizedEmail });

      if (user) {
        // Link Google ID to existing account
        user.googleId = googleId;
        if (profileImage && !user.profileImage) {
          user.profileImage = profileImage;
        }
        // Google has verified this email
        user.emailVerified = true;
        user.status = 'ACTIVE';

        // Restore clean original name if available without conflict
        const existingUsernameOwner = await User.findOne({ username: cleanName, _id: { $ne: user._id } });
        if (!existingUsernameOwner) {
          user.username = cleanName;
        }

        await user.save();
      } else {
        // Use clean original name directly without adding random numbers
        let candidateUsername = cleanName;
        const existingUserWithUsername = await User.findOne({ username: candidateUsername });
        if (existingUserWithUsername) {
          const emailPrefix = normalizedEmail.split('@')[0];
          const existingPrefix = await User.findOne({ username: emailPrefix });
          candidateUsername = existingPrefix ? cleanName : emailPrefix;
        }

        user = new User({
          username: candidateUsername,
          email: normalizedEmail,
          googleId,
          profileImage,
          emailVerified: true,
          status: 'ACTIVE',
          authProvider: 'google',
        });
        await user.save();
      }
    } else {
      // Existing Google user - ensure active status and restore clean original name
      if (!user.emailVerified || user.status === 'PENDING_VERIFICATION') {
        user.emailVerified = true;
        user.status = 'ACTIVE';
      }

      // Restore clean original name if available without conflict
      const existingUsernameOwner = await User.findOne({ username: cleanName, _id: { $ne: user._id } });
      if (!existingUsernameOwner) {
        user.username = cleanName;
      }

      if (profileImage && !user.profileImage) {
        user.profileImage = profileImage;
      }
      await user.save();
    }

    // 4. Generate standard HireView JWT token
    const token = generateToken(user._id);

    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      profileImage: user.profileImage || profileImage || '',
    };

    // 5. Securely hand off token to frontend via URL params
    const redirectUrl = new URL(`${frontendUrl}/login`);
    redirectUrl.searchParams.set('google_token', token);
    redirectUrl.searchParams.set('user', JSON.stringify(userData));

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[GOOGLE OAUTH ERROR] Callback failed:', error.response?.data || error.message);
    return res.redirect(`${frontendUrl}/login?error=google_failed`);
  }
};
