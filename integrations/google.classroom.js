const { google } = require('googleapis');

// Required scopes for Google Classroom API
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.addons.current',
  'https://www.googleapis.com/auth/classroom.addons.current.readonly'
];

const getClassroomClient = (tokens) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  // Set the required scopes
  auth.scope = CLASSROOM_SCOPES;
  auth.setCredentials(tokens);
  // Create classroom client with retries
  return google.classroom({ 
    version: 'v1', 
    auth,
    retryConfig: {
      retry: 3,
      retryDelay: 1000,
      statusCodesToRetry: [[500, 599]]
    }
  });
};

module.exports = { getClassroomClient };

