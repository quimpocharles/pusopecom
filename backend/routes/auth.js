import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import * as userRepository from '../repositories/userRepository.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate auth response with JWT
const generateAuthResponse = (user) => {
  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      ageVerified: user.ageVerified,
      addresses: user.addresses,
      role: user.role,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
      authProvider: user.authProvider
    }
  };
};

// Register
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password, firstName, lastName, phone } = req.body;

      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');

      const user = await userRepository.create({
        email,
        password,
        firstName,
        lastName,
        phone,
        verificationToken
      });

      await sendVerificationEmail(email, firstName, verificationToken);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }
  }
);

// Verify Email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    const user = await userRepository.findByVerificationToken(token);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    await userRepository.updateById(user._id, {
      emailVerified: true,
      verificationToken: null
    });

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
});

// Login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const { email, password } = req.body;

      let user = await userRepository.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      if (user.accountLocked) {
        return res.status(403).json({
          success: false,
          accountLocked: true,
          message: 'Your account has been locked due to too many failed login attempts. Please reset your password.'
        });
      }

      const isPasswordValid = await userRepository.comparePassword(user, password);
      if (!isPasswordValid) {
        const failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        const accountLocked = failedLoginAttempts >= 5;
        await userRepository.updateById(user._id, { failedLoginAttempts, accountLocked });

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          ...(accountLocked && { accountLocked: true })
        });
      }

      if (user.failedLoginAttempts > 0) {
        user = await userRepository.updateById(user._id, { failedLoginAttempts: 0 });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email before logging in',
          emailVerified: false
        });
      }

      const authResponse = generateAuthResponse(user);

      res.json({
        success: true,
        message: 'Login successful',
        ...authResponse
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed. Please try again.'
      });
    }
  }
);

// Resend Verification Email
router.post('/resend-verification',
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email'
        });
      }

      const { email } = req.body;

      const user = await userRepository.findByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email already verified'
        });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      await userRepository.updateById(user._id, { verificationToken });

      await sendVerificationEmail(email, user.firstName, verificationToken);

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }
  }
);

// Forgot Password
router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email'
        });
      }

      const { email } = req.body;

      const user = await userRepository.findByEmail(email);
      if (!user) {
        return res.json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.'
        });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      await userRepository.updateById(user._id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: new Date(Date.now() + 3600000) // 1 hour
      });

      await sendPasswordResetEmail(email, user.firstName, resetToken);

      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request'
      });
    }
  }
);

// Reset Password
router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 6 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input'
        });
      }

      const { token, password } = req.body;

      const user = await userRepository.findByResetToken(token);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      await userRepository.updateById(user._id, {
        password,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        failedLoginAttempts: 0,
        accountLocked: false
      });

      res.json({
        success: true,
        message: 'Password reset successful. You can now log in with your new password.'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  }
);

// Get Current User
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user information'
    });
  }
});

// Complete Profile (add phone and address)
router.put('/complete-profile', authenticate, async (req, res) => {
  try {
    const { phone, ageVerified, address } = req.body;

    let user = await userRepository.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updates = {};
    if (ageVerified) updates.ageVerified = true;
    if (phone) updates.phone = phone;
    if (Object.keys(updates).length > 0) {
      user = await userRepository.updateById(user._id, updates);
    }

    if (address) {
      user = await userRepository.addAddress(user._id, { ...address, isDefault: true });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        ageVerified: user.ageVerified,
        addresses: user.addresses,
        role: user.role,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
        authProvider: user.authProvider
      }
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Google OAuth Login
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
    }

    // Verify access token by calling Google userinfo endpoint
    const googleResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${credential}` } }
    );

    if (!googleResponse.ok) {
      throw new Error('Failed to verify Google token');
    }

    const payload = await googleResponse.json();
    const { sub: googleId, email, given_name, family_name, picture } = payload;

    // Find existing user by googleId or email
    let user = await userRepository.findByGoogleIdOrEmail(googleId, email);

    if (user) {
      // Update Google info on each login
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      // Always update avatar from Google if available
      if (picture) updates.avatar = picture;
      if (Object.keys(updates).length > 0) {
        user = await userRepository.updateById(user._id, updates);
      }
    } else {
      // Create new user
      user = await userRepository.create({
        email,
        firstName: given_name || 'User',
        lastName: family_name || '',
        googleId,
        avatar: picture,
        authProvider: 'google',
        emailVerified: true // Google already verified the email
      });
    }

    const authResponse = generateAuthResponse(user);

    res.json({
      success: true,
      message: 'Google login successful',
      ...authResponse
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Google authentication failed'
    });
  }
});

// Update Profile
router.put('/profile',
  authenticate,
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('phone').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { firstName, lastName, phone } = req.body;

      const updates = { firstName, lastName };
      if (phone !== undefined) updates.phone = phone;

      const user = await userRepository.updateById(req.user._id, updates);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName,
          phone: user.phone, ageVerified: user.ageVerified, addresses: user.addresses,
          role: user.role, emailVerified: user.emailVerified, avatar: user.avatar, authProvider: user.authProvider
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  }
);

// Change Password
router.put('/password',
  authenticate,
  [
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      // req.user is sanitized (no password field) — fetch the raw record
      // to actually compare against the stored hash.
      const user = await userRepository.findById(req.user._id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      // If user has a password (local auth), verify current password
      if (user.password) {
        if (!currentPassword) {
          return res.status(400).json({ success: false, message: 'Current password is required' });
        }
        const isValid = await userRepository.comparePassword(user, currentPassword);
        if (!isValid) {
          return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
      }

      await userRepository.updateById(user._id, { password: newPassword });

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ success: false, message: 'Failed to change password' });
    }
  }
);

// Add Address
router.post('/addresses', authenticate, async (req, res) => {
  try {
    const user = await userRepository.addAddress(req.user._id, req.body);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'Address added successfully', addresses: user.addresses });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ success: false, message: 'Failed to add address' });
  }
});

// Update Address
router.put('/addresses/:addressId', authenticate, async (req, res) => {
  try {
    // updateAddress ownership-checks addressId against req.user._id itself —
    // returning null both when the user doesn't exist and when the address
    // isn't theirs, so one user can never modify another's address via this route.
    const user = await userRepository.updateAddress(req.user._id, req.params.addressId, req.body);
    if (!user) return res.status(404).json({ success: false, message: 'Address not found' });

    res.json({ success: true, message: 'Address updated successfully', addresses: user.addresses });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
});

// Delete Address
router.delete('/addresses/:addressId', authenticate, async (req, res) => {
  try {
    const user = await userRepository.deleteAddress(req.user._id, req.params.addressId);
    if (!user) return res.status(404).json({ success: false, message: 'Address not found' });

    res.json({ success: true, message: 'Address deleted successfully', addresses: user.addresses });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
});

// Get all users (Admin only)
router.get('/admin/users',
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role
      } = req.query;

      const where = {};
      if (role) where.role = role;
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [users, total] = await Promise.all([
        userRepository.find({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit)
          // addresses come back too, via find()'s default include — matches
          // the original, which never excluded them (they were embedded).
        }),
        userRepository.count({ where })
      ]);

      res.json({
        success: true,
        data: users.map(userRepository.sanitize),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
      });
    }
  }
);

export default router;
