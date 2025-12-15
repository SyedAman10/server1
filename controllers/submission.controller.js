const submissionModel = require('../models/submission.model');
const assignmentModel = require('../models/assignment.model');
const courseModel = require('../models/course.model');
const { sendEmail } = require('../services/emailService');

/**
 * Submission Controller
 * Handles HTTP requests for assignment submissions
 */

// Create a submission
exports.createSubmission = async (req, res) => {
  try {
    const { assignmentId, submissionText, attachments } = req.body;
    const studentId = req.user.id;
    const userRole = req.user.role;

    // Only students can submit
    if (userRole !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit assignments'
      });
    }

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required'
      });
    }

    // Check if assignment exists
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if already submitted
    const hasSubmitted = await submissionModel.hasStudentSubmitted(studentId, assignmentId);
    if (hasSubmitted) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this assignment'
      });
    }

    // Check if assignment requires attachments
    const assignmentAttachments = assignment.attachments ? 
      (typeof assignment.attachments === 'string' ? JSON.parse(assignment.attachments) : assignment.attachments) : [];
    
    if (assignmentAttachments.length > 0 && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'This assignment requires file attachments',
        requiresAttachment: true
      });
    }

    const submission = await submissionModel.createSubmission({
      assignmentId,
      studentId,
      submissionText: submissionText || '',
      attachments: attachments || [],
      status: 'submitted'
    });

    // Send email notification to teacher
    try {
      const courseId = assignment.course_id;
      const course = await courseModel.getCourseById(courseId);
      
      if (course && course.teacher_id) {
        const { getUserById } = require('../models/user.model');
        const teacher = await getUserById(course.teacher_id);
        const student = await getUserById(studentId);
        
        if (teacher && teacher.email) {
          const emailSubject = `New Submission: ${assignment.title}`;
          const emailBody = `
            <h2>New Assignment Submission</h2>
            <p>A student has submitted an assignment:</p>
            <ul>
              <li><strong>Course:</strong> ${course.name}</li>
              <li><strong>Assignment:</strong> ${assignment.title}</li>
              <li><strong>Student:</strong> ${student.name} (${student.email})</li>
              <li><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
              ${attachments && attachments.length > 0 ? `<li><strong>Attachments:</strong> ${attachments.length} file(s)</li>` : ''}
            </ul>
            <p>View the submission in your classroom dashboard.</p>
          `;
          
          await sendEmail(teacher.email, emailSubject, emailBody);
          console.log(`✅ Email notification sent to teacher: ${teacher.email}`);
        }
      }
    } catch (emailError) {
      console.error('❌ Error sending email notification:', emailError);
      // Don't fail the submission if email fails
    }

    return res.status(201).json({
      success: true,
      submission,
      message: 'Assignment submitted successfully'
    });
  } catch (error) {
    console.error('Error creating submission:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit assignment'
    });
  }
};

// Get student's submissions
exports.getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user.id;

    const submissions = await submissionModel.getSubmissionsByStudent(studentId);

    return res.status(200).json({
      success: true,
      submissions,
      count: submissions.length
    });
  } catch (error) {
    console.error('Error getting submissions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get submissions'
    });
  }
};

// Get specific submission
exports.getSubmission = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    const submission = await submissionModel.getSubmissionByStudentAndAssignment(studentId, assignmentId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    return res.status(200).json({
      success: true,
      submission
    });
  } catch (error) {
    console.error('Error getting submission:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get submission'
    });
  }
};

// Get all submissions for an assignment (teacher only)
exports.getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userRole = req.user.role;

    // Only teachers and super_admin can view all submissions
    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view all submissions'
      });
    }

    const submissions = await submissionModel.getSubmissionsByAssignment(assignmentId);

    return res.status(200).json({
      success: true,
      submissions,
      count: submissions.length
    });
  } catch (error) {
    console.error('Error getting assignment submissions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get submissions'
    });
  }
};
