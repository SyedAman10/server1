const db = require('../utils/db');

/**
 * Teacher AI Preferences Model
 * Manages global AI settings for teachers
 */

// Get or create teacher's AI preferences
async function getTeacherPreferences(teacherId) {
  const query = `
    SELECT * FROM teacher_ai_preferences 
    WHERE teacher_id = $1;
  `;
  const result = await db.query(query, [teacherId]);
  
  if (result.rows.length === 0) {
    // Create default preferences
    return await createDefaultPreferences(teacherId);
  }
  
  return result.rows[0];
}

// Create default preferences for a teacher
async function createDefaultPreferences(teacherId) {
  const query = `
    INSERT INTO teacher_ai_preferences (
      teacher_id,
      ai_grading_enabled,
      default_grading_mode,
      auto_apply_to_new_assignments
    )
    VALUES ($1, false, 'manual', false)
    RETURNING *;
  `;
  const result = await db.query(query, [teacherId]);
  return result.rows[0];
}

// Update teacher's AI preferences
async function updateTeacherPreferences(teacherId, preferences) {
  const {
    aiGradingEnabled,
    defaultGradingMode,
    defaultAiInstructions,
    autoApplyToNewAssignments
  } = preferences;

  const query = `
    INSERT INTO teacher_ai_preferences (
      teacher_id,
      ai_grading_enabled,
      default_grading_mode,
      default_ai_instructions,
      auto_apply_to_new_assignments,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    ON CONFLICT (teacher_id) 
    DO UPDATE SET
      ai_grading_enabled = EXCLUDED.ai_grading_enabled,
      default_grading_mode = EXCLUDED.default_grading_mode,
      default_ai_instructions = EXCLUDED.default_ai_instructions,
      auto_apply_to_new_assignments = EXCLUDED.auto_apply_to_new_assignments,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [
    teacherId,
    aiGradingEnabled !== undefined ? aiGradingEnabled : false,
    defaultGradingMode || 'manual',
    defaultAiInstructions || null,
    autoApplyToNewAssignments !== undefined ? autoApplyToNewAssignments : false
  ];

  const result = await db.query(query, values);
  return result.rows[0];
}

// Apply teacher's default settings to a new assignment
async function applyDefaultsToAssignment(teacherId, assignmentId) {
  const preferences = await getTeacherPreferences(teacherId);
  
  if (!preferences.ai_grading_enabled || !preferences.auto_apply_to_new_assignments) {
    return null; // Don't apply if not enabled or auto-apply is off
  }

  const aiGradingSettingsModel = require('./aiGradingSettings.model');
  
  return await aiGradingSettingsModel.upsertGradingSettings({
    assignmentId,
    teacherId,
    enabled: true,
    mode: preferences.default_grading_mode,
    aiInstructions: preferences.default_ai_instructions,
    gradingCriteria: null,
    rubric: null,
    maxPoints: null
  });
}

// Check if teacher has AI grading enabled globally
async function hasAIGradingEnabled(teacherId) {
  const preferences = await getTeacherPreferences(teacherId);
  return preferences.ai_grading_enabled;
}

module.exports = {
  getTeacherPreferences,
  createDefaultPreferences,
  updateTeacherPreferences,
  applyDefaultsToAssignment,
  hasAIGradingEnabled
};

