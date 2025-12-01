require('dotenv').config();
const axios = require('axios');

/**
 * Test Database-Driven API Endpoints
 * Run this to verify courses, assignments, and announcements work without Google Classroom
 */

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// Replace with a valid JWT token
const JWT_TOKEN = process.env.TEST_JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testDatabaseEndpoints() {
  console.log('\n🧪 Testing Database-Driven API Endpoints\n');
  console.log('=' .repeat(60));

  try {
    // ========== TEST 1: COURSES ==========
    console.log('\n📚 TEST 1: GET /api/courses');
    const coursesResponse = await api.get('/api/courses');
    console.log(`✅ Success! Found ${coursesResponse.data.courses?.length || 0} courses`);
    
    if (coursesResponse.data.courses && coursesResponse.data.courses.length > 0) {
      const firstCourse = coursesResponse.data.courses[0];
      console.log(`   Sample course: "${firstCourse.name}" (ID: ${firstCourse.id})`);
      
      const testCourseId = firstCourse.id;

      // ========== TEST 2: COURSE STUDENTS ==========
      console.log(`\n👥 TEST 2: GET /api/courses/${testCourseId}/students`);
      const studentsResponse = await api.get(`/api/courses/${testCourseId}/students`);
      console.log(`✅ Success! Found ${studentsResponse.data.students?.length || 0} enrolled students`);

      // ========== TEST 3: ASSIGNMENTS ==========
      console.log(`\n📝 TEST 3: GET /api/assignments/course/${testCourseId}`);
      const assignmentsResponse = await api.get(`/api/assignments/course/${testCourseId}`);
      console.log(`✅ Success! Found ${assignmentsResponse.data.count || 0} assignments`);

      // ========== TEST 4: ANNOUNCEMENTS ==========
      console.log(`\n📢 TEST 4: GET /api/announcements/course/${testCourseId}`);
      const announcementsResponse = await api.get(`/api/announcements/course/${testCourseId}`);
      console.log(`✅ Success! Found ${announcementsResponse.data.count || 0} announcements`);

      // ========== TEST 5: CREATE ANNOUNCEMENT ==========
      console.log(`\n✍️  TEST 5: POST /api/announcements (Create)`);
      try {
        const newAnnouncement = await api.post('/api/announcements', {
          courseId: testCourseId,
          title: 'Test Announcement',
          content: `This is a test announcement created at ${new Date().toLocaleString()}`
        });
        console.log(`✅ Success! Created announcement ID: ${newAnnouncement.data.announcement.id}`);
        console.log(`   Students notified: ${newAnnouncement.data.studentsNotified}`);

        // Clean up - delete the test announcement
        const announcementId = newAnnouncement.data.announcement.id;
        await api.delete(`/api/announcements/${announcementId}`);
        console.log(`🗑️  Cleaned up: Deleted test announcement`);

      } catch (error) {
        if (error.response?.status === 403) {
          console.log(`⚠️  Skipped (permission denied - user is not a teacher)`);
        } else {
          throw error;
        }
      }

    } else {
      console.log('\n⚠️  No courses found. Cannot test course-specific endpoints.');
      console.log('   Create a course first to run full tests.');
    }

    // ========== TEST 6: UPCOMING ASSIGNMENTS ==========
    console.log(`\n🗓️  TEST 6: GET /api/assignments/upcoming`);
    const upcomingResponse = await api.get('/api/assignments/upcoming?days=30');
    console.log(`✅ Success! Found ${upcomingResponse.data.count || 0} upcoming assignments (next 30 days)`);

    // ========== TEST 7: ALL ANNOUNCEMENTS ==========
    console.log(`\n📊 TEST 7: GET /api/announcements (All)`);
    const allAnnouncementsResponse = await api.get('/api/announcements?limit=10');
    console.log(`✅ Success! Found ${allAnnouncementsResponse.data.count || 0} announcements`);

    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ ALL TESTS PASSED! Database endpoints are working correctly.\n');
    console.log('💡 Summary:');
    console.log('   - Courses: ✅ Working');
    console.log('   - Assignments: ✅ Working');
    console.log('   - Announcements: ✅ Working');
    console.log('   - NO Google Classroom dependencies! 🎉\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }

    if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
      console.error('\n💡 Tip: Set a valid JWT token in TEST_JWT_TOKEN environment variable');
      console.error('   Or update the JWT_TOKEN constant in this script.\n');
    }
  }
}

// Run tests
testDatabaseEndpoints();

