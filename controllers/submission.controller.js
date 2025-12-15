const submissionModel = require('../models/submission.model');
const assignmentModel = require('../models/assignment.model');

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
