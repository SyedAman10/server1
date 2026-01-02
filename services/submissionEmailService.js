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

// Send submission notification email to teacher
async function sendSubmissionEmail({ 
  toEmail, 
  teacherName,
  studentName, 
  studentEmail,
  courseName, 
  assignmentTitle, 
  assignmentId,
  submissionText,
  attachments = []
}) {
  try {
    const transporter = createTransporter();
    
    // Format submission text preview
    const textPreview = submissionText ? 
      (submissionText.length > 100 ? `${submissionText.substring(0, 100)}...` : submissionText) 
      : null;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'XYTEK Classroom Assistant'}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `📝 New Submission: ${assignmentTitle} - ${courseName}`,
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
            .submission-box {
              background: #f7fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #48bb78;
              margin: 20px 0;
            }
            .submission-title {
              font-size: 20px;
              font-weight: 600;
              color: #2d3748;
              margin-bottom: 15px;
            }
            .submission-details {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .detail-row {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .detail-label {
              font-weight: 600;
              color: #2d3748;
            }
            .detail-value {
              color: #4a5568;
            }
            .submission-text-preview {
              background: #ffffff;
              padding: 15px;
              border-radius: 5px;
              border: 1px solid #e2e8f0;
              margin-top: 15px;
              font-style: italic;
              color: #4a5568;
            }
            .attachments-list {
              background: #fff5f5;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #ed8936;
            }
            .attachments-list h3 {
              margin-top: 0;
              color: #2d3748;
              font-size: 16px;
            }
            .attachments-list ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .attachments-list li {
              color: #4a5568;
              margin: 5px 0;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
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
            .course-info {
              margin: 20px 0;
              padding: 15px;
              background: #edf2f7;
              border-radius: 8px;
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
              <div class="icon">📝</div>
              <h1>XYTEK Classroom Assistant</h1>
            </div>
            
            <div class="content">
              <p>Hi ${teacherName || 'there'}!</p>
              
              <p><strong>${studentName}</strong> has submitted an assignment in <strong>${courseName}</strong>.</p>
              
              <div class="submission-box">
                <div class="submission-title">${assignmentTitle}</div>
                
                <div class="submission-details">
                  <div class="detail-row">
                    <span class="detail-label">👤 Student:</span>
                    <span class="detail-value">${studentName} (${studentEmail})</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">📚 Course:</span>
                    <span class="detail-value">${courseName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">⏰ Submitted:</span>
                    <span class="detail-value">${new Date().toLocaleString()}</span>
                  </div>
                  ${attachments.length > 0 ? `
                  <div class="detail-row">
                    <span class="detail-label">📎 Attachments:</span>
                    <span class="detail-value">${attachments.length} file(s)</span>
                  </div>
                  ` : ''}
                </div>
                
                ${textPreview ? `
                <div class="submission-text-preview">
                  "${textPreview}"
                </div>
                ` : ''}
              </div>
              
              ${attachments.length > 0 ? `
              <div class="attachments-list">
                <h3>📎 Attached Files:</h3>
                <ul>
                  ${attachments.map(att => `<li>${att.originalName} (${(att.size / 1024).toFixed(2)} KB)</li>`).join('')}
                </ul>
              </div>
              ` : ''}
              
              <p style="text-align: center;">
                <a href="https://class.xytek.ai/assignments/${assignmentId}" class="button" style="color: #ffffff !important;">
                  📋 View Submission
                </a>
              </p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #718096;">
                You can review, grade, and provide feedback through your dashboard.
              </p>
            </div>
            
            <div class="footer">
              <p>This submission was made through XYTEK Classroom Assistant.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Assignment Submission
        
        Student: ${studentName} (${studentEmail})
        Course: ${courseName}
        Assignment: ${assignmentTitle}
        Submitted: ${new Date().toLocaleString()}
        ${attachments.length > 0 ? `Attachments: ${attachments.length} file(s)\n` : ''}
        ${textPreview ? `\nSubmission Text:\n"${textPreview}"\n` : ''}
        ${attachments.length > 0 ? `\nAttached Files:\n${attachments.map(att => `- ${att.originalName} (${(att.size / 1024).toFixed(2)} KB)`).join('\n')}\n` : ''}
        
        View submission: https://class.xytek.ai/assignments/${assignmentId}
        
        ---
        This submission was made through XYTEK Classroom Assistant.
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log('✅ Submission email sent:', {
      to: toEmail,
      assignment: assignmentTitle,
      student: studentName
    });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('❌ Error sending submission email:', error);
    throw error;
  }
}

module.exports = {
  sendSubmissionEmail
};

