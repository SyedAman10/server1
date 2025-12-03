const crypto = require('crypto');
const invitationModel = require('../models/invitation.model');
const courseModel = require('../models/course.model');
const userModel = require('../models/user.model');
const { sendInvitationEmail, sendWelcomeEmail } = require('./invitationEmailService');

// Generate unique invitation token
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Create and send invitation
async function inviteUser({ courseId, inviterUserId, inviteeEmail, inviteeRole, inviterName, courseName }) {
  try {
    // Validate role
    if (!['student', 'teacher'].includes(inviteeRole)) {
      throw new Error('Invalid role. Must be "student" or "teacher"');
    }

    // Check if course exists
    const course = await courseModel.getCourseById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Check if user exists in XYTEK system
    const existingUser = await userModel.getUserByEmail(inviteeEmail);
    const userExistsInSystem = !!existingUser;

    // Check if user is already enrolled
    if (existingUser && inviteeRole === 'student') {
      const isEnrolled = await courseModel.isStudentEnrolled(courseId, existingUser.id);
      if (isEnrolled) {
        return {
          success: false,
          alreadyEnrolled: true,
          message: `${inviteeEmail} is already enrolled in this course`
        };
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await invitationModel.getExistingInvitation(courseId, inviteeEmail);
    if (existingInvitation) {
      // Cancel the old invitation by setting it to 'expired'
      console.log(`🔄 Cancelling old invitation and creating new one for ${inviteeEmail}`);
      await invitationModel.updateInvitationStatus(existingInvitation.id, 'expired');
    }

    // Generate token and expiration (7 days)
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation in database
    const invitation = await invitationModel.createInvitation({
      courseId,
      inviterUserId,
      inviteeEmail,
      inviteeRole,
      token,
      expiresAt
    });

    // Generate invitation link
    const backendUrl = process.env.BACKEND_URL || 'https://class.xytek.ai';
    const invitationLink = `${backendUrl}/api/invitations/accept/${token}`;

    // Send different emails based on whether user has an account
    if (userExistsInSystem) {
      // Send standard invitation email
      await sendInvitationEmail({
        toEmail: inviteeEmail,
        inviterName: inviterName || 'A teacher',
        courseName: courseName || course.name,
        role: inviteeRole,
        invitationLink,
        expiresInDays: 7
      });
      console.log(`✅ Sent invitation to existing user: ${inviteeEmail}`);
    } else {
      // Send "create account first" email
      const { sendCreateAccountFirstEmail } = require('./invitationEmailService');
      await sendCreateAccountFirstEmail({
        toEmail: inviteeEmail,
        inviterName: inviterName || 'A teacher',
        courseName: courseName || course.name,
        role: inviteeRole,
        invitationLink,
        expiresInDays: 7
      });
      console.log(`✅ Sent "create account first" email to: ${inviteeEmail}`);
    }

    return {
      success: true,
      invitation,
      userExistsInSystem,
      isResend: !!existingInvitation,
      message: existingInvitation 
        ? `Previous invitation cancelled. New invitation sent to ${inviteeEmail}`
        : (userExistsInSystem 
            ? `Invitation sent to ${inviteeEmail}`
            : `Account creation required email sent to ${inviteeEmail}`)
    };
  } catch (error) {
    console.error('Error inviting user:', error);
    throw error;
  }
}

// Invite multiple users
async function inviteMultipleUsers({ courseId, inviterUserId, inviteeEmails, inviteeRole, inviterName, courseName }) {
  const results = {
    successful: [],
    failed: []
  };

  for (const email of inviteeEmails) {
    try {
      const result = await inviteUser({
        courseId,
        inviterUserId,
        inviteeEmail: email,
        inviteeRole,
        inviterName,
        courseName
      });
      results.successful.push({ email, ...result });
    } catch (error) {
      results.failed.push({ email, error: error.message });
    }
  }

  return {
    success: true,
    ...results,
    message: `Sent ${results.successful.length} invitation(s), ${results.failed.length} failed`
  };
}

// Accept invitation (auto-create user if needed)
async function acceptInvitation({ token, userId, userEmail, userName }) {
  try {
    // Get invitation
    const invitation = await invitationModel.getInvitationByToken(token);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation has already been ${invitation.status}`);
    }

    // Check if expired
    if (new Date() > new Date(invitation.expires_at)) {
      await invitationModel.updateInvitationStatus(invitation.id, 'expired');
      throw new Error('Invitation has expired');
    }

    // If no userId provided, find or create user based on invitation email
    let finalUserId = userId;
    let finalUserName = userName;
    
    if (!finalUserId) {
      // Check if user exists with this email and role
      let user = await userModel.getUserByEmailAndRole(invitation.invitee_email, invitation.invitee_role);
      
      if (!user) {
        // Create new user
        console.log(`📝 Creating new ${invitation.invitee_role} user: ${invitation.invitee_email}`);
        const tempPassword = crypto.randomBytes(16).toString('hex');
        user = await userModel.createUser({
          email: invitation.invitee_email,
          password: tempPassword, // They'll need to reset this
          name: invitation.invitee_email.split('@')[0],
          role: invitation.invitee_role
        });
        console.log(`✅ Created user with ID: ${user.id}`);
      }
      
      finalUserId = user.id;
      finalUserName = user.name;
    }

    // Check if email matches (if userEmail was provided)
    if (userEmail && invitation.invitee_email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new Error('This invitation was sent to a different email address');
    }

    // Check if already enrolled
    const isEnrolled = await courseModel.isStudentEnrolled(invitation.course_id, finalUserId);
    if (isEnrolled) {
      // Still mark invitation as accepted
      await invitationModel.updateInvitationStatus(invitation.id, 'accepted', finalUserId);
      return {
        success: true,
        alreadyEnrolled: true,
        course: {
          id: invitation.course_id,
          name: invitation.course_name
        },
        role: invitation.invitee_role,
        message: `You're already enrolled in ${invitation.course_name}`
      };
    }

    // Enroll user in course
    if (invitation.invitee_role === 'student') {
      await courseModel.enrollStudent(invitation.course_id, finalUserId);
    } else if (invitation.invitee_role === 'teacher') {
      // For teacher invitations, you might want different logic
      // For now, we'll also enroll them as students but you can customize this
      await courseModel.enrollStudent(invitation.course_id, finalUserId);
    }

    // Update invitation status
    await invitationModel.updateInvitationStatus(invitation.id, 'accepted', finalUserId);

    // Send welcome email
    await sendWelcomeEmail({
      toEmail: invitation.invitee_email,
      userName: finalUserName || 'there',
      courseName: invitation.course_name,
      role: invitation.invitee_role
    });

    return {
      success: true,
      course: {
        id: invitation.course_id,
        name: invitation.course_name
      },
      role: invitation.invitee_role,
      userCreated: !userId, // Indicate if we created a new user
      message: `Successfully joined ${invitation.course_name}`
    };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    throw error;
  }
}

