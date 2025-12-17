const teacherAIPreferencesModel = require('../models/teacherAIPreferences.model');

/**
 * Teacher AI Preferences Controller
 * Handles HTTP requests for teacher's global AI settings
 */

// Get teacher's AI preferences
exports.getPreferences = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can access AI preferences'
      });
    }

    const preferences = await teacherAIPreferencesModel.getTeacherPreferences(teacherId);

    return res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Error getting teacher preferences:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get preferences'
    });
  }
};

// Update teacher's AI preferences
exports.updatePreferences = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can update AI preferences'
      });
    }

    const {
      aiGradingEnabled,
      defaultGradingMode,
      defaultAiInstructions,
      autoApplyToNewAssignments
    } = req.body;

    // Validate mode
    if (defaultGradingMode && !['manual', 'auto'].includes(defaultGradingMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grading mode. Must be "manual" or "auto"'
      });
    }

    const preferences = await teacherAIPreferencesModel.updateTeacherPreferences(teacherId, {
      aiGradingEnabled,
      defaultGradingMode,
      defaultAiInstructions,
      autoApplyToNewAssignments
    });

    return res.status(200).json({
      success: true,
      preferences,
      message: 'AI preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating teacher preferences:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update preferences'
    });
  }
};

// Apply default settings to all existing assignments
exports.applyToAllAssignments = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'teacher' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can apply settings'
      });
    }

    const preferences = await teacherAIPreferencesModel.getTeacherPreferences(teacherId);

    if (!preferences.ai_grading_enabled) {
      return res.status(400).json({
        success: false,
        message: 'AI grading must be enabled in your preferences first'
      });
    }

    // Get all assignments for this teacher
    const db = require('../utils/db');
    const assignmentsResult = await db.query(`
      SELECT a.id
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      WHERE c.teacher_id = $1
    `, [teacherId]);

    const assignments = assignmentsResult.rows;
    const aiGradingSettingsModel = require('../models/aiGradingSettings.model');

    let appliedCount = 0;
    let skippedCount = 0;

    for (const assignment of assignments) {
      try {
        await aiGradingSettingsModel.upsertGradingSettings({
          assignmentId: assignment.id,
          teacherId,
          enabled: true,
          mode: preferences.default_grading_mode,
          aiInstructions: preferences.default_ai_instructions,
          gradingCriteria: null,
          rubric: null,
          maxPoints: null
        });
        appliedCount++;
      } catch (err) {
        console.error(`Error applying settings to assignment ${assignment.id}:`, err);
        skippedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Applied AI grading settings to ${appliedCount} assignment(s)`,
      appliedCount,
      skippedCount,
      totalAssignments: assignments.length
    });
  } catch (error) {
    console.error('Error applying settings to assignments:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to apply settings'
    });
  }
};

module.exports = {
  getPreferences: exports.getPreferences,
  updatePreferences: exports.updatePreferences,
  applyToAllAssignments: exports.applyToAllAssignments
};

