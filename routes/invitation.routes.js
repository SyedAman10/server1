const express = require('express');
const {
  inviteUser,
  inviteMultipleUsers,
  acceptInvitation,
  acceptInvitationAPI,
  getMyInvitations,
  getCourseInvitations,
  cancelInvitation,
  createInvitation
} = require('../controllers/invitation.controller');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Create optional auth middleware (doesn't fail if not authenticated)
const optionalAuthenticate = async (req, res, next) => {
  try {
    // Try to authenticate if token is present
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { getUserById } = require('../models/user.model');
      const user = await getUserById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Continue even if authentication fails
    console.log('Optional auth failed, continuing without user:', error.message);
    next();
  }
};

// Accept invitation via GET (from email link) - may not be authenticated yet
// This route MUST be before the authenticate middleware
router.get('/accept/:token', optionalAuthenticate, (req, res, next) => {
  console.log('🔗 Invitation accept route hit:', req.params.token);
  console.log('🔑 User authenticated?', !!req.user);
  next();
}, acceptInvitation);

// All other routes require authentication
router.use(authenticate);

// Invite user(s) to course (teachers and admins only)
router.post('/invite', requireRole('teacher', 'super_admin'), inviteUser);
router.post('/invite-multiple', requireRole('teacher', 'super_admin'), inviteMultipleUsers);

// Create invitation (for backwards compatibility with classroom routes)
router.post('/', requireRole('teacher', 'super_admin'), (req, res) => {
  // Forward to inviteUser if createInvitation doesn't exist
  if (createInvitation) {
    return createInvitation(req, res);
  } else {
    return inviteUser(req, res);
  }
});

// Accept invitation via API (authenticated users)
router.post('/accept', acceptInvitationAPI);

// Get my pending invitations
router.get('/my-invitations', getMyInvitations);

// Get invitations for a course (teachers and admins only)
router.get('/course/:courseId', requireRole('teacher', 'super_admin'), getCourseInvitations);

// Cancel invitation (teachers and admins only)
router.delete('/:invitationId', requireRole('teacher', 'super_admin'), cancelInvitation);

module.exports = router;

