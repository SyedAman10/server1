const express = require('express');
const {
  inviteUser,
  inviteMultipleUsers,
  acceptInvitation,
  acceptInvitationAPI,
  getMyInvitations,
  getCourseInvitations,
  cancelInvitation
} = require('../controllers/invitation.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Accept invitation via GET (from email link) - may not be authenticated yet
// This route MUST be before the authenticate middleware
router.get('/accept/:token', (req, res, next) => {
  console.log('🔗 Invitation accept route hit:', req.params.token);
  console.log('🔑 User authenticated?', !!req.user);
  next();
}, acceptInvitation);

// All other routes require authentication
router.use(authenticate);

// Invite user(s) to course (teachers and admins only)
router.post('/invite', requireRole('teacher', 'super_admin'), inviteUser);
router.post('/invite-multiple', requireRole('teacher', 'super_admin'), inviteMultipleUsers);

// Accept invitation via API (authenticated users)
router.post('/accept', acceptInvitationAPI);

// Get my pending invitations
router.get('/my-invitations', getMyInvitations);

// Get invitations for a course (teachers and admins only)
router.get('/course/:courseId', requireRole('teacher', 'super_admin'), getCourseInvitations);

// Cancel invitation (teachers and admins only)
router.delete('/:invitationId', requireRole('teacher', 'super_admin'), cancelInvitation);

module.exports = router;

