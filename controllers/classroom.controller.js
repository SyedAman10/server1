const jwt = require('jsonwebtoken');
const { getClassroomClient } = require('../integrations/google.classroom');
const { getUserByEmail } = require('../models/user.model');

const listCourses = async (req, res) => {
  console.log('DEBUG: listCourses function called');
  console.log('DEBUG: Request method:', req.method);
  console.log('DEBUG: Request URL:', req.originalUrl);
  console.log('DEBUG: Request body:', req.body);
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    let result;
    
    if (user.role === 'student') {
      // For students: fetch courses they're enrolled in
      console.log('DEBUG: Fetching courses for student:', user.email);
      result = await classroom.courses.list({
        pageSize: 30,
        studentId: 'me'
      });
    } else if (user.role === 'teacher') {
      // For teachers: fetch courses they're teaching (not enrolled in)
      console.log('DEBUG: Fetching courses for teacher:', user.email);
      result = await classroom.courses.list({
        pageSize: 30,
        teacherId: 'me'
      });
    } else {
      // For other roles (like admin), fetch all courses they have access to
      console.log('DEBUG: Fetching courses for role:', user.role);
      result = await classroom.courses.list({
        pageSize: 30
      });
    }

    console.log('DEBUG: listCourses returning courses:', result.data.courses ? result.data.courses.length : 'no courses');
    res.json(result.data.courses || []);
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
    const user = await getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // First, get the course details
    const courseResult = await classroom.courses.get({ id: courseId });
    const course = courseResult.data;

    // Check if user has access to this course based on their role
    if (user.role === 'student') {
      // For students: check if they're enrolled in this course
      try {
        await classroom.courses.students.get({
          courseId: courseId,
          userId: 'me'
        });
      } catch (err) {
        if (err.code === 404) {
          return res.status(403).json({ error: 'You are not enrolled in this course' });
        }
        throw err;
      }
    } else if (user.role === 'teacher') {
      // For teachers: check if they're teaching this course
      try {
        await classroom.courses.teachers.get({
          courseId: courseId,
          userId: 'me'
        });
      } catch (err) {
        if (err.code === 404) {
          return res.status(403).json({ error: 'You are not teaching this course' });
        }
        throw err;
      }
    }
    // For other roles (like admin), allow access to all courses

    res.json(course);
  } catch (err) {
    console.error('Error getting course:', err);
    if (err.code === 404) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.status(500).json({ error: err.message });
  }
};

