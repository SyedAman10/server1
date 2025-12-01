const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Email templates
const getInvitationEmailTemplate = ({ inviterName, courseName, role, invitationLink, expiresInDays }) => {
  const roleText = role === 'teacher' ? 'a teacher' : 'a student';
  
  return {
    subject: `You're invited to join ${courseName}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Course Invitation</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #4299e1;
            margin: 0;
            font-size: 28px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          .content {
            margin: 30px 0;
          }
          .course-info {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #4299e1;
            margin: 20px 0;
          }
          .course-info p {
            margin: 8px 0;
            font-size: 16px;
          }
          .course-info strong {
            color: #2d3748;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(66, 153, 225, 0.3);
          }
          .button:hover {
            background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #718096;
            text-align: center;
          }
          .warning {
            background: #fff5f5;
            border-left: 4px solid #f56565;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .warning p {
            margin: 0;
            color: #c53030;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="icon">🎓</div>
            <h1>XYTEK Classroom Assistant</h1>
          </div>
          
          <div class="content">
            <p>Hi there!</p>
            
            <p><strong>${inviterName}</strong> has invited you to join their course as ${roleText}.</p>
            
            <div class="course-info">
              <p><strong>📚 Course:</strong> ${courseName}</p>
              <p><strong>👤 Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
              <p><strong>👨‍🏫 Invited by:</strong> ${inviterName}</p>
            </div>
            
            <p style="text-align: center;">
              <a href="${invitationLink}" class="button" style="color: #ffffff !important;">
                ✅ Accept Invitation
              </a>
            </p>
            
            <div class="warning">
              <p>⏰ This invitation will expire in ${expiresInDays} days. Please accept it soon!</p>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #718096;">
              If you don't have an account yet, you'll be prompted to create one when you click the button above.
            </p>
          </div>
          
          <div class="footer">
            <p>This invitation was sent by ${inviterName} through our platform.</p>
            <p>If you believe this was sent in error, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      You're invited to join ${courseName}!
      
      ${inviterName} has invited you to join their course as ${roleText}.
      
      Course: ${courseName}
      Role: ${role}
      Invited by: ${inviterName}
      
      Accept the invitation here: ${invitationLink}
      
      This invitation will expire in ${expiresInDays} days.
      
      If you don't have an account yet, you'll be prompted to create one.
    `
  };
};

// Send invitation email
async function sendInvitationEmail({ 
  toEmail, 
  inviterName, 
  courseName, 
  role, 
  invitationLink, 
  expiresInDays = 7 
}) {
  try {
    const transporter = createTransporter();
    const emailTemplate = getInvitationEmailTemplate({
      inviterName,
      courseName,
      role,
      invitationLink,
      expiresInDays
    });
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'XYTEK Classroom Assistant'}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Invitation email sent:', {
      to: toEmail,
      messageId: info.messageId,
      courseName
    });
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error sending invitation email:', error);
    throw error;
  }
}

// Get welcome email template
const getWelcomeEmailTemplate = ({ userName, courseName, role }) => {
  return {
    subject: `Welcome to ${courseName}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${courseName}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #4299e1;
            margin: 0;
            font-size: 28px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="icon">🎉</div>
            <h1>XYTEK Classroom Assistant</h1>
          </div>
          <div class="content">
            <p>Hi ${userName}!</p>
            <p>Welcome to <strong>${courseName}</strong>! You've successfully joined as a ${role}.</p>
            <p>You can now access all course materials, assignments, and collaborate with your classmates.</p>
            <p>Happy learning!</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to ${courseName}! You've successfully joined as a ${role}.`
  };
};

// Send welcome email after accepting invitation
async function sendWelcomeEmail({ toEmail, userName, courseName, role }) {
  try {
    const transporter = createTransporter();
    const roleText = role === 'teacher' ? 'a teacher' : 'a student';
    
    const emailTemplate = getWelcomeEmailTemplate({ userName, courseName, role });
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'XYTEK Classroom Assistant'}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };
    
    await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent:', { to: toEmail });
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    // Don't throw error - welcome email is not critical
    return { success: false, error: error.message };
  }
}