// Get pending invitations for a user
async function getPendingInvitations(email) {
  try {
    const invitations = await invitationModel.getInvitationsByEmail(email);
    
    // Filter only pending and not expired
    const now = new Date();
    const pendingInvitations = invitations.filter(inv => 
      inv.status === 'pending' && new Date(inv.expires_at) > now
    );

    return {
      success: true,
      invitations: pendingInvitations,
      count: pendingInvitations.length
    };
  } catch (error) {
    console.error('Error getting pending invitations:', error);
    throw error;
  }
}

// Get invitations for a course (for teachers)
async function getCourseInvitations(courseId) {
  try {
    const invitations = await invitationModel.getInvitationsByCourse(courseId);
    
    return {
      success: true,
      invitations,
      count: invitations.length
    };
  } catch (error) {
    console.error('Error getting course invitations:', error);
    throw error;
  }
}

// Cancel/delete invitation
async function cancelInvitation(invitationId, userId, userRole) {
  try {
    const invitation = await invitationModel.getInvitationByToken(invitationId);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Check permissions
    if (userRole !== 'super_admin' && invitation.inviter_user_id !== userId) {
      throw new Error('You do not have permission to cancel this invitation');
    }

    await invitationModel.deleteInvitation(invitation.id);

    return {
      success: true,
      message: 'Invitation cancelled successfully'
    };
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    throw error;
  }
}

module.exports = {
  inviteUser,
  inviteMultipleUsers,
  acceptInvitation,
  getPendingInvitations,
  getCourseInvitations,
  cancelInvitation
};

