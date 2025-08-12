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

module.exports = {
  readEmails,
  sendEmail
};
