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

// Send assignment notification email to students
async function sendAssignmentEmail({ 
  toEmail, 
  studentName, 
  courseName, 
  teacherName, 
  assignmentTitle, 
  assignmentDescription,
  dueDate,
  maxPoints
}) {
  try {
    const transporter = createTransporter();
    
    // Format due date
    const dueDateFormatted = dueDate ? new Date(dueDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'No due date';
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'XYTEK Classroom Assistant'}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `📝 New Assignment: ${assignmentTitle} - ${courseName}`,
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
            .assignment-box {
              background: #f7fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #4299e1;
              margin: 20px 0;
            }
            .assignment-title {
              font-size: 20px;
              font-weight: 600;
              color: #2d3748;
              margin-bottom: 15px;
            }
            .assignment-description {
              color: #4a5568;
              white-space: pre-wrap;
              word-wrap: break-word;
              margin-bottom: 15px;
            }
            .assignment-details {
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
            .due-date-box {
              background: ${dueDate ? '#fff5f5' : '#f0fff4'};
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid ${dueDate ? '#f56565' : '#48bb78'};
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
              <p>Hi ${studentName || 'there'}!</p>
              
              <p><strong>${teacherName}</strong> has posted a new assignment in <strong>${courseName}</strong>.</p>
              
              <div class="assignment-box">
                <div class="assignment-title">${assignmentTitle}</div>
                ${assignmentDescription ? `<div class="assignment-description">${assignmentDescription}</div>` : ''}
                
                <div class="assignment-details">
                  <div class="detail-row">
                    <span class="detail-label">📊 Points:</span>
                    <span class="detail-value">${maxPoints || 100}</span>
                  </div>
                </div>
              </div>
              
              <div class="due-date-box">
                <div class="detail-row">
                  <span class="detail-label">⏰ Due Date:</span>
                  <span class="detail-value">${dueDateFormatted}</span>
                </div>
              </div>
              
              <div class="course-info">
                <p style="margin: 5px 0;"><strong>📚 Course:</strong> ${courseName}</p>
                <p style="margin: 5px 0;"><strong>👨‍🏫 Teacher:</strong> ${teacherName}</p>
              </div>
              
              <p>Good luck with your assignment! 📚✨</p>
            </div>
            
            <div class="footer">
              <p>This assignment was posted by ${teacherName} through XYTEK Classroom Assistant.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Assignment in ${courseName}
        
        Posted by: ${teacherName}
        
        Assignment: ${assignmentTitle}
        ${assignmentDescription ? `\nDescription: ${assignmentDescription}\n` : ''}
        
        Points: ${maxPoints || 100}
        Due Date: ${dueDateFormatted}
        
        ---
        This assignment was posted through XYTEK Classroom Assistant.
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log('✅ Assignment email sent:', {
      to: toEmail,
      assignment: assignmentTitle
    });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('❌ Error sending assignment email:', error);
    throw error;
  }
}

module.exports = {
  sendAssignmentEmail
};

