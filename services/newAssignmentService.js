const assignmentModel = require('../models/assignment.model');
const courseModel = require('../models/course.model');
const { sendAssignmentEmail } = require('./assignmentEmailService');

/**
 * Assignment Service
 * Handles business logic for assignment operations using database
 */

// Create a new assignment with optional attachments
async function createAssignment({ courseId, teacherId, title, description, dueDate, maxPoints, attachments }) {
  try {
    // Verify course exists
    const course = await courseModel.getCourseById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Create assignment with attachments
    const assignment = await assignmentModel.createAssignment({
      courseId,
      teacherId,
      title,
      description,
      dueDate,
      maxPoints,
      attachments: attachments || []
    });

    // Get all students enrolled in the course
    const students = await courseModel.getEnrolledStudents(courseId);
    
    // Send email to all students
    const emailPromises = students.map(student => 
      sendAssignmentEmail({
        toEmail: student.email,
        studentName: student.name,
        courseName: course.name,
        teacherName: course.teacher_name,
        assignmentTitle: title,
        assignmentDescription: description,
        dueDate,
        maxPoints
      }).catch(error => {
        console.error(`Failed to send assignment email to ${student.email}:`, error);
        return null; // Continue even if one email fails
      })
    );

    await Promise.all(emailPromises);

    return {
      success: true,
      assignment,
      emailsSent: students.length,
      message: `Assignment created and sent to ${students.length} student(s)!`
    };
  } catch (error) {
    console.error('Error creating assignment:', error);
    throw error;
  }
}

// Get assignments for a course
async function getAssignmentsByCourse(courseId, userId, userRole) {
  try {
    const course = await courseModel.getCourseById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Check permissions
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to view assignments for this course');
    }

    if (userRole === 'student') {
      const isEnrolled = await courseModel.isStudentEnrolled(courseId, userId);
      if (!isEnrolled) {
        throw new Error('You are not enrolled in this course');
      }
    }

    const assignments = await assignmentModel.getAssignmentsByCourse(courseId);

    // For teachers and super_admin, add submission counts to each assignment
    if ((userRole === 'teacher' || userRole === 'super_admin') && assignments.length > 0) {
      const submissionModel = require('../models/submission.model');
      const db = require('../utils/db');
      
      // Get submission counts for all assignments in one query (more efficient)
      const assignmentIds = assignments.map(a => a.id);
      const submissionCounts = await db.query(`
        SELECT assignment_id, COUNT(*) as submission_count
        FROM assignment_submissions
        WHERE assignment_id = ANY($1)
        GROUP BY assignment_id
      `, [assignmentIds]);
      
      // Create a map of assignment_id -> count
      const countsMap = {};
      submissionCounts.rows.forEach(row => {
        countsMap[row.assignment_id] = parseInt(row.submission_count);
      });
      
      // Add submission count to each assignment
      const assignmentsWithCounts = assignments.map(assignment => ({
        ...assignment,
        submissionCount: countsMap[assignment.id] || 0
      }));
      
      return {
        success: true,
        assignments: assignmentsWithCounts,
        count: assignments.length
      };
    }
    
    // For students, check which assignments they've submitted
    if (userRole === 'student' && assignments.length > 0) {
      const submissionModel = require('../models/submission.model');
      const db = require('../utils/db');
      
      // Get student's submissions for all assignments in one query
      const assignmentIds = assignments.map(a => a.id);
      const mySubmissions = await db.query(`
        SELECT assignment_id, status, submitted_at, grade
        FROM assignment_submissions
        WHERE assignment_id = ANY($1) AND student_id = $2
      `, [assignmentIds, userId]);
      
      // Create a map of assignment_id -> submission
      const submissionsMap = {};
      mySubmissions.rows.forEach(row => {
        submissionsMap[row.assignment_id] = row;
      });
      
      // Add submission status to each assignment
      const assignmentsWithStatus = assignments.map(assignment => ({
        ...assignment,
        mySubmission: submissionsMap[assignment.id] || null,
        hasSubmitted: !!submissionsMap[assignment.id]
      }));
      
      return {
        success: true,
        assignments: assignmentsWithStatus,
        count: assignments.length
      };
    }

    return {
      success: true,
      assignments,
      count: assignments.length
    };
  } catch (error) {
    console.error('Error getting assignments:', error);
    throw error;
  }
}

