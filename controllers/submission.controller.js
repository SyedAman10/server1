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
    const userId = req.user.id;

    // Only teachers and super_admin can view all submissions
    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view all submissions'
      });
    }

    // Verify teacher owns this assignment
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if teacher owns the course
    if (userRole === 'teacher') {
      const course = await courseModel.getCourseById(assignment.course_id);
      if (course.teacher_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view submissions for your own assignments'
        });
      }
    }

    const submissions = await submissionModel.getSubmissionsByAssignment(assignmentId);

    return res.status(200).json({
      success: true,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        due_date: assignment.due_date,
        max_points: assignment.max_points
      },
      submissions,
      count: submissions.length,
      submittedCount: submissions.length,
      gradedCount: submissions.filter(s => s.grade !== null).length
    });
  } catch (error) {
    console.error('Error getting assignment submissions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get submissions'
    });
  }
};

// Grade a submission (teacher only)
exports.gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Only teachers and super_admin can grade
    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can grade submissions'
      });
    }

    // Get submission and verify ownership
    const submission = await submissionModel.getSubmissionById(submissionId);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Verify teacher owns this assignment
    const assignment = await assignmentModel.getAssignmentById(submission.assignment_id);
    if (userRole === 'teacher') {
      const course = await courseModel.getCourseById(assignment.course_id);
      if (course.teacher_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only grade submissions for your own assignments'
        });
      }
    }

    // Update the submission with grade and feedback
    const updateQuery = `
      UPDATE assignment_submissions
      SET grade = $1,
          feedback = $2,
          status = 'graded',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    
    const result = await db.query(updateQuery, [grade, feedback || null, submissionId]);
    const updatedSubmission = result.rows[0];

    // Send email notification to student
    try {
      const { getUserById } = require('../models/user.model');
      const student = await getUserById(submission.student_id);
      
      if (student && student.email) {
        const emailSubject = `Your ${assignment.title} has been graded`;
        const emailBody = `
          <h2>📊 Assignment Graded</h2>
          <p>Your teacher has graded your assignment:</p>
          <ul>
            <li><strong>Assignment:</strong> ${assignment.title}</li>
            <li><strong>Grade:</strong> ${grade}${assignment.max_points ? ` / ${assignment.max_points}` : ''}</li>
            ${feedback ? `<li><strong>Feedback:</strong> ${feedback}</li>` : ''}
          </ul>
          <p><a href="https://class.xytek.ai/assignments/${assignment.id}">View your graded assignment</a></p>
        `;
        
        await sendEmail(student.email, emailSubject, emailBody);
        console.log(`✅ Grade notification sent to student: ${student.email}`);
      }
    } catch (emailError) {
      console.error('❌ Error sending grade notification:', emailError);
      // Don't fail the grading if email fails
    }

    return res.status(200).json({
      success: true,
      submission: updatedSubmission,
      message: 'Submission graded successfully'
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to grade submission'
    });
  }
};
