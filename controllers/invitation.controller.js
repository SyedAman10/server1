const invitationService = require('../services/invitationService');

// Invite a user to a course
const inviteUser = async (req, res) => {
  try {
    const { courseId, inviteeEmail, inviteeRole } = req.body;
    const inviterUserId = req.user.id;
    const inviterName = req.user.name;

    if (!courseId || !inviteeEmail || !inviteeRole) {
      return res.status(400).json({
        success: false,
        error: 'Course ID, invitee email, and role are required'
      });
    }

    const result = await invitationService.inviteUser({
      courseId,
      inviterUserId,
      inviteeEmail,
      inviteeRole,
      inviterName
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Invite user error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('already') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
};

// Invite multiple users to a course
const inviteMultipleUsers = async (req, res) => {
  try {
    const { courseId, inviteeEmails, inviteeRole } = req.body;
    const inviterUserId = req.user.id;
    const inviterName = req.user.name;

    if (!courseId || !inviteeEmails || !Array.isArray(inviteeEmails) || inviteeEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Course ID and array of invitee emails are required'
      });
    }

    if (!inviteeRole) {
      return res.status(400).json({
        success: false,
        error: 'Invitee role is required'
      });
    }

    const result = await invitationService.inviteMultipleUsers({
      courseId,
      inviterUserId,
      inviteeEmails,
      inviteeRole,
      inviterName
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Invite multiple users error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Accept invitation (with token from URL)
const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Invitation token is required'
      });
    }
    
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      // Redirect to frontend login with invitation token
      const frontendUrl = process.env.FRONTEND_URL || 'https://xytek-classroom-assistant.vercel.app';
      console.log(`Redirecting unauthenticated user to: ${frontendUrl}/login?returnTo=/accept-invitation/${token}`);
      return res.redirect(302, `${frontendUrl}/login?returnTo=${encodeURIComponent(`/accept-invitation/${token}`)}`);
    }

    // User is authenticated, accept the invitation
    const result = await invitationService.acceptInvitation({
      token,
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.name
    });

    // Redirect to course page with the correct URL format
    const frontendUrl = process.env.FRONTEND_URL || 'https://xytek-classroom-assistant.vercel.app';
    const coursePageUrl = `${frontendUrl}/apps/classes/${result.course.id}`;
    
    console.log(`✅ Invitation accepted! Redirecting to course: ${coursePageUrl}`);
    
    // Redirect to the course page
    return res.redirect(302, coursePageUrl);
    
  } catch (error) {
    console.error('Accept invitation error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'https://xytek-classroom-assistant.vercel.app';
    
    // Redirect to error page with message
    return res.redirect(302, `${frontendUrl}/error?message=${encodeURIComponent(error.message)}`);
  }
};

// Accept invitation via API (for programmatic access)
const acceptInvitationAPI = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Invitation token is required'
      });
    }

    const result = await invitationService.acceptInvitation({
      token,
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.name
    });

    res.json(result);
  } catch (error) {
    console.error('Accept invitation API error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('expired') ? 410 : 
                       error.message.includes('already been') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
};

// Get pending invitations for current user
const getMyInvitations = async (req, res) => {
  try {
    const result = await invitationService.getPendingInvitations(req.user.email);
    res.json(result);
  } catch (error) {
    console.error('Get my invitations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get invitations for a course (teachers only)
const getCourseInvitations = async (req, res) => {
  try {
    const { courseId } = req.params;
    const result = await invitationService.getCourseInvitations(courseId);
    res.json(result);
  } catch (error) {
    console.error('Get course invitations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Cancel invitation
const cancelInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const result = await invitationService.cancelInvitation(invitationId, req.user.id, req.user.role);
    res.json(result);
  } catch (error) {
    console.error('Cancel invitation error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('permission') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  inviteUser,
  inviteMultipleUsers,
  acceptInvitation,
  acceptInvitationAPI,
  getMyInvitations,
  getCourseInvitations,
  cancelInvitation
};

