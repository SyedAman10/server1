const aiGradingSettingsModel = require('../models/aiGradingSettings.model');
const aiGradeModel = require('../models/aiGrade.model');
const assignmentModel = require('../models/assignment.model');
const submissionModel = require('../models/submission.model');
const courseModel = require('../models/course.model');
const aiGradingService = require('../services/aiGradingService');
const { sendEmail } = require('../services/emailService');
const { getUserById } = require('../models/user.model');

/**
 * AI Grading Controller
 * Handles HTTP requests for AI grading features
 */

// Enable/Update AI grading settings for an assignment
exports.updateGradingSettings = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { enabled, mode, aiInstructions, extractCriteria } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only teachers can manage AI grading
    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can manage AI grading settings'
      });
    }

    // Verify assignment exists and teacher owns it
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    if (userRole === 'teacher') {
      const course = await courseModel.getCourseById(assignment.course_id);
      if (course.teacher_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only manage AI grading for your own assignments'
        });
      }
    }

    let gradingCriteria = null;
    let rubric = null;

    // Extract grading criteria using AI if requested
    if (extractCriteria || enabled) {
      console.log('🤖 Extracting grading criteria from assignment...');
      const criteriaResult = await aiGradingService.extractGradingCriteria(assignment);
      
      if (criteriaResult.success) {
        gradingCriteria = criteriaResult.rawText;
        rubric = criteriaResult.criteria;
      } else {
        console.warn('⚠️ Could not extract criteria, using assignment description');
        gradingCriteria = assignment.description;
      }
    }

    // Save or update settings
    const settings = await aiGradingSettingsModel.upsertGradingSettings({
      assignmentId,
      teacherId: userId,
      enabled: enabled !== undefined ? enabled : false,
      mode: mode || 'manual',
      gradingCriteria,
      rubric,
      maxPoints: assignment.max_points,
      aiInstructions: aiInstructions || null
    });

    return res.status(200).json({
      success: true,
      settings,
      message: enabled ? `AI grading enabled in ${mode} mode` : 'AI grading settings updated'
    });
  } catch (error) {
    console.error('Error updating AI grading settings:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update AI grading settings'
    });
  }
};

// Get AI grading settings for an assignment
exports.getGradingSettings = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify assignment exists
    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Only teachers can view AI grading settings
    if (userRole === 'teacher') {
      const course = await courseModel.getCourseById(assignment.course_id);
      if (course.teacher_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const settings = await aiGradingSettingsModel.getGradingSettings(assignmentId);

    return res.status(200).json({
      success: true,
      settings: settings || { enabled: false },
      assignment: {
        id: assignment.id,
        title: assignment.title,
        max_points: assignment.max_points
      }
    });
  } catch (error) {
    console.error('Error getting AI grading settings:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get AI grading settings'
    });
  }
};

// Generate rubric suggestions for an assignment
exports.generateRubric = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only teachers can generate rubrics
    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can generate rubrics'
      });
    }

    const assignment = await assignmentModel.getAssignmentById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    if (userRole === 'teacher') {
      const course = await courseModel.getCourseById(assignment.course_id);
      if (course.teacher_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const result = await aiGradingService.generateRubricSuggestions(assignment);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to generate rubric'
      });
    }

    return res.status(200).json({
      success: true,
      rubric: result.rubric,
      message: 'Rubric generated successfully'
    });
  } catch (error) {
    console.error('Error generating rubric:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate rubric'
    });
  }
};

// Get grade details by token (for review page)
exports.getGradeByToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Get AI grade by token
    const aiGrade = await aiGradeModel.getAIGradeByToken(token);
    
    if (!aiGrade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found or approval link is invalid/expired'
      });
    }
    
    // Return grade details including all joined data
    return res.status(200).json({
      success: true,
      grade: aiGrade
    });
  } catch (error) {
    console.error('Error getting grade by token:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get grade details'
    });
  }
};

