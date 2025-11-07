/**
 * Test script for inviting students with custom Xytek emails
 * 
 * Usage:
 * 1. Make sure your server is running
 * 2. Update the JWT_TOKEN, courseId, and studentEmail below
 * 3. Run: node test-custom-invite.js
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // Update with your server URL
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Get this from your auth flow
const COURSE_ID = 'YOUR_COURSE_ID_HERE'; // The Google Classroom course ID
const STUDENT_EMAIL = 'student@example.com'; // Student to invite

async function testInviteWithCustomEmail() {
  console.log('🧪 Testing Google Classroom Invitation with Custom Xytek Email\n');

  try {
    console.log('📧 Inviting student:', STUDENT_EMAIL);
    console.log('📚 Course ID:', COURSE_ID);
    console.log('✨ Custom Xytek email will be sent!\n');

    const response = await axios.post(
      `${API_BASE_URL}/classroom/${COURSE_ID}/invite`,
      {
        email: STUDENT_EMAIL,
        role: 'STUDENT',
        sendCustomEmail: true // <-- This enables the custom Xytek email
      },
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ SUCCESS! Invitation sent.\n');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\n📨 What happened:');
    console.log('1. ✅ Google Classroom invitation created (student will receive Google email)');
    console.log('2. ✅ Custom Xytek branded email sent (if sendCustomEmail was true)');
    console.log('\n⚠️  Note: Google Classroom automatically sends its own email. This cannot be prevented.');
    
  } catch (error) {
    console.error('❌ ERROR:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Tip: Your JWT token may be invalid or expired. Get a new one from your auth flow.');
    } else if (error.response?.status === 403) {
      console.log('\n💡 Tip: Make sure you are a teacher of this course.');
    } else if (error.response?.status === 404) {
      console.log('\n💡 Tip: Check that the course ID is correct.');
    }
  }
}

async function testBatchInviteTeachers() {
  console.log('\n\n🧪 Testing Batch Teacher Invitation with Custom Emails\n');

  const teacherEmails = [
    'teacher1@example.com',
    'teacher2@example.com'
  ];

  try {
    console.log('📧 Inviting teachers:', teacherEmails.join(', '));
    console.log('📚 Course ID:', COURSE_ID);
    console.log('✨ Custom Xytek emails will be sent!\n');

    const response = await axios.post(
      `${API_BASE_URL}/classroom/${COURSE_ID}/invite-teachers`,
      {
        emails: teacherEmails,
        sendCustomEmail: true // <-- This enables custom Xytek emails for all teachers
      },
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ SUCCESS! Batch invitations sent.\n');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ ERROR:', error.response?.data || error.message);
  }
}

// Example: Testing different scenarios
async function runAllTests() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('   Google Classroom Custom Email Invitation Tests');
  console.log('════════════════════════════════════════════════════════════════\n');

  // Validate configuration
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.error('❌ ERROR: Please update JWT_TOKEN in this script first!');
    console.log('\n💡 How to get a JWT token:');
    console.log('   1. Login via your auth endpoint: POST /api/auth/login');
    console.log('   2. Copy the token from the response');
    console.log('   3. Or run: node get-test-token.js\n');
    return;
  }

  if (COURSE_ID === 'YOUR_COURSE_ID_HERE') {
    console.error('❌ ERROR: Please update COURSE_ID in this script first!');
    console.log('\n💡 How to get a course ID:');
    console.log('   1. List your courses: GET /api/classroom/courses');
    console.log('   2. Copy the ID of the course you want to use\n');
    return;
  }

  // Run tests
  await testInviteWithCustomEmail();
  
  // Uncomment to test batch teacher invitations
  // await testBatchInviteTeachers();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('   Tests Complete!');
  console.log('════════════════════════════════════════════════════════════════\n');
}

// Run the tests
runAllTests();

/**
 * EXPECTED BEHAVIOR:
 * 
 * 1. Google Classroom API creates the invitation
 * 2. Google sends its standard email (cannot be prevented)
 * 3. Your system sends a custom Xytek branded HTML email
 * 4. Student receives BOTH emails
 * 
 * The Xytek email will be more prominent and helpful, so students
 * will likely engage with that one first.
 * 
 * TROUBLESHOOTING:
 * 
 * - If custom email fails to send, the invitation still succeeds
 * - Check Gmail API scopes are enabled
 * - Ensure teacher has Gmail API access
 * - Consider using SendGrid/AWS SES for production
 */