// Get a single assignment
async function getAssignmentById(assignmentId, userId, userRole) {
  try {
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Check permissions
    const course = await courseModel.getCourseById(assignment.course_id);
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to view this assignment');
    }

    if (userRole === 'student') {
      const isEnrolled = await courseModel.isStudentEnrolled(assignment.course_id, userId);
      if (!isEnrolled) {
        throw new Error('You are not enrolled in this course');
      }
      
      // For students, check if they have submitted
      const submissionModel = require('../models/submission.model');
      const mySubmission = await submissionModel.getSubmissionByStudentAndAssignment(userId, assignmentId);
      
      return {
        success: true,
        assignment,
        mySubmission: mySubmission || null
      };
    }

    // For teachers and super_admin, include all submissions
    if (userRole === 'teacher' || userRole === 'super_admin') {
      const submissionModel = require('../models/submission.model');
      const submissions = await submissionModel.getSubmissionsByAssignment(assignmentId);
      
      return {
        success: true,
        assignment,
        submissions: submissions || [],
        submissionCount: submissions ? submissions.length : 0
      };
    }

    return {
      success: true,
      assignment
    };
  } catch (error) {
    console.error('Error getting assignment:', error);
    throw error;
  }
}

// Update an assignment
async function updateAssignment(assignmentId, updates, userId, userRole) {
  try {
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Only the teacher who created it or super_admin can update
    if (userRole === 'teacher' && assignment.teacher_id !== userId) {
      throw new Error('You do not have permission to update this assignment');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot update assignments');
    }

    const updatedAssignment = await assignmentModel.updateAssignment(assignmentId, updates);

    return {
      success: true,
      assignment: updatedAssignment,
      message: 'Assignment updated successfully'
    };
  } catch (error) {
    console.error('Error updating assignment:', error);
    throw error;
  }
}

// Delete an assignment
async function deleteAssignment(assignmentId, userId, userRole) {
  try {
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Only the teacher who created it or super_admin can delete
    if (userRole === 'teacher' && assignment.teacher_id !== userId) {
      throw new Error('You do not have permission to delete this assignment');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot delete assignments');
    }

    await assignmentModel.deleteAssignment(assignmentId);

    return {
      success: true,
      message: 'Assignment deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting assignment:', error);
    throw error;
  }
}

// Get upcoming assignments
async function getUpcomingAssignments(days = 7) {
  try {
    const assignments = await assignmentModel.getUpcomingAssignments(days);

    return {
      success: true,
      assignments,
      count: assignments.length
    };
  } catch (error) {
    console.error('Error getting upcoming assignments:', error);
    throw error;
  }
}

// Add attachments to an existing assignment
async function addAttachments(assignmentId, newAttachments, userId, userRole) {
  try {
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Only the teacher who created it or super_admin can add attachments
    if (userRole === 'teacher' && assignment.teacher_id !== userId) {
      throw new Error('You do not have permission to modify this assignment');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot add attachments to assignments');
    }

    const updatedAssignment = await assignmentModel.addAttachments(assignmentId, newAttachments);

    return {
      success: true,
      assignment: updatedAssignment,
      message: `${newAttachments.length} attachment(s) added successfully`
    };
  } catch (error) {
    console.error('Error adding attachments:', error);
    throw error;
  }
}

// Remove an attachment from an assignment
async function removeAttachment(assignmentId, attachmentFilename, userId, userRole) {
  try {
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Only the teacher who created it or super_admin can remove attachments
    if (userRole === 'teacher' && assignment.teacher_id !== userId) {
      throw new Error('You do not have permission to modify this assignment');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot remove attachments from assignments');
    }

    const updatedAssignment = await assignmentModel.removeAttachment(assignmentId, attachmentFilename);

    return {
      success: true,
      assignment: updatedAssignment,
      message: 'Attachment removed successfully'
    };
  } catch (error) {
    console.error('Error removing attachment:', error);
    throw error;
  }
}

module.exports = {
  createAssignment,
  getAssignmentsByCourse,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getUpcomingAssignments,
  addAttachments,
  removeAttachment
};

