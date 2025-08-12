const { getClassroomClient } = require('../integrations/google.classroom');
const { google } = require('googleapis');

/**
 * Validate and format due date
 * @param {Object} dueDate - Due date object
 * @param {Object} dueTime - Due time object
 * @returns {Object} Formatted due date and time
 */
function validateAndFormatDueDate(dueDate, dueTime) {
  if (!dueDate) return { dueDate: undefined, dueTime: undefined };

  // Parse the date string (YYYY-MM-DD)
  const [year, month, day] = dueDate.split('-').map(Number);
  
  // Create a Date object for validation
  const date = new Date(year, month - 1, day);
  const now = new Date();
  
  // If time is provided, validate and format it first
  let formattedTime;
  if (dueTime) {
    const [hours, minutes] = dueTime.split(':').map(Number);
    
    // Validate time values
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error('Invalid time format. Please use 24-hour format (HH:MM)');
    }

    formattedTime = {
      hours,
      minutes
    };

    // If time is provided, set it on the date object for more accurate comparison
    date.setHours(hours, minutes, 0, 0);
  } else {
    // If no time provided, set to end of day (23:59:59)
    date.setHours(23, 59, 59, 999);
  }
  
  // Validate that the date is in the future
  if (date <= now) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    throw new Error(`Due date must be in the future. The earliest possible due date is ${tomorrow.toISOString().split('T')[0]}`);
  }

  // Format the date for Google Classroom API
  const formattedDate = {
    year,
    month,
    day
  };

  return {
    dueDate: formattedDate,
    dueTime: formattedTime
  };
}

// Helper to find a Google Drive file ID by name
async function findDriveFileIdByName(tokens, fileName) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials(tokens);

  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: `name = '${fileName}' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  return null;
}

/**
 * Create a new assignment in a course
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} courseId - Course ID
 * @param {Object} assignmentData - Assignment data
 * @returns {Promise<Object>} Created assignment
 */
async function createAssignment(tokens, courseId, assignmentData) {
  const classroom = await getClassroomClient(tokens);

  // Validate and format due date
  const { dueDate, dueTime } = validateAndFormatDueDate(
    assignmentData.dueDate,
    assignmentData.dueTime
  );

  // Process materials
  let materials = [];
  if (assignmentData.materials && assignmentData.materials.length > 0) {
    for (const mat of assignmentData.materials) {
      if (mat.type === 'GOOGLE_DRIVE') {
        const fileId = await findDriveFileIdByName(tokens, mat.title);
        if (fileId) {
          materials.push({
            driveFile: {
              driveFile: { id: fileId }
            }
          });
        }
      } else {
        // If other material types are supported, handle here
        materials.push(mat);
      }
    }
  }

  // Prepare the assignment request body
  const requestBody = {
    title: assignmentData.title,
    description: assignmentData.description || '',
    materials,
    state: assignmentData.state || 'PUBLISHED',
    maxPoints: assignmentData.maxPoints || 100,
    workType: 'ASSIGNMENT',
    dueDate,
    dueTime,
    topicId: assignmentData.topicId
  };

  // Create the assignment
  const result = await classroom.courses.courseWork.create({
    courseId,
    requestBody
  });

  return result.data;
}

/**
 * List all assignments in a course
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} courseId - Course ID
 * @returns {Promise<Array>} List of assignments
 */
async function listAssignments(tokens, courseId) {
  const classroom = await getClassroomClient(tokens);

  const result = await classroom.courses.courseWork.list({
    courseId,
    pageSize: 30,
    orderBy: 'dueDate desc'
  });

  return result.data.courseWork || [];
}

/**
 * Get a specific assignment
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @returns {Promise<Object>} Assignment details
 */
async function getAssignment(tokens, courseId, assignmentId) {
  const classroom = await getClassroomClient(tokens);

  const result = await classroom.courses.courseWork.get({
    courseId,
    id: assignmentId
  });

  return result.data;
}

/**
 * Update an assignment
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated assignment
 */
async function updateAssignment(tokens, courseId, assignmentId, updateData) {
  const classroom = await getClassroomClient(tokens);

  // Create update mask from the update data keys
  const updateMask = Object.keys(updateData).join(',');

  const result = await classroom.courses.courseWork.patch({
    courseId,
    id: assignmentId,
    updateMask,
    requestBody: updateData
  });

  return result.data;
}

/**
 * Delete an assignment
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @returns {Promise<void>}
 */
async function deleteAssignment(tokens, courseId, assignmentId) {
  const classroom = await getClassroomClient(tokens);

  await classroom.courses.courseWork.delete({
    courseId,
    id: assignmentId
  });
}

/**
 * Get student submissions for an assignment
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @returns {Promise<Array>} List of student submissions
 */
async function getStudentSubmissions(tokens, courseId, assignmentId) {
  const classroom = await getClassroomClient(tokens);
  const result = await classroom.courses.courseWork.studentSubmissions.list({
    courseId,
    courseWorkId: assignmentId
  });
  return result.data.studentSubmissions || [];
}

/**
 * Update a student submission grade
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {string} submissionId - Submission ID
 * @param {Object} gradeData - Grade data (assignedGrade, draftGrade)
 * @returns {Promise<Object>} Updated submission
 */
async function updateSubmissionGrade(tokens, courseId, assignmentId, submissionId, gradeData) {
  const classroom = await getClassroomClient(tokens);
  
  const result = await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
    courseId,
    courseWorkId: assignmentId,
    id: submissionId,
    requestBody: {
      assignedGrade: gradeData.assignedGrade,
      draftGrade: gradeData.draftGrade
    }
  });
  
  return result.data;
}

/**
 * Return a student submission (change state to RETURNED)
 * @param {Object} tokens - OAuth2 tokens
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @param {string} submissionId - Submission ID
 * @returns {Promise<Object>} Returned submission
 */
async function returnSubmission(tokens, courseId, assignmentId, submissionId) {
  const classroom = await getClassroomClient(tokens);
  
  const result = await classroom.courses.courseWork.studentSubmissions.return({
    courseId,
    courseWorkId: assignmentId,
    id: submissionId,
    requestBody: {}
  });
  
  return result.data;
}

module.exports = {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  getStudentSubmissions,
  updateSubmissionGrade,
  returnSubmission
}; 