const jwt = require('jsonwebtoken');
const { getClassroomClient } = require('../integrations/google.classroom');
const { getUserByEmail } = require('../models/user.model');

const listCourses = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });
    const result = await classroom.courses.list({
      pageSize: 30,
      teacherId: 'me'
    });
    res.json(result.data.courses);
  } catch (err) {
    console.error('Error listing courses:', err);
    res.status(500).json({ error: err.message });
  }
};

const getCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });
    const result = await classroom.courses.get({id: courseId });
    res.json(result.data);
  } catch (err) {
    console.error('Error getting course:', err);
    res.status(500).json({ error: err.message });
  }
};

const createCourse = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    // Ensure we have valid tokens
    if (!user.access_token || !user.refresh_token) {
      return res.status(401).json({ error: 'Missing required OAuth2 tokens' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({ error: 'Course name is required' });
    }

    const courseData = {
      name: req.body.name,
      section: req.body.section || '',
      descriptionHeading: req.body.descriptionHeading || '',
      description: req.body.description || '',
      room: req.body.room || '',
      ownerId: 'me',
      courseState: 'PROVISIONED' // Start in PROVISIONED state, then transition to ACTIVE
    };

    const result = await classroom.courses.create({
      requestBody: courseData
    });    // If successful, update to ACTIVE state
    if (result.data.id) {
      await classroom.courses.patch({
        id: result.data.id,
        updateMask: 'courseState',
        requestBody: {
          courseState: 'ACTIVE'
        }
      });
    }

    res.status(201).json(result.data);
  } catch (err) {
    console.error('Error creating course:', err);
    
    // More specific error handling
    if (err.response && err.response.data && err.response.data.error) {
      return res.status(err.response.status || 500).json({
        error: err.response.data.error.message || err.message,
        details: err.response.data.error.details
      });
    }
    
    res.status(500).json({ error: err.message });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });
    
    // Create update mask from the request body keys
    const updateMask = Object.keys(req.body).join(',');
    
    const result = await classroom.courses.patch({
      id: courseId,
      updateMask,
      requestBody: req.body
    });
    res.json(result.data);
  } catch (err) {
    console.error('Error updating course:', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });
    await classroom.courses.delete({ id: courseId });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ error: err.message });
  }
};

const archiveCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });    const result = await classroom.courses.patch({
      id: courseId,
      updateMask: 'courseState',
      requestBody: { courseState: 'ARCHIVED' }
    });
    res.json(result.data);
  } catch (err) {
    console.error('Error archiving course:', err);
    res.status(500).json({ error: err.message });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    const result = await classroom.courses.announcements.create({
      courseId,
      requestBody: {
        text: req.body.text,
        materials: req.body.materials || [],
        state: req.body.state || 'PUBLISHED'
      }
    });

    res.status(201).json(result.data);
  } catch (err) {
    console.error('Error creating announcement:', err);
    if (err.response && err.response.data && err.response.data.error) {
      return res.status(err.response.status || 500).json({
        error: err.response.data.error.message || err.message,
        details: err.response.data.error.details
      });
    }
    res.status(500).json({ error: err.message });
  }
};

const inviteStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { email, role = 'STUDENT' } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!['STUDENT', 'TEACHER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be either STUDENT or TEACHER' });
    }

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Create an invitation for the user
    const result = await classroom.invitations.create({
      requestBody: {
        courseId: courseId,
        userId: email,
        role: role
      }
    });

    res.status(201).json(result.data);
  } catch (err) {
    console.error('Error inviting user:', err);
    if (err.response && err.response.data && err.response.data.error) {
      return res.status(err.response.status || 500).json({
        error: err.response.data.error.message || err.message,
        details: err.response.data.error.details
      });
    }
    res.status(500).json({ error: err.message });
  }
};

const inviteTeachers = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'At least one teacher email is required' });
    }

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Create invitations for all teachers
    const invitationPromises = emails.map(email => 
      classroom.invitations.create({
        requestBody: {
          courseId: courseId,
          userId: email,
          role: 'TEACHER'
        }
      })
    );

    const results = await Promise.all(invitationPromises);

    res.status(201).json({
      message: `Successfully invited ${emails.length} teachers`,
      invitations: results.map(r => r.data)
    });
  } catch (err) {
    console.error('Error inviting teachers:', err);
    if (err.response && err.response.data && err.response.data.error) {
      return res.status(err.response.status || 500).json({
        error: err.response.data.error.message || err.message,
        details: err.response.data.error.details
      });
    }
    res.status(500).json({ error: err.message });
  }
};

// List students in a course
const listStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });
    const result = await classroom.courses.students.list({ courseId });
    console.log('DEBUG listStudents result:', result.data);
    res.json(result.data.students || []);
  } catch (err) {
    console.error('Error listing students:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get announcements for a course
const getAnnouncements = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });
    
    const result = await classroom.courses.announcements.list({ 
      courseId: courseId,
      pageSize: 50
    });
    
    res.json(result.data.announcements || []);
  } catch (err) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get enrolled students with emails for a course
const getEnrolledStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });
    
    const result = await classroom.courses.students.list({ 
      courseId: courseId,
      pageSize: 50
    });
    
    // Extract student emails and basic info
    const students = (result.data.students || []).map(student => ({
      id: student.userId,
      email: student.profile?.emailAddress,
      name: student.profile?.name?.fullName,
      photoUrl: student.profile?.photoUrl
    }));
    
    res.json(students);
  } catch (err) {
    console.error('Error fetching enrolled students:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get grades for a course
const getGrades = async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });
    
    // First get all course work (assignments)
    const courseWorkResult = await classroom.courses.courseWork.list({
      courseId: courseId,
      pageSize: 50
    });
    
    const courseWork = courseWorkResult.data.courseWork || [];
    const grades = [];
    
    // For each assignment, get student submissions and grades
    for (const work of courseWork) {
      try {
        const submissionsResult = await classroom.courses.courseWork.studentSubmissions.list({
          courseId: courseId,
          courseWorkId: work.id,
          pageSize: 50
        });
        
        const submissions = submissionsResult.data.studentSubmissions || [];
        
        submissions.forEach(submission => {
          grades.push({
            assignmentId: work.id,
            assignmentTitle: work.title,
            studentId: submission.userId,
            studentEmail: submission.assignedGrade ? submission.assignedGrade : null,
            grade: submission.assignedGrade,
            maxPoints: work.maxPoints,
            state: submission.state,
            late: submission.late,
            submittedAt: submission.submittedTime
          });
        });
      } catch (submissionErr) {
        console.error(`Error fetching submissions for assignment ${work.id}:`, submissionErr);
      }
    }
    
    res.json(grades);
  } catch (err) {
    console.error('Error fetching grades:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  archiveCourse,
  createAnnouncement,
  inviteStudents,
  inviteTeachers,
  listStudents,
  getAnnouncements,
  getEnrolledStudents,
  getGrades
};