// Approve an AI grade
exports.approveGrade = async (req, res) => {
  try {
    const { token } = req.params;

    // Get AI grade by token
    const aiGrade = await aiGradeModel.getAIGradeByToken(token);
    
    if (!aiGrade) {
      return res.status(404).json({
        success: false,
        message: 'Grade approval link is invalid or expired'
      });
    }

    if (aiGrade.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This grade has already been ${aiGrade.status}`
      });
    }

    // Approve the AI grade
    const approved = await aiGradeModel.approveAIGrade(token, aiGrade.teacher_id);

    // Apply the grade to the actual submission
    const db = require('../utils/db');
    
    // Convert grade to integer if the submissions table expects INTEGER
    // Round to nearest integer since proposed_grade is DECIMAL but submissions.grade is INTEGER
    const finalGrade = Math.round(parseFloat(aiGrade.proposed_grade));
    
    await db.query(`
      UPDATE assignment_submissions
      SET grade = $1,
          feedback = $2,
          status = 'graded',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [finalGrade, aiGrade.proposed_feedback, aiGrade.submission_id]);

    // Send notification to student
    try {
      const student = await getUserById(aiGrade.student_id);
      
      if (student && student.email) {
        const emailSubject = `Your ${aiGrade.assignment_title} has been graded`;
        const emailBody = `
          <h2>📊 Assignment Graded</h2>
          <p>Your teacher has reviewed and approved the AI-generated grade for your assignment:</p>
          <ul>
            <li><strong>Course:</strong> ${aiGrade.course_name}</li>
            <li><strong>Assignment:</strong> ${aiGrade.assignment_title}</li>
            <li><strong>Grade:</strong> ${aiGrade.proposed_grade} / ${aiGrade.assignment_max_points}</li>
          </ul>
          <h3>Feedback:</h3>
          <p>${aiGrade.proposed_feedback}</p>
          <p><a href="https://class.xytek.ai/assignments/${aiGrade.assignment_id}">View your graded assignment</a></p>
        `;
        
        await sendEmail(student.email, emailSubject, emailBody);
      }
    } catch (emailError) {
      console.error('❌ Error sending grade notification:', emailError);
    }

    return res.status(200).json({
      success: true,
      message: 'Grade approved and applied successfully',
      grade: approved
    });
  } catch (error) {
    console.error('Error approving grade:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve grade'
    });
  }
};

// Reject an AI grade
exports.rejectGrade = async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    const aiGrade = await aiGradeModel.getAIGradeByToken(token);
    
    if (!aiGrade) {
      return res.status(404).json({
        success: false,
        message: 'Grade rejection link is invalid or expired'
      });
    }

    if (aiGrade.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This grade has already been ${aiGrade.status}`
      });
    }

    const rejected = await aiGradeModel.rejectAIGrade(
      token, 
      reason || 'Teacher rejected the AI grade',
      aiGrade.teacher_id
    );

    return res.status(200).json({
      success: true,
      message: 'Grade rejected. You can manually grade this submission.',
      grade: rejected
    });
  } catch (error) {
    console.error('Error rejecting grade:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject grade'
    });
  }
};

// Get pending AI grades for a teacher
exports.getPendingGrades = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view pending grades'
      });
    }

    const pendingGrades = await aiGradeModel.getPendingGradesForTeacher(userId);

    return res.status(200).json({
      success: true,
      pendingGrades,
      count: pendingGrades.length
    });
  } catch (error) {
    console.error('Error getting pending grades:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get pending grades'
    });
  }
};

module.exports = {
  updateGradingSettings: exports.updateGradingSettings,
  getGradingSettings: exports.getGradingSettings,
  generateRubric: exports.generateRubric,
  getGradeByToken: exports.getGradeByToken,
  approveGrade: exports.approveGrade,
  rejectGrade: exports.rejectGrade,
  getPendingGrades: exports.getPendingGrades
};