// Get "create account first" email template
const getCreateAccountFirstEmailTemplate = ({ inviterName, courseName, role, invitationLink, expiresInDays }) => {
  const roleText = role === 'teacher' ? 'a teacher' : 'a student';
  const frontendUrl = process.env.FRONTEND_URL || 'https://xytek-classroom-assistant.vercel.app';
  const signupUrl = `${frontendUrl}/signup?email=${encodeURIComponent('')}&returnTo=${encodeURIComponent(invitationLink)}`;
  
  return {
    subject: `Action Required: Create Account to Join ${courseName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Create Account to Join Course</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #4299e1;
            margin: 0;
            font-size: 28px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          .content {
            margin: 30px 0;
          }
          .course-info {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #4299e1;
            margin: 20px 0;
          }
          .course-info p {
            margin: 8px 0;
            font-size: 16px;
          }
          .course-info strong {
            color: #2d3748;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
          }
          .button:hover {
            background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #718096;
            text-align: center;
          }
          .warning {
            background: #fffaf0;
            border-left: 4px solid #ed8936;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .warning p {
            margin: 0;
            color: #c05621;
            font-size: 14px;
          }
          .steps {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .step {
            display: flex;
            align-items: start;
            margin: 15px 0;
          }
          .step-number {
            background: #4299e1;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
            flex-shrink: 0;
          }
          .step-content {
            flex: 1;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="icon">🎓</div>
            <h1>XYTEK Classroom Assistant</h1>
          </div>
          
          <div class="content">
            <p>Hi there!</p>
            
            <p><strong>${inviterName}</strong> has invited you to join their course as ${roleText}.</p>
            
            <div class="course-info">
              <p><strong>📚 Course:</strong> ${courseName}</p>
              <p><strong>👤 Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
              <p><strong>👨‍🏫 Invited by:</strong> ${inviterName}</p>
            </div>
            
            <div class="warning">
              <p><strong>⚠️ Account Required:</strong> We don't have an account registered with this email address yet. You'll need to create a free account before you can join this course.</p>
            </div>
            
            <div class="steps">
              <h3 style="margin-top: 0; color: #2d3748;">How to Join:</h3>
              
              <div class="step">
                <div class="step-number">1</div>
                <div class="step-content">
                  <strong>Create Your Account</strong>
                  <p>Click the button below to create your free XYTEK account</p>
                </div>
              </div>
              
              <div class="step">
                <div class="step-number">2</div>
                <div class="step-content">
                  <strong>Verify Your Email</strong>
                  <p>Use this email address: <strong>${''}</strong></p>
                </div>
              </div>
              
              <div class="step">
                <div class="step-number">3</div>
                <div class="step-content">
                  <strong>Accept Invitation</strong>
                  <p>After creating your account, click the link in this email again to join the course</p>
                </div>
              </div>
            </div>
            
            <p style="text-align: center;">
              <a href="${signupUrl}" class="button" style="color: #ffffff !important;">
                ✨ Create Free Account
              </a>
            </p>
            
            <div class="warning">
              <p>⏰ This invitation will expire in ${expiresInDays} days. Please create your account and accept it soon!</p>
            </div>
            
            <p style="margin-top: 30px; padding: 15px; background: #edf2f7; border-radius: 8px; font-size: 14px;">
              <strong>💡 Already have an account?</strong><br>
              Just click this link to accept the invitation: <a href="${invitationLink}">Accept Invitation</a>
            </p>
          </div>
          
          <div class="footer">
            <p>This invitation was sent by ${inviterName} through XYTEK Classroom Assistant.</p>
            <p>If you believe this was sent in error, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      You're invited to join ${courseName}!
      
      ${inviterName} has invited you to join their course as ${roleText}.
      
      Course: ${courseName}
      Role: ${role}
      Invited by: ${inviterName}
      
      ACCOUNT REQUIRED:
      We don't have an account registered with this email address yet.
      
      To join this course:
      1. Create a free XYTEK account at: ${signupUrl}
      2. After creating your account, click this link to accept the invitation: ${invitationLink}
      
      This invitation will expire in ${expiresInDays} days.
      
      Already have an account? Just click the invitation link above!
    `
  };
};

// Send "create account first" email
async function sendCreateAccountFirstEmail({ 
  toEmail, 
  inviterName, 
  courseName, 
  role, 
  invitationLink, 
  expiresInDays = 7 
}) {
  try {
    const transporter = createTransporter();
    const emailTemplate = getCreateAccountFirstEmailTemplate({
      inviterName,
      courseName,
      role,
      invitationLink,
      expiresInDays
    });
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'XYTEK Classroom Assistant'}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ "Create account first" email sent:', {
      to: toEmail,
      messageId: info.messageId,
      courseName
    });
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error sending "create account first" email:', error);
    throw error;
  }
}

module.exports = {
  sendInvitationEmail,
  sendWelcomeEmail,
  sendCreateAccountFirstEmail
};

