const { google } = require('googleapis');

// Required scopes for Google Calendar API
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
];

const getCalendarClient = (tokens) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  // Set the required scopes
  auth.scope = CALENDAR_SCOPES;
  auth.setCredentials(tokens);
  
  // Create calendar client with retries
  return google.calendar({ 
    version: 'v3', 
    auth,
    retryConfig: {
      retry: 3,
      retryDelay: 1000,
      statusCodesToRetry: [[500, 599]]
    }
  });
};

module.exports = { getCalendarClient };
