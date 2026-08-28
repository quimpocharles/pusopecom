import jwt from 'jsonwebtoken';
import * as userRepository from '../repositories/userRepository.js';
import { hasPermission, hasAnyPermission } from '../lib/permissions.js';

// staffProfile is included on every authenticated request, not just admin
// ones — the alternative (a second query once role is known to be admin)
// would mean the include depends on data from the same query that hasn't
// resolved yet. StaffProfile is a tiny 1:1 table; the extra join is
// negligible next to the User lookup every authenticated request already does.
// Exported so routes/auth.js's login/Google handlers can fetch the same
// shape — generateAuthResponse() needs staffProfile present immediately at
// login, not just on the next /me refetch, or a non-executive admin would
// briefly see full nav access until the page reloads.
export const AUTH_INCLUDE = { addresses: true, staffProfile: true };

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userRepository.findById(decoded.userId, { include: AUTH_INCLUDE });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Mongoose's toJSON() stripped these implicitly on every res.json() call;
    // Prisma has no such hook, so it must happen explicitly here instead —
    // once, on every authenticated request, rather than at each route.
    req.user = userRepository.sanitize(user);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    // Launch-readiness audit fix — StaffProfile.active existed in the
    // schema but nothing ever read it; deactivating a staff member had no
    // actual access-control effect. authenticate() above re-fetches
    // staffProfile fresh from the DB on every request (never cached in the
    // JWT itself), so this takes effect immediately on the very next
    // request — including one made with a token issued before the account
    // was deactivated. A user with no StaffProfile at all (the bootstrap
    // rule — see lib/permissions.js) is untouched by this check.
    if (req.user.staffProfile && req.user.staffProfile.active === false) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This staff account has been deactivated.'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userRepository.findById(decoded.userId, { include: AUTH_INCLUDE });
      if (user) {
        req.user = userRepository.sanitize(user);
      }
    }
    next();
  } catch (error) {
    next();
  }
};

/** Requires authenticate+isAdmin to have already run — checks a single permission string against req.user's StaffProfile. */
export const requirePermission = (permission) => (req, res, next) => {
  if (!hasPermission(req.user, permission)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have permission to perform this action.'
    });
  }
  next();
};

/** Like requirePermission, but passes if the user holds any one of several permissions — for endpoints two departments legitimately share. */
export const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!hasAnyPermission(req.user, permissions)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have permission to perform this action.'
    });
  }
  next();
};
