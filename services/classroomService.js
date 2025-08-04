const { google } = require('googleapis');

async function getClassroomClient(tokens) {
  const auth = new google.auth.OAuth2();
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

module.exports = {
  createCourse,
  listCourses,
  getCourse
};
