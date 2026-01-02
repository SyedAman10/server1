require('dotenv').config();

/**
 * Direct test script for AI grading
 * This bypasses the API and directly tests the AI grading service
 */

const aiGradingService = require('./services/aiGradingService');

// Configuration - UPDATE THESE VALUES
const TEST_CONFIG = {
  submissionId: 10, // Your submission ID
  assignmentId: 2,  // Your assignment ID
  studentId: 2,     // Your student ID
  teacherId: 1,     // Teacher ID
  // Leave null to use actual submission from DB
  testSubmissionText: null, // Or set to: 'This is a test submission...'
  testUserToken: 'fake-token-for-testing'
};

async function testAIGrading() {
  try {
    console.log('\n🤖 Starting AI Grading Test...\n');
    console.log('Configuration:', TEST_CONFIG);
    console.log('\n' + '='.repeat(60));

    // Test the AI grading service directly
    console.log('\n📝 Step 1: Processing submission for AI grading...');
    
    const result = await aiGradingService.processSubmissionForGrading({
      submissionId: TEST_CONFIG.submissionId,
      assignmentId: TEST_CONFIG.assignmentId,
      studentId: TEST_CONFIG.studentId,
      teacherId: TEST_CONFIG.teacherId,
      submissionText: TEST_CONFIG.testSubmissionText,
      attachments: [],
      userToken: TEST_CONFIG.testUserToken,
      req: { user: { id: TEST_CONFIG.studentId } } // Mock request object
    });

    console.log('\n✅ AI Grading Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n' + '='.repeat(60));
      console.log('✅ AI GRADING TEST PASSED');
      console.log('='.repeat(60));
      console.log('\n📊 Grading Summary:');
      console.log(`- Submission ID: ${TEST_CONFIG.submissionId}`);
      console.log(`- Grade: ${result.grade?.proposed_grade || 'N/A'}`);
      console.log(`- Status: ${result.grade?.status || 'N/A'}`);
      console.log(`- Mode: ${result.mode || 'N/A'}`);
      
      if (result.grade?.proposed_feedback) {
        console.log(`\n💬 Feedback Preview:`);
        console.log(result.grade.proposed_feedback.substring(0, 200) + '...');
      }

      if (result.emailSent) {
        console.log('\n✅ Email notification sent to teacher');
      }
    } else {
      console.log('\n❌ AI Grading failed:', result.error);
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\nError details:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Check if OpenAI API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.error('\n❌ Error: OPENAI_API_KEY is not configured in .env file\n');
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('🧪 AI GRADING DIRECT TEST SCRIPT');
console.log('='.repeat(60));
console.log('\n💡 This script directly tests the AI grading service');
console.log('   without going through the API endpoints.\n');

testAIGrading();

