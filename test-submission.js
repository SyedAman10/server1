require('dotenv').config();
const axios = require('axios');

/**
 * Test script for assignment submission
 * This script submits an assignment without going through the full AI workflow
 */

// Configuration - UPDATE THESE VALUES
const CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  // Get your token from: node get-test-token.js
  studentToken: 'YOUR_STUDENT_TOKEN_HERE',
  assignmentId: 1, // Change to your assignment ID
  submissionText: 'This is a test submission for the assignment. The answer is 42.',
  // Optional: Add file paths for attachments
  attachments: [] // e.g., ['./test-file.pdf']
};

async function submitAssignment() {
  try {
    console.log('\n📝 Starting assignment submission test...\n');
    console.log('Configuration:', {
      apiUrl: CONFIG.apiUrl,
      assignmentId: CONFIG.assignmentId,
      hasToken: !!CONFIG.studentToken && CONFIG.studentToken !== 'YOUR_STUDENT_TOKEN_HERE',
      submissionText: CONFIG.submissionText.substring(0, 50) + '...',
      attachmentsCount: CONFIG.attachments.length
    });

    // Validate token
    if (!CONFIG.studentToken || CONFIG.studentToken === 'YOUR_STUDENT_TOKEN_HERE') {
      console.error('\n❌ Error: Please set a valid student token in the CONFIG');
      console.log('\n💡 To get a token, run: node get-test-token.js\n');
      process.exit(1);
    }

    // Step 1: Get assignment details
    console.log('\n📋 Step 1: Fetching assignment details...');
    const assignmentResponse = await axios.get(
      `${CONFIG.apiUrl}/api/assignments/${CONFIG.assignmentId}`,
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.studentToken}`
        }
      }
    );
    
    const assignment = assignmentResponse.data;
    console.log('✅ Assignment found:', {
      id: assignment.id,
      title: assignment.title,
      courseId: assignment.course_id,
      maxPoints: assignment.max_points,
      dueDate: assignment.due_date
    });

    // Step 2: Submit the assignment
    console.log('\n📤 Step 2: Submitting assignment...');
    const submissionData = {
      assignmentId: CONFIG.assignmentId,
      submissionText: CONFIG.submissionText
      // Note: File attachments would need to be uploaded separately via the upload endpoint
    };

    const submissionResponse = await axios.post(
      `${CONFIG.apiUrl}/api/submissions`,
      submissionData,
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.studentToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const submission = submissionResponse.data;
    console.log('✅ Submission successful!', {
      submissionId: submission.id || submission.submission?.id,
      assignmentId: submission.assignment_id || submission.submission?.assignment_id,
      studentId: submission.student_id || submission.submission?.student_id,
      submittedAt: submission.submitted_at || submission.submission?.submitted_at
    });

    // Step 3: Check if AI grading was triggered
    console.log('\n🤖 Step 3: Checking AI grading status...');
    
    // Wait a bit for AI grading to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const submissionId = submission.id || submission.submission?.id;
      const gradeCheckResponse = await axios.get(
        `${CONFIG.apiUrl}/api/submissions/${submissionId}`,
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.studentToken}`
          }
        }
      );

      const submissionWithGrade = gradeCheckResponse.data;
      console.log('📊 Submission status:', {
        submissionId: submissionWithGrade.id,
        status: submissionWithGrade.status,
        grade: submissionWithGrade.grade || 'Not graded yet',
        hasAIGrade: !!submissionWithGrade.ai_grade
      });

      if (submissionWithGrade.ai_grade) {
        console.log('\n✅ AI Grade Generated:', {
          grade: submissionWithGrade.ai_grade.proposed_grade,
          feedback: submissionWithGrade.ai_grade.proposed_feedback?.substring(0, 100) + '...',
          status: submissionWithGrade.ai_grade.status
        });
      } else {
        console.log('\n⏳ AI grading is still processing or not enabled for this assignment');
      }
    } catch (gradeError) {
      console.log('⚠️  Could not fetch AI grading status:', gradeError.response?.data?.message || gradeError.message);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📝 Summary:');
    console.log('- Assignment submitted successfully');
    console.log('- Teacher will receive email notification');
    console.log('- AI grading will process in the background (if enabled)');
    console.log('- Check server logs for AI grading details\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('\nResponse details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }

    if (error.response?.status === 401) {
      console.log('\n💡 Tip: Your token may be expired or invalid. Get a new one with: node get-test-token.js\n');
    }

    process.exit(1);
  }
}

// Run the test
console.log('\n' + '='.repeat(60));
console.log('🧪 ASSIGNMENT SUBMISSION TEST SCRIPT');
console.log('='.repeat(60));

submitAssignment();

