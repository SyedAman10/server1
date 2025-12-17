const db = require('../utils/db');

/**
 * Assignment Submission Model
 * Handles database operations for student assignment submissions
 */

// Create a submission
async function createSubmission({ assignmentId, studentId, submissionText, attachments, status }) {
  const query = `
    INSERT INTO assignment_submissions (
      assignment_id, 
      student_id, 
      submission_text, 
      attachments, 
      status,
      submitted_at
    )
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const attachmentsJson = attachments && attachments.length > 0 ? JSON.stringify(attachments) : '[]';
  const values = [assignmentId, studentId, submissionText, attachmentsJson, status || 'submitted'];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get submission by student and assignment
async function getSubmissionByStudentAndAssignment(studentId, assignmentId) {
  const query = `
    SELECT s.*,
      a.title as assignment_title,
      a.course_id,
      c.name as course_name
    FROM assignment_submissions s
    LEFT JOIN assignments a ON s.assignment_id = a.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE s.student_id = $1 AND s.assignment_id = $2
    ORDER BY s.submitted_at DESC
    LIMIT 1;
  `;
  const result = await db.query(query, [studentId, assignmentId]);
  const submission = result.rows[0];
  
  if (submission) {
    // Parse attachments JSON
    submission.attachments = submission.attachments ? 
      (typeof submission.attachments === 'string' ? JSON.parse(submission.attachments) : submission.attachments) : [];
  }
  
  return submission;
}

// Get all submissions by student
async function getSubmissionsByStudent(studentId) {
  const query = `
    SELECT s.*,
      a.title as assignment_title,
      a.due_date,
      a.max_points,
      c.name as course_name,
      c.id as course_id
    FROM assignment_submissions s
    LEFT JOIN assignments a ON s.assignment_id = a.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE s.student_id = $1
    ORDER BY s.submitted_at DESC;
  `;
  const result = await db.query(query, [studentId]);
  
  // Parse attachments JSON for each submission
  return result.rows.map(submission => ({
    ...submission,
    attachments: submission.attachments ? 
      (typeof submission.attachments === 'string' ? JSON.parse(submission.attachments) : submission.attachments) : []
  }));
}

// Get all submissions for an assignment (for teachers)
async function getSubmissionsByAssignment(assignmentId) {
  const query = `
    SELECT s.*,
      u.name as student_name,
      u.email as student_email,
      u.id as student_id
    FROM assignment_submissions s
    LEFT JOIN users u ON s.student_id = u.id
    WHERE s.assignment_id = $1
    ORDER BY s.submitted_at DESC;
  `;
  const result = await db.query(query, [assignmentId]);
  
  // Parse attachments JSON for each submission
  return result.rows.map(submission => ({
    ...submission,
    attachments: submission.attachments ? 
      (typeof submission.attachments === 'string' ? JSON.parse(submission.attachments) : submission.attachments) : []
  }));
}

// Update submission
async function updateSubmission(submissionId, { submissionText, attachments, status }) {
  let query;
  let values;
  
  if (attachments !== undefined) {
    query = `
      UPDATE assignment_submissions
      SET submission_text = COALESCE($1, submission_text),
          attachments = $2,
          status = COALESCE($3, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `;
    const attachmentsJson = JSON.stringify(attachments);
    values = [submissionText, attachmentsJson, status, submissionId];
  } else {
    query = `
      UPDATE assignment_submissions
      SET submission_text = COALESCE($1, submission_text),
          status = COALESCE($2, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    values = [submissionText, status, submissionId];
  }
  
  const result = await db.query(query, values);
  return result.rows[0];
}

// Delete submission
async function deleteSubmission(submissionId) {
  const query = `
    DELETE FROM assignment_submissions
    WHERE id = $1
    RETURNING *;
  `;
  const result = await db.query(query, [submissionId]);
  return result.rows[0];
}

// Check if student has already submitted
async function hasStudentSubmitted(studentId, assignmentId) {
  const query = `
    SELECT COUNT(*) as count
    FROM assignment_submissions
    WHERE student_id = $1 AND assignment_id = $2;
  `;
  const result = await db.query(query, [studentId, assignmentId]);
  return parseInt(result.rows[0].count) > 0;
}

// Get submission by ID
async function getSubmissionById(submissionId) {
  const query = `
    SELECT s.*,
      u.name as student_name,
      u.email as student_email,
      a.title as assignment_title,
      a.course_id,
      a.max_points,
      c.name as course_name
    FROM assignment_submissions s
    LEFT JOIN users u ON s.student_id = u.id
    LEFT JOIN assignments a ON s.assignment_id = a.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE s.id = $1;
  `;
  const result = await db.query(query, [submissionId]);
  const submission = result.rows[0];
  
  if (submission) {
    // Parse attachments JSON
    submission.attachments = submission.attachments ? 
      (typeof submission.attachments === 'string' ? JSON.parse(submission.attachments) : submission.attachments) : [];
  }
  
  return submission;
}

module.exports = {
  createSubmission,
  getSubmissionByStudentAndAssignment,
  getSubmissionsByStudent,
  getSubmissionsByAssignment,
  getSubmissionById,
  updateSubmission,
  deleteSubmission,
  hasStudentSubmitted
};

