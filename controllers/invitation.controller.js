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
    
    // Accept invitation - no authentication required
    // Service will auto-create user if needed
    const result = await invitationService.acceptInvitation({
      token,
      userId: req.user?.id, // Optional - will auto-create if not provided
      userEmail: req.user?.email,
      userName: req.user?.name
    });

    // Return a beautiful success HTML page with auto-redirect
    const frontendUrl = process.env.FRONTEND_URL || 'https://xytek-classroom-assistant.vercel.app';
    const coursePageUrl = `${frontendUrl}/apps/classes/${result.course.id}`;
    
    console.log(`✅ Invitation accepted! Course: ${result.course.name}`);
    
    // Send success HTML page
    return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation Accepted</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 48px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .checkmark {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: #4CAF50;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            animation: scaleIn 0.5s ease-out 0.2s both;
        }
        @keyframes scaleIn {
            from { transform: scale(0); }
            to { transform: scale(1); }
        }
        .checkmark svg {
            width: 48px;
            height: 48px;
            stroke: white;
            stroke-width: 3;
            stroke-linecap: round;
            stroke-linejoin: round;
            fill: none;
            animation: checkmark 0.5s ease-out 0.4s both;
        }
        @keyframes checkmark {
            from { stroke-dasharray: 100; stroke-dashoffset: 100; }
            to { stroke-dasharray: 100; stroke-dashoffset: 0; }
        }
        h1 {
            color: #333;
            font-size: 32px;
            margin-bottom: 16px;
            font-weight: 700;
        }
        .course-name {
            color: #667eea;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 16px;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        .info-box {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            font-size: 14px;
            color: #555;
        }
        .redirect-info {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #999;
            font-size: 14px;
        }
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #e0e0e0;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 16px;
            transition: transform 0.2s, background 0.2s;
        }
        .button:hover {
            background: #5568d3;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="checkmark">
            <svg viewBox="0 0 52 52">
                <polyline points="14 27 22 35 38 19"/>
            </svg>
        </div>
        <h1>🎉 ${result.alreadyEnrolled ? 'Already Enrolled!' : 'Success!'}</h1>
        <div class="course-name">${result.course.name}</div>
        <p>${result.alreadyEnrolled ? "You're already enrolled in this course!" : "You've been successfully enrolled in the course. Get ready to start learning!"}</p>
        ${result.userCreated ? '<div class="info-box">📝 An account has been created for you. Please log in to access the course.</div>' : ''}
        <div class="redirect-info">
            <div class="spinner"></div>
            <span>Redirecting to ${result.userCreated ? 'login' : 'your course'}...</span>
        </div>
        <a href="${result.userCreated ? frontendUrl + '/login' : coursePageUrl}" class="button">${result.userCreated ? 'Go to Login' : 'Go to Course Now'}</a>
    </div>
    <script>
        // Auto-redirect after 3 seconds
        setTimeout(() => {
            window.location.href = '${result.userCreated ? frontendUrl + '/login' : coursePageUrl}';
        }, 3000);
    </script>
</body>
</html>
    `);
    
  } catch (error) {
    console.error('Accept invitation error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'https://xytek-classroom-assistant.vercel.app';
    
    // Return error HTML page
    return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation Error</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 48px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 24px;
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 16px;
            font-weight: 700;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: transform 0.2s, background 0.2s;
        }
        .button:hover {
            background: #5568d3;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">❌</div>
        <h1>Oops! Something went wrong</h1>
        <p>${error.message || 'Unable to accept invitation. Please contact your teacher.'}</p>
        <a href="${frontendUrl}" class="button">Go to Home</a>
    </div>
</body>
</html>
    `);
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

