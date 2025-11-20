const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { oauth2Client } = require('../../integrations/google.oauth');

/**
 * Gmail Integration Service
 * Handles Gmail OAuth, reading, and sending emails for automation agents
 * Uses the shared OAuth client from google.oauth.js
 */

// Create OAuth2 client with tokens
function createOAuth2Client(tokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  if (tokens) {
    client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });
  }

  return client;
}

// Get Gmail client
function getGmailClient(tokens) {
  const auth = createOAuth2Client(tokens);
  return google.gmail({ version: 'v1', auth });
}

// Refresh access token
async function refreshAccessToken(refreshToken) {
  const client = createOAuth2Client({
    refresh_token: refreshToken
  });

  const { credentials } = await client.refreshAccessToken();
  return credentials;
}

// List emails with filters
async function listEmails(tokens, filters = {}) {
  try {
    const gmail = getGmailClient(tokens);
    
    // Build query from filters
    let query = '';
    if (filters.from) query += `from:${filters.from} `;
    if (filters.to) query += `to:${filters.to} `;
    if (filters.subject) query += `subject:${filters.subject} `;
    if (filters.hasAttachment) query += 'has:attachment ';
    if (filters.isUnread) query += 'is:unread ';
    if (filters.label) query += `label:${filters.label} `;
    if (filters.after) query += `after:${filters.after} `;
    if (filters.before) query += `before:${filters.before} `;

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query.trim() || undefined,
      maxResults: filters.maxResults || 10
    });

    if (!response.data.messages) {
      return [];
    }

    // Get full message details for each email
    const emails = await Promise.all(
      response.data.messages.map(async (message) => {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });
        return parseEmail(fullMessage.data);
      })
    );

    return emails;
  } catch (error) {
    console.error('Error listing emails:', error);
    throw error;
  }
}

// Get a single email by ID
async function getEmailById(tokens, emailId) {
  try {
    const gmail = getGmailClient(tokens);
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full'
    });

    return parseEmail(response.data);
  } catch (error) {
    console.error('Error getting email:', error);
    throw error;
  }
}

// Parse email data
function parseEmail(emailData) {
  const headers = emailData.payload.headers;
  
  const getHeader = (name) => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
  };

  // Get email body
  let body = '';
  if (emailData.payload.body.data) {
    body = Buffer.from(emailData.payload.body.data, 'base64').toString('utf-8');
  } else if (emailData.payload.parts) {
    const textPart = emailData.payload.parts.find(part => part.mimeType === 'text/plain');
    const htmlPart = emailData.payload.parts.find(part => part.mimeType === 'text/html');
    
    if (htmlPart && htmlPart.body.data) {
      body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
    } else if (textPart && textPart.body.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }

  // Get attachments info
  const attachments = [];
  if (emailData.payload.parts) {
    emailData.payload.parts.forEach(part => {
      if (part.filename && part.body.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
          attachmentId: part.body.attachmentId
        });
      }
    });
  }

  return {
    id: emailData.id,
    threadId: emailData.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    bcc: getHeader('Bcc'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body,
    snippet: emailData.snippet,
    labelIds: emailData.labelIds || [],
    attachments,
    raw: emailData
  };
}

// Download attachment
async function downloadAttachment(tokens, emailId, attachmentId) {
  try {
    const gmail = getGmailClient(tokens);
    
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: emailId,
      id: attachmentId
    });

    return Buffer.from(response.data.data, 'base64');
  } catch (error) {
    console.error('Error downloading attachment:', error);
    throw error;
  }
}

// Send email
async function sendEmail(tokens, { to, cc, bcc, subject, body, html, attachments = [] }) {
  try {
    const gmail = getGmailClient(tokens);
    
    // Build email message with proper multipart structure
    const boundary = '----=_Part_' + Date.now();
    const messageParts = [
      'MIME-Version: 1.0\n',
      `To: ${to}\n`,
      cc ? `Cc: ${cc}\n` : '',
      bcc ? `Bcc: ${bcc}\n` : '',
      `Subject: ${subject}\n`,
      `Content-Type: multipart/alternative; boundary="${boundary}"\n\n`,
      `--${boundary}\n`,
      'Content-Type: text/plain; charset=UTF-8\n',
      'Content-Transfer-Encoding: quoted-printable\n\n',
      body || '',
      '\n\n'
    ];
    
    // Add HTML part if provided
    if (html) {
      messageParts.push(
        `--${boundary}\n`,
        'Content-Type: text/html; charset=UTF-8\n',
        'Content-Transfer-Encoding: quoted-printable\n\n',
        html,
        '\n\n'
      );
    }
    
    messageParts.push(`--${boundary}--\n`);

    // Add attachments if any
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        messageParts.push(
          `--${boundary}\n`,
          `Content-Type: ${attachment.mimeType || 'application/octet-stream'}; name="${attachment.filename}"\n`,
          'Content-Transfer-Encoding: base64\n',
          `Content-Disposition: attachment; filename="${attachment.filename}"\n\n`,
          attachment.data.toString('base64'),
          '\n'
        );
      }
    }

    const message = messageParts.join('');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Mark email as read
async function markAsRead(tokens, emailId) {
  try {
    const gmail = getGmailClient(tokens);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error marking email as read:', error);
    throw error;
  }
}

// Add label to email
async function addLabel(tokens, emailId, labelId) {
  try {
    const gmail = getGmailClient(tokens);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        addLabelIds: [labelId]
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding label:', error);
    throw error;
  }
}

// Get user's Gmail profile
async function getProfile(tokens) {
  try {
    const gmail = getGmailClient(tokens);
    
    const response = await gmail.users.getProfile({
      userId: 'me'
    });

    return {
      emailAddress: response.data.emailAddress,
      messagesTotal: response.data.messagesTotal,
      threadsTotal: response.data.threadsTotal,
      historyId: response.data.historyId
    };
  } catch (error) {
    console.error('Error getting profile:', error);
    throw error;
  }
}

module.exports = {
  createOAuth2Client,
  getGmailClient,
  refreshAccessToken,
  listEmails,
  getEmailById,
  downloadAttachment,
  sendEmail,
  markAsRead,
  addLabel,
  getProfile
};

