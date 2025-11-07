const { google } = require('googleapis');

/**
 * Get Gmail client with OAuth2 authentication
 */
async function getGmailClient(tokens) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  auth.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });
  
  return google.gmail({ version: 'v1', auth });
}

/**
 * Read emails from a specific sender
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} senderEmail - Email address of the sender
 * @param {number} limit - Maximum number of emails to retrieve (default: 10)
 * @param {string} subject - Subject line to filter by (optional)
 * @returns {Promise<Array>} Array of email objects
 */
async function readEmails(tokens, senderEmail, limit = 10, subject = null) {
  try {
    const gmail = await getGmailClient(tokens);
    
    // Build query to filter emails
    let query = `from:${senderEmail}`;
    if (subject) {
      query += ` subject:"${subject}"`;
    }
    
    // Get list of email IDs
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: limit
    });
    
    if (!response.data.messages || response.data.messages.length === 0) {
      return [];
    }
    
    // Get detailed information for each email
    const emailPromises = response.data.messages.map(async (message) => {
      const emailDetails = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date', 'To']
      });
      
      const headers = emailDetails.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';
      
      // Get snippet for preview
      const snippet = emailDetails.data.snippet || '';
      
      // Check if email has attachments
      const hasAttachments = emailDetails.data.payload.parts && 
                            emailDetails.data.payload.parts.some(part => part.filename);
      
      return {
        id: message.id,
        subject,
        from,
        to,
        date,
        snippet,
        hasAttachments
      };
    });
    
    const emails = await Promise.all(emailPromises);
    return emails;
    
  } catch (error) {
    console.error('Error reading emails:', error);
    throw new Error(`Failed to read emails: ${error.message}`);
  }
}

/**
 * Send an email
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} recipientEmail - Email address of the recipient
 * @param {string} subject - Subject line of the email
 * @param {string} message - Body content of the email
 * @param {Array} attachments - Array of file paths to attach (optional)
 * @returns {Promise<Object>} Result of the email send operation
 */
async function sendEmail(tokens, recipientEmail, subject, message, attachments = []) {
  try {
    const gmail = await getGmailClient(tokens);
    
    // Create email content
    const emailContent = [
      `To: ${recipientEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      message
    ].join('\r\n');
    
    // Encode the email content
    const encodedEmail = Buffer.from(emailContent).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Send the email
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    return {
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId,
      labelIds: result.data.labelIds
    };
    
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send a custom branded Xytek classroom invitation email
 * @param {Object} tokens - OAuth2 tokens (or use external email service like SendGrid)
 * @param {string} studentEmail - Email address of the student
 * @param {Object} courseInfo - Course information { name, section, description, link }
 * @param {Object} teacherInfo - Teacher information { name, email }
 * @returns {Promise<Object>} Result of the email send operation
 */
async function sendXytekClassroomInvite(tokens, studentEmail, courseInfo, teacherInfo) {
  try {
    const subject = `🎓 You're Invited to Join ${courseInfo.name} on Xytek`;
    
    const message = `
Hello!

${teacherInfo.name} has invited you to join their class on Xytek:

📚 Course: ${courseInfo.name}
${courseInfo.section ? `📖 Section: ${courseInfo.section}` : ''}
👨‍🏫 Teacher: ${teacherInfo.name}

${courseInfo.description ? `\nAbout this course:\n${courseInfo.description}\n` : ''}

To get started:
1. Click the link below to access your classroom
2. Complete your profile setup
3. Start learning!

🔗 Access Your Classroom: ${courseInfo.link || 'https://classroom.google.com'}

Need help? Reply to this email or contact ${teacherInfo.email}

Best regards,
The Xytek Team

---
This invitation was sent through Xytek Learning Platform.
If you believe this was sent in error, please contact ${teacherInfo.email}.
    `.trim();

    return await sendEmail(tokens, studentEmail, subject, message);
  } catch (error) {
    console.error('Error sending Xytek classroom invite:', error);
    throw new Error(`Failed to send Xytek invite: ${error.message}`);
  }
}

/**
 * Send HTML formatted Xytek classroom invitation
 * For better design, consider using SendGrid, AWS SES, or similar service
 */
async function sendXytekClassroomInviteHTML(tokens, studentEmail, courseInfo, teacherInfo) {
  try {
    const gmail = await getGmailClient(tokens);
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .course-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Welcome to Xytek!</h1>
    </div>
    <div class="content">
      <p>Hello!</p>
      <p><strong>${teacherInfo.name}</strong> has invited you to join their class:</p>
      
      <div class="course-info">
        <h2 style="margin-top: 0; color: #667eea;">📚 ${courseInfo.name}</h2>
        ${courseInfo.section ? `<p><strong>Section:</strong> ${courseInfo.section}</p>` : ''}
        ${courseInfo.description ? `<p>${courseInfo.description}</p>` : ''}
        <p><strong>👨‍🏫 Teacher:</strong> ${teacherInfo.name}</p>
      </div>

      <p><strong>To get started:</strong></p>
      <ol>
        <li>Click the button below to access your classroom</li>
        <li>Complete your profile setup</li>
        <li>Start learning!</li>
      </ol>

      <center>
        <a href="${courseInfo.link || 'https://classroom.google.com'}" class="cta-button">
          Access Your Classroom →
        </a>
      </center>

      <p>Need help? Reply to this email or contact <a href="mailto:${teacherInfo.email}">${teacherInfo.email}</a></p>

      <div class="footer">
        <p>Best regards,<br><strong>The Xytek Team</strong></p>
        <p>This invitation was sent through Xytek Learning Platform.<br>
        If you believe this was sent in error, please contact ${teacherInfo.email}.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    const emailContent = [
      `To: ${studentEmail}`,
      `Subject: 🎓 You're Invited to Join ${courseInfo.name} on Xytek`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      htmlBody
    ].join('\r\n');
    
    const encodedEmail = Buffer.from(emailContent).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    return {
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId
    };
  } catch (error) {
    console.error('Error sending HTML Xytek invite:', error);
    throw new Error(`Failed to send HTML Xytek invite: ${error.message}`);
  }
}

module.exports = {
  readEmails,
  sendEmail,
  sendXytekClassroomInvite,
  sendXytekClassroomInviteHTML
};
