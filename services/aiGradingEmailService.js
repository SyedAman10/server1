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

// Send AI grading approval request email to teacher
async function sendGradingApprovalEmail({ 
  toEmail, 
  teacherName,
  studentName, 
  studentEmail,
  courseName, 
  assignmentTitle,
  proposedGrade,
  maxPoints,
  proposedFeedback,
  approvalToken,
  submittedAt
}) {
  try {
    const transporter = createTransporter();
    
    const baseUrl = process.env.FRONTEND_URL || 'https://class.xytek.ai';
    const approveUrl = `${baseUrl}/api/ai-grading/approve/${approvalToken}`;
    const rejectUrl = `${baseUrl}/api/ai-grading/reject/${approvalToken}`;
    const viewUrl = `${baseUrl}/grading/${approvalToken}`;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'XYTEK Classroom Assistant'}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `🤖 AI Grade Ready for Review: ${assignmentTitle}`,
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
            .ai-grade-box {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 25px;
              border-radius: 10px;
              margin: 25px 0;
              text-align: center;
            }
            .grade-large {
              font-size: 48px;
              font-weight: bold;
              margin: 10px 0;
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
              font-size: 16px;
            }
            .feedback-content {
              color: #4a5568;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            .action-buttons {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              margin: 10px;
              box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            }
            .button-approve {
              background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
              color: #ffffff !important;
            }
            .button-reject {
              background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
              color: #ffffff !important;
            }
            .button-view {
              background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
              color: #ffffff !important;
            }
            .warning-box {
              background: #fff5f5;
              border-left: 4px solid #f56565;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .warning-box p {
              margin: 5px 0;
              color: #c53030;
              font-size: 14px;
            }
            .info-box {
              background: #ebf8ff;
              border-left: 4px solid #4299e1;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .info-box p {
              margin: 5px 0;
              color: #2c5282;
              font-size: 14px;
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
              <div class="icon">🤖</div>
              <h1>AI Grade Ready for Review</h1>
            </div>
            
            <div class="content">
              <p>Hi ${teacherName || 'there'}!</p>
              
              <p>The AI has graded a student submission and is <strong>awaiting your approval</strong>.</p>
              
              <div class="ai-grade-box">
                <div>AI-Proposed Grade</div>
                <div class="grade-large">${proposedGrade} / ${maxPoints}</div>
                <div>${Math.round((proposedGrade / maxPoints) * 100)}%</div>
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
                <div class="detail-row">
                  <span class="detail-label">👤 Student:</span>
                  <span class="detail-value">${studentName} (${studentEmail})</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">⏰ Submitted:</span>
                  <span class="detail-value">${submittedAt ? new Date(submittedAt).toLocaleString() : 'Recently'}</span>
                </div>
              </div>
              
              ${proposedFeedback ? `
              <div class="feedback-box">
                <h3>💬 AI-Generated Feedback:</h3>
                <div class="feedback-content">${proposedFeedback}</div>
              </div>
              ` : ''}
              
              <div class="warning-box">
                <p><strong>⚠️ Action Required:</strong> This grade will NOT be visible to the student until you approve it.</p>
                <p>Please review the AI's assessment and choose an action below.</p>
              </div>
              
              <div class="action-buttons">
                <a href="${approveUrl}" class="button button-approve">
                  ✅ Approve & Apply Grade
                </a>
                <br>
                <a href="${rejectUrl}" class="button button-reject">
                  ❌ Reject & Grade Manually
                </a>
                <br>
                <a href="${viewUrl}" class="button button-view">
                  📋 View Full Submission
                </a>
              </div>
              
              <div class="info-box">
                <p><strong>💡 Tips:</strong></p>
                <p>• Click "Approve" to apply this grade to the student's submission</p>
                <p>• Click "Reject" if you want to grade manually or modify the feedback</p>
                <p>• Click "View" to see the full submission before deciding</p>
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #718096;">
                This grade was automatically generated by AI based on your grading criteria. 
                Please review it carefully before approving.
              </p>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from XYTEK Classroom Assistant.</p>
              <p>You can manage your AI grading preferences in your dashboard.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        AI Grade Ready for Review
        
        Hi ${teacherName || 'there'}!
        
        The AI has graded a student submission and is awaiting your approval.
        
        AI-PROPOSED GRADE: ${proposedGrade} / ${maxPoints} (${Math.round((proposedGrade / maxPoints) * 100)}%)
        
        Assignment Details:
        - Course: ${courseName}
        - Assignment: ${assignmentTitle}
        - Student: ${studentName} (${studentEmail})
        - Submitted: ${submittedAt ? new Date(submittedAt).toLocaleString() : 'Recently'}
        
        ${proposedFeedback ? `AI-Generated Feedback:\n${proposedFeedback}\n\n` : ''}
        
        ACTION REQUIRED:
        This grade will NOT be visible to the student until you approve it.
        
        Please choose an action:
        
        ✅ Approve & Apply Grade: ${approveUrl}
        ❌ Reject & Grade Manually: ${rejectUrl}
        📋 View Full Submission: ${viewUrl}
        
        ---
        This grade was automatically generated by AI. Please review carefully before approving.
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log('✅ AI grading approval email sent:', {
      to: toEmail,
      assignment: assignmentTitle,
      student: studentName,
      proposedGrade: `${proposedGrade}/${maxPoints}`
    });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('❌ Error sending AI grading approval email:', error);
    throw error;
  }
}

module.exports = {
  sendGradingApprovalEmail
};

