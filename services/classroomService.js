const { google } = require('googleapis');

async function getClassroomClient(tokens) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials(tokens);
  return google.classroom({ version: 'v1', auth });
}

// ✅ Create a new course
async function createCourse(tokens, courseData) {
  const classroom = await getClassroomClient(tokens);

  const res = await classroom.courses.create({
    requestBody: {
      name: courseData.name,
      section: courseData.section,
      descriptionHeading: courseData.descriptionHeading,
      description: courseData.description,
      room: courseData.room,
      ownerId: courseData.ownerEmail, // Use "me" if current user
      courseState: 'PROVISIONED'
    }
  });

  return res.data;
}

// ✅ Get all courses of a user
async function listCourses(tokens) {
  const classroom = await getClassroomClient(tokens);

  const res = await classroom.courses.list();
  return res.data.courses || [];
}

// ✅ Get details of one course
async function getCourse(tokens, courseId) {
  const classroom = await getClassroomClient(tokens);

  const res = await classroom.courses.get({ id: courseId });
  return res.data;
}

// ✅ Invite a student to a course
async function inviteStudent(tokens, courseId, studentEmail) {
  // Create OAuth2 client with proper configuration
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  // Set the credentials with the provided tokens
  auth.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });
  
  const classroom = google.classroom({ version: 'v1', auth });

  const res = await classroom.courses.students.create({
    courseId,
    requestBody: {
      userId: studentEmail
    }
  });
  return res.data;
}

// ✅ List teachers of a course
async function listTeachers(tokens, courseId) {
  console.log('DEBUG: listTeachers called with courseId:', courseId);
  const classroom = await getClassroomClient(tokens);

  const res = await classroom.courses.teachers.list({
    courseId: courseId
  });
  console.log('DEBUG: listTeachers response:', JSON.stringify(res.data, null, 2));
  return res.data.teachers || [];
}

// ✅ Get owner profile by user ID
async function getOwnerProfile(tokens, userId) {
  console.log('DEBUG: getOwnerProfile called with userId:', userId);
  const classroom = await getClassroomClient(tokens);

  const res = await classroom.userProfiles.get({
    userId: userId
  });
  console.log('DEBUG: getOwnerProfile response:', JSON.stringify(res.data, null, 2));
  return res.data;
}

module.exports = {
  createCourse,
  listCourses,
  getCourse,
  inviteStudent,
  listTeachers,
  getOwnerProfile
};
