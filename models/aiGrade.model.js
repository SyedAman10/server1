const db = require('../utils/db');
const crypto = require('crypto');

/**
 * AI Grade Model
 * Manages AI-generated grades for submissions
 */

// Create an AI grade for a submission
async function createAIGrade({ 
  submissionId, 
  assignmentId, 
  studentId, 
  teacherId,
  proposedGrade, 
  proposedFeedback, 
  aiAnalysis,
  status 
}) {
  // Generate unique approval token
  const approvalToken = crypto.randomBytes(32).toString('hex');
  
  const query = `
    INSERT INTO ai_grades (
      submission_id,
      assignment_id,
      student_id,
      teacher_id,
      proposed_grade,
      proposed_feedback,
      ai_analysis,
      status,
      approval_token
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (submission_id)
    DO UPDATE SET
      proposed_grade = EXCLUDED.proposed_grade,
      proposed_feedback = EXCLUDED.proposed_feedback,
      ai_analysis = EXCLUDED.ai_analysis,
      status = EXCLUDED.status,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  
  const aiAnalysisJson = aiAnalysis ? JSON.stringify(aiAnalysis) : null;
  
  const values = [
    submissionId,
    assignmentId,
    studentId,
    teacherId,
    proposedGrade,
    proposedFeedback,
    aiAnalysisJson,
    status || 'pending',
    approvalToken
  ];
  
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get AI grade by submission ID
async function getAIGradeBySubmission(submissionId) {
  const query = `
    SELECT 
      ag.*,
      s.submission_text,
      s.attachments as submission_attachments,
      u.name as student_name,
      u.email as student_email,
      a.title as assignment_title,
      a.max_points as assignment_max_points
    FROM ai_grades ag
    LEFT JOIN assignment_submissions s ON ag.submission_id = s.id
    LEFT JOIN users u ON ag.student_id = u.id
    LEFT JOIN assignments a ON ag.assignment_id = a.id
    WHERE ag.submission_id = $1;
  `;
  const result = await db.query(query, [submissionId]);
  
  if (result.rows[0] && result.rows[0].ai_analysis) {
    result.rows[0].ai_analysis = typeof result.rows[0].ai_analysis === 'string' 
      ? JSON.parse(result.rows[0].ai_analysis) 
      : result.rows[0].ai_analysis;
  }
  
  return result.rows[0];
}

// Get AI grade by approval token
async function getAIGradeByToken(approvalToken) {
  const query = `
    SELECT 
      ag.*,
      s.submission_text,
      s.attachments as submission_attachments,
      u.name as student_name,
      u.email as student_email,
      a.title as assignment_title,
      a.max_points as assignment_max_points,
      a.course_id,
      c.name as course_name
    FROM ai_grades ag
    LEFT JOIN assignment_submissions s ON ag.submission_id = s.id
    LEFT JOIN users u ON ag.student_id = u.id
    LEFT JOIN assignments a ON ag.assignment_id = a.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE ag.approval_token = $1;
  `;
  const result = await db.query(query, [approvalToken]);
  
  if (result.rows[0] && result.rows[0].ai_analysis) {
    result.rows[0].ai_analysis = typeof result.rows[0].ai_analysis === 'string' 
      ? JSON.parse(result.rows[0].ai_analysis) 
      : result.rows[0].ai_analysis;
  }
  
  return result.rows[0];
}

// Approve AI grade
async function approveAIGrade(approvalToken, approvedBy) {
  const query = `
    UPDATE ai_grades 
    SET 
      status = 'approved',
      approved_at = CURRENT_TIMESTAMP,
      approved_by = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE approval_token = $1
    RETURNING *;
  `;
  const result = await db.query(query, [approvalToken, approvedBy]);
  return result.rows[0];
}

// Reject AI grade
async function rejectAIGrade(approvalToken, rejectionReason, rejectedBy) {
  const query = `
    UPDATE ai_grades 
    SET 
      status = 'rejected',
      rejection_reason = $2,
      approved_by = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE approval_token = $1
    RETURNING *;
  `;
  const result = await db.query(query, [approvalToken, rejectionReason, rejectedBy]);
  return result.rows[0];
}

// Get pending AI grades for a teacher
async function getPendingGradesForTeacher(teacherId) {
  const query = `
    SELECT 
      ag.*,
      s.submission_text,
      s.submitted_at,
      u.name as student_name,
      u.email as student_email,
      a.title as assignment_title,
      a.max_points as assignment_max_points,
      c.name as course_name
    FROM ai_grades ag
    LEFT JOIN assignment_submissions s ON ag.submission_id = s.id
    LEFT JOIN users u ON ag.student_id = u.id
    LEFT JOIN assignments a ON ag.assignment_id = a.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE ag.teacher_id = $1 AND ag.status = 'pending'
    ORDER BY ag.created_at DESC;
  `;
  const result = await db.query(query, [teacherId]);
  return result.rows;
}

// Get all AI grades for an assignment
async function getAIGradesForAssignment(assignmentId) {
  const query = `
    SELECT 
      ag.*,
      u.name as student_name,
      u.email as student_email
    FROM ai_grades ag
    LEFT JOIN users u ON ag.student_id = u.id
    WHERE ag.assignment_id = $1
    ORDER BY ag.created_at DESC;
  `;
  const result = await db.query(query, [assignmentId]);
  return result.rows;
}

module.exports = {
  createAIGrade,
  getAIGradeBySubmission,
  getAIGradeByToken,
  approveAIGrade,
  rejectAIGrade,
  getPendingGradesForTeacher,
  getAIGradesForAssignment
};

