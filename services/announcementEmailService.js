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

// Send announcement email to students
async function sendAnnouncementEmail({ 
  toEmail, 
  studentName, 
  courseName, 
  teacherName, 
  announcementTitle, 
  announcementContent 
}) {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'XYTEK Classroom Assistant'}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `📢 New Announcement in ${courseName}`,
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
            .announcement-box {
              background: #f7fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #4299e1;
              margin: 20px 0;
            }
            .announcement-title {
              font-size: 20px;
              font-weight: 600;
              color: #2d3748;
              margin-bottom: 15px;
            }
            .announcement-content {
              color: #4a5568;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            .course-info {
              margin: 20px 0;
              padding: 15px;
              background: #fff5f5;
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
              <div class="icon">📢</div>
              <h1>XYTEK Classroom Assistant</h1>
            </div>
            
            <div class="content">
              <p>Hi ${studentName || 'there'}!</p>
              
              <p><strong>${teacherName}</strong> has posted a new announcement in <strong>${courseName}</strong>.</p>
              
              <div class="announcement-box">
                ${announcementTitle ? `<div class="announcement-title">${announcementTitle}</div>` : ''}
                <div class="announcement-content">${announcementContent}</div>
              </div>
              
              <div class="course-info">
                <p style="margin: 5px 0;"><strong>📚 Course:</strong> ${courseName}</p>
                <p style="margin: 5px 0;"><strong>👨‍🏫 Posted by:</strong> ${teacherName}</p>
              </div>
            </div>
            
            <div class="footer">
              <p>This announcement was sent by ${teacherName} through XYTEK Classroom Assistant.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Announcement in ${courseName}
        
        Posted by: ${teacherName}
        ${announcementTitle ? `\nTitle: ${announcementTitle}\n` : ''}
        
        ${announcementContent}
        
        ---
        This announcement was sent through XYTEK Classroom Assistant.
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log('✅ Announcement email sent:', {
      to: toEmail,
      courseName
    });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('❌ Error sending announcement email:', error);
    throw error;
  }
}

module.exports = {
  sendAnnouncementEmail
};