const createCourse = async (req, res) => {
  console.log('DEBUG: createCourse function called');
  console.log('DEBUG: Request method:', req.method);
  console.log('DEBUG: Request URL:', req.originalUrl);
  console.log('DEBUG: Request body:', req.body);
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers and super_admins can create courses
    if (user.role !== 'teacher' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only teachers and super admins can create courses' });
    }
    
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

    console.log('DEBUG: Creating course with data:', courseData);
    const result = await classroom.courses.create({
      requestBody: courseData
    });
    
    console.log('DEBUG: Course created successfully:', result.data);
    
    // Try to update to ACTIVE state, but don't fail if it's not allowed
    if (result.data.id) {
      try {
        await classroom.courses.patch({
          id: result.data.id,
          updateMask: 'courseState',
          requestBody: {
            courseState: 'ACTIVE'
          }
        });
        console.log('DEBUG: Course state updated to ACTIVE');
      } catch (stateError) {
        console.log('DEBUG: Could not transition course to ACTIVE state (this is normal for some users):', stateError.message);
        // Don't fail the entire operation - the course was created successfully
      }
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
    const user = await getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers can update courses
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can update courses' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Verify the teacher is teaching this course
    try {
      await classroom.courses.teachers.get({
        courseId: courseId,
        userId: 'me'
      });
    } catch (err) {
      if (err.code === 404) {
        return res.status(403).json({ error: 'You are not teaching this course' });
      }
      throw err;
    }
    
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
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers can delete courses
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can delete courses' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Verify the teacher is teaching this course
    try {
      await classroom.courses.teachers.get({
        courseId: courseId,
        userId: 'me'
      });
    } catch (err) {
      if (err.code === 404) {
        return res.status(403).json({ error: 'You are not teaching this course' });
      }
      throw err;
    }

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
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers can archive courses
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can archive courses' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Verify the teacher is teaching this course
    try {
      await classroom.courses.teachers.get({
        courseId: courseId,
        userId: 'me'
      });
    } catch (err) {
      if (err.code === 404) {
        return res.status(403).json({ error: 'You are not teaching this course' });
      }
      throw err;
    }

    const result = await classroom.courses.patch({
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
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers can create announcements
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can create announcements' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Verify the teacher is teaching this course
    try {
      await classroom.courses.teachers.get({
        courseId: courseId,
        userId: 'me'
      });
    } catch (err) {
      if (err.code === 404) {
        return res.status(403).json({ error: 'You are not teaching this course' });
      }
      throw err;
    }

    // Try to create the announcement
    let result;
    try {
      result = await classroom.courses.announcements.create({
        courseId,
        requestBody: {
          text: req.body.text,
          materials: req.body.materials || [],
          state: req.body.state || 'PUBLISHED'
        }
      });
    } catch (createError) {
      // Check if it's a precondition error (course not in ACTIVE state)
      if (createError.code === 400 && createError.message && createError.message.includes('Precondition check failed')) {
        console.log('DEBUG: Precondition check failed - Course is likely in PROVISIONED state instead of ACTIVE. Attempting to activate...');
        
        try {
          // Try to update the course to ACTIVE state
          await classroom.courses.patch({
            id: courseId,
            updateMask: 'courseState',
            requestBody: {
              courseState: 'ACTIVE'
            }
          });
          
          console.log('DEBUG: Course activated, retrying announcement creation...');
          
          // Retry announcement creation
          result = await classroom.courses.announcements.create({
            courseId,
            requestBody: {
              text: req.body.text,
              materials: req.body.materials || [],
              state: req.body.state || 'PUBLISHED'
            }
          });
        } catch (stateError) {
          console.error('DEBUG: Could not activate course:', stateError.message);
          
          // Check if it's a permission error
          if (stateError.code === 403 || stateError.message.includes('Permission')) {
            return res.status(403).json({ 
              error: 'You do not have permission to activate this course. The course is currently in PROVISIONED state and needs to be activated before announcements can be posted. Please contact your Google Workspace administrator to activate the course.' 
            });
          }
          
          // Check if it's a state transition error
          if (stateError.code === 400 && stateError.message && stateError.message.includes('CourseStateDenied')) {
            return res.status(400).json({ 
              error: 'This course is currently in PROVISIONED state and cannot be automatically activated. The Google Classroom API does not allow changing the course state. Announcements can only be posted to ACTIVE courses. Please activate the course manually in Google Classroom first.' 
            });
          }
          
          return res.status(400).json({ 
            error: `This course is currently in PROVISIONED state instead of ACTIVE state. Google Classroom requires courses to be in ACTIVE state before announcements can be posted. Error: ${stateError.message}` 
          });
        }
      } else {
        // Re-throw if it's a different error
        throw createError;
      }
    }

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
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers can invite students
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can invite students' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Verify the teacher is teaching this course
    try {
      await classroom.courses.teachers.get({
        courseId: courseId,
        userId: 'me'
      });
    } catch (err) {
      if (err.code === 404) {
        return res.status(403).json({ error: 'You are not teaching this course' });
      }
      throw err;
    }

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
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers and super_admin can invite other teachers
    if (user.role !== 'teacher' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only teachers and super admins can invite other teachers' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Verify the teacher is teaching this course
    try {
      await classroom.courses.teachers.get({
        courseId: courseId,
        userId: 'me'
      });
    } catch (err) {
      if (err.code === 404) {
        return res.status(403).json({ error: 'You are not teaching this course' });
      }
      throw err;
    }

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

    try {
      const results = await Promise.all(invitationPromises);
      return res.status(201).json({
        message: `Successfully invited ${emails.length} teachers`,
        invitations: results.map(r => r.data)
      });
    } catch (apiErr) {
      // Surface clearer errors for common Classroom API failures
      const msg = apiErr?.response?.data?.error?.message || apiErr.message || 'Failed to create teacher invitations';
      if (msg.includes('UserInIllegalDomain')) {
        return res.status(400).json({
          error: 'The specified user belongs to a domain that cannot be invited to this Classroom',
          details: msg
        });
      }
      throw apiErr;
    }
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
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers can list students
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can view student lists' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Verify the teacher is teaching this course
    try {
      await classroom.courses.teachers.get({
        courseId: courseId,
        userId: 'me'
      });
    } catch (err) {
      if (err.code === 404) {
        return res.status(403).json({ error: 'You are not teaching this course' });
      }
      throw err;
    }

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
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Check if user has access to this course based on their role
    if (user.role === 'student') {
      // For students: check if they're enrolled in this course
      try {
        await classroom.courses.students.get({
          courseId: courseId,
          userId: 'me'
        });
      } catch (err) {
        if (err.code === 404) {
          return res.status(403).json({ error: 'You are not enrolled in this course' });
        }
        throw err;
      }
    } else if (user.role === 'teacher') {
      // For teachers: check if they're teaching this course
      try {
        await classroom.courses.teachers.get({
          courseId: courseId,
          userId: 'me'
        });
      } catch (err) {
        if (err.code === 404) {
          return res.status(403).json({ error: 'You are not teaching this course' });
        }
        throw err;
      }
    }
    // For other roles (like admin), allow access to all courses
    
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
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only teachers can view enrolled students
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can view enrolled students' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Verify the teacher is teaching this course
    try {
      await classroom.courses.teachers.get({
        courseId: courseId,
        userId: 'me'
      });
    } catch (err) {
      if (err.code === 404) {
        return res.status(403).json({ error: 'You are not teaching this course' });
      }
      throw err;
    }
    
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
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const classroom = getClassroomClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    // Check if user has access to this course based on their role
    if (user.role === 'student') {
      // For students: check if they're enrolled in this course
      try {
        await classroom.courses.students.get({
          courseId: courseId,
          userId: 'me'
        });
      } catch (err) {
        if (err.code === 404) {
          return res.status(403).json({ error: 'You are not enrolled in this course' });
        }
        throw err;
      }
    } else if (user.role === 'teacher') {
      // For teachers: check if they're teaching this course
      try {
        await classroom.courses.teachers.get({
          courseId: courseId,
          userId: 'me'
        });
      } catch (err) {
        if (err.code === 404) {
          return res.status(403).json({ error: 'You are not teaching this course' });
        }
        throw err;
      }
    }
    // For other roles (like admin), allow access to all courses
    
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
        
        // Process each submission and get student details
        for (const submission of submissions) {
          try {
            // Get student profile information
            const studentProfile = await classroom.userProfiles.get({
              userId: submission.userId
            });
            
            grades.push({
              assignmentId: work.id,
              assignmentTitle: work.title,
              studentId: submission.userId,
              studentName: studentProfile.data.name?.fullName || 'Unknown Name',
              studentEmail: studentProfile.data.emailAddress || 'Unknown Email',
              grade: submission.assignedGrade,
              maxPoints: work.maxPoints,
              state: submission.state,
              late: submission.late,
              submittedAt: submission.submittedTime
            });
          } catch (studentErr) {
            console.error(`Error fetching student profile for ${submission.userId}:`, studentErr);
            // Fallback with basic info if we can't get student profile
            grades.push({
              assignmentId: work.id,
              assignmentTitle: work.title,
              studentId: submission.userId,
              studentName: 'Unknown Name',
              studentEmail: 'Unknown Email',
              grade: submission.assignedGrade,
              maxPoints: work.maxPoints,
              state: submission.state,
              late: submission.late,
              submittedAt: submission.submittedTime
            });
          }
        }
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
