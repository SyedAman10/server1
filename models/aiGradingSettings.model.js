const db = require('../utils/db');

/**
 * AI Grading Settings Model
 * Manages AI grading configuration for assignments
 */

// Create or update AI grading settings for an assignment
async function upsertGradingSettings({ 
  assignmentId, 
  teacherId, 
  enabled, 
  mode, 
  gradingCriteria, 
  criteriaFileUrl, 
  rubric, 
  maxPoints,
  aiInstructions 
}) {
  const query = `
    INSERT INTO ai_grading_settings (
      assignment_id, 
      teacher_id, 
      enabled, 
      mode, 
      grading_criteria, 
      criteria_file_url, 
      rubric, 
      max_points,
      ai_instructions,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    ON CONFLICT (assignment_id) 
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      mode = EXCLUDED.mode,
      grading_criteria = EXCLUDED.grading_criteria,
      criteria_file_url = EXCLUDED.criteria_file_url,
      rubric = EXCLUDED.rubric,
      max_points = EXCLUDED.max_points,
      ai_instructions = EXCLUDED.ai_instructions,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  
  const rubricJson = rubric ? JSON.stringify(rubric) : null;
  
  const values = [
    assignmentId,
    teacherId,
    enabled !== undefined ? enabled : false,
    mode || 'manual',
    gradingCriteria || null,
    criteriaFileUrl || null,
    rubricJson,
    maxPoints || null,
    aiInstructions || null
  ];
  
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get AI grading settings for an assignment
async function getGradingSettings(assignmentId) {
  const query = `
    SELECT * FROM ai_grading_settings 
    WHERE assignment_id = $1;
  `;
  const result = await db.query(query, [assignmentId]);
  
  if (result.rows[0] && result.rows[0].rubric) {
    result.rows[0].rubric = typeof result.rows[0].rubric === 'string' 
      ? JSON.parse(result.rows[0].rubric) 
      : result.rows[0].rubric;
  }
  
  return result.rows[0];
}

// Check if AI grading is enabled for an assignment
async function isAIGradingEnabled(assignmentId) {
  const query = `
    SELECT enabled, mode FROM ai_grading_settings 
    WHERE assignment_id = $1;
  `;
  const result = await db.query(query, [assignmentId]);
  return result.rows[0] || { enabled: false, mode: null };
}

// Disable AI grading for an assignment
async function disableAIGrading(assignmentId) {
  const query = `
    UPDATE ai_grading_settings 
    SET enabled = false, updated_at = CURRENT_TIMESTAMP 
    WHERE assignment_id = $1
    RETURNING *;
  `;
  const result = await db.query(query, [assignmentId]);
  return result.rows[0];
}

// Get all assignments with AI grading enabled for a teacher
async function getTeacherAIGradingAssignments(teacherId) {
  const query = `
    SELECT 
      ags.*,
      a.title as assignment_title,
      a.course_id,
      c.name as course_name
    FROM ai_grading_settings ags
    LEFT JOIN assignments a ON ags.assignment_id = a.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE ags.teacher_id = $1 AND ags.enabled = true
    ORDER BY ags.updated_at DESC;
  `;
  const result = await db.query(query, [teacherId]);
  return result.rows;
}

module.exports = {
  upsertGradingSettings,
  getGradingSettings,
  isAIGradingEnabled,
  disableAIGrading,
  getTeacherAIGradingAssignments
};

