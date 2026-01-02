const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send grade notification email to student (after teacher approves)
async function sendGradeNotificationEmail({ 
  toEmail, 
  studentName,
  courseName, 
  assignmentTitle, 
  grade,
  maxPoints,
  feedback,
  assignmentId
}) {
  try {
    const transporter = createTransporter();
    
    const percentage = Math.round((grade / maxPoints) * 100);
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'XYTEK Classroom Assistant'}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `📊 Your ${assignmentTitle} has been graded`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            .grade-box {
              background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
              color: white;
              padding: 30px;
              border-radius: 10px;
              margin: 25px 0;
              text-align: center;
            }
            .grade-large {
              font-size: 56px;
              font-weight: bold;
              margin: 10px 0;
            }
            .grade-percentage {
              font-size: 24px;
              opacity: 0.9;
            }
            .assignment-details {
              background: #f7fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #4299e1;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              padding: 8px 0;
              border-bottom: 1px solid #e2e8f0;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: 600;
              color: #2d3748;
              min-width: 120px;
            }
            .detail-value {
              color: #4a5568;
              flex: 1;
            }
            .feedback-box {
              background: #fffaf0;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #ed8936;
              margin: 20px 0;
            }
            .feedback-box h3 {
              margin-top: 0;
              color: #2d3748;
              font-size: 18px;
            }
            .feedback-content {
              color: #4a5568;
              white-space: pre-wrap;
              word-wrap: break-word;
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
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              font-size: 14px;
              color: #718096;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">📊</div>
              <h1>Assignment Graded!</h1>
            </div>
            
            <div class="content">
              <p>Hi ${studentName || 'there'}!</p>
              
              <p>Your teacher has reviewed and approved the grade for your assignment.</p>
              
              <div class="grade-box">
                <div>Your Grade</div>
                <div class="grade-large">${grade} / ${maxPoints}</div>
                <div class="grade-percentage">${percentage}%</div>
              </div>
              
              <div class="assignment-details">
                <div class="detail-row">
                  <span class="detail-label">📚 Course:</span>
                  <span class="detail-value">${courseName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">📝 Assignment:</span>
                  <span class="detail-value">${assignmentTitle}</span>
                </div>
              </div>
              
              ${feedback ? `
              <div class="feedback-box">
                <h3>💬 Feedback from your teacher:</h3>
                <div class="feedback-content">${feedback}</div>
              </div>
              ` : ''}
              
              <p style="text-align: center;">
                <a href="https://class.xytek.ai/assignments/${assignmentId}" class="button">
                  📋 View Graded Assignment
                </a>
              </p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #718096;">
                Keep up the great work! 🎓
              </p>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from XYTEK Classroom Assistant.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Assignment Graded!
        
        Hi ${studentName || 'there'}!
        
        Your teacher has reviewed and approved the grade for your assignment.
        
        YOUR GRADE: ${grade} / ${maxPoints} (${percentage}%)
        
        Course: ${courseName}
        Assignment: ${assignmentTitle}
        
        ${feedback ? `Feedback:\n${feedback}\n\n` : ''}
        
        View your graded assignment: https://class.xytek.ai/assignments/${assignmentId}
        
        Keep up the great work! 🎓
        
        ---
        This is an automated notification from XYTEK Classroom Assistant.
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log('✅ Grade notification email sent:', {
      to: toEmail,
      assignment: assignmentTitle,
      grade: `${grade}/${maxPoints}`
    });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('❌ Error sending grade notification email:', error);
    throw error;
  }
}

module.exports = {
  sendGradeNotificationEmail
};

