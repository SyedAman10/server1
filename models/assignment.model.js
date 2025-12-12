const db = require('../utils/db');

// Create an assignment with optional attachments
async function createAssignment({ courseId, teacherId, title, description, dueDate, maxPoints, attachments }) {
  const query = `
    INSERT INTO assignments (course_id, teacher_id, title, description, due_date, max_points, attachments)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  // Attachments should be an array of objects: [{originalName, filename, url, size, mimetype}]
  const attachmentsJson = attachments && attachments.length > 0 ? JSON.stringify(attachments) : '[]';
  const values = [courseId, teacherId, title, description, dueDate, maxPoints || 100, attachmentsJson];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get all assignments for a course
async function getAssignmentsByCourse(courseId) {
  const query = `
    SELECT a.*, 
      u.name as teacher_name,
      u.email as teacher_email,
      c.name as course_name
    FROM assignments a
    LEFT JOIN users u ON a.teacher_id = u.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE a.course_id = $1
    ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC;
  `;
  const result = await db.query(query, [courseId]);
  return result.rows;
}

// Get a single assignment by ID
async function getAssignmentById(assignmentId) {
  const query = `
    SELECT a.*, 
      u.name as teacher_name,
      u.email as teacher_email,
      c.name as course_name,
      c.id as course_id
    FROM assignments a
    LEFT JOIN users u ON a.teacher_id = u.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE a.id = $1;
  `;
  const result = await db.query(query, [assignmentId]);
  return result.rows[0];
}

// Update an assignment
async function updateAssignment(assignmentId, { title, description, dueDate, maxPoints, attachments }) {
  // If attachments are provided, update them; otherwise keep existing
  let query;
  let values;
  
  if (attachments !== undefined) {
    query = `
      UPDATE assignments
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          due_date = COALESCE($3, due_date),
          max_points = COALESCE($4, max_points),
          attachments = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;
    const attachmentsJson = JSON.stringify(attachments);
    values = [title, description, dueDate, maxPoints, attachmentsJson, assignmentId];
  } else {
    query = `
      UPDATE assignments
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          due_date = COALESCE($3, due_date),
          max_points = COALESCE($4, max_points),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `;
    values = [title, description, dueDate, maxPoints, assignmentId];
  }
  
  const result = await db.query(query, values);
  return result.rows[0];
}

// Add attachments to an existing assignment
async function addAttachments(assignmentId, newAttachments) {
  // First get current attachments
  const currentResult = await db.query(
    'SELECT attachments FROM assignments WHERE id = $1',
    [assignmentId]
  );
  
  if (currentResult.rows.length === 0) {
    throw new Error('Assignment not found');
  }
  
  // Get current attachments (could be null, string, or already parsed)
  let currentAttachments = currentResult.rows[0].attachments || [];
  if (typeof currentAttachments === 'string') {
    currentAttachments = JSON.parse(currentAttachments);
  }
  
  // Append new attachments
  const updatedAttachments = [...currentAttachments, ...newAttachments];
  
  const query = `
    UPDATE assignments
    SET attachments = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  
  const result = await db.query(query, [JSON.stringify(updatedAttachments), assignmentId]);
  return result.rows[0];
}

// Remove an attachment from an assignment
async function removeAttachment(assignmentId, attachmentFilename) {
  // Get current attachments
  const currentResult = await db.query(
    'SELECT attachments FROM assignments WHERE id = $1',
    [assignmentId]
  );
  
  if (currentResult.rows.length === 0) {
    throw new Error('Assignment not found');
  }
  
  let currentAttachments = currentResult.rows[0].attachments || [];
  if (typeof currentAttachments === 'string') {
    currentAttachments = JSON.parse(currentAttachments);
  }
  
  // Filter out the attachment to remove
  const updatedAttachments = currentAttachments.filter(
    att => att.filename !== attachmentFilename
  );
  
  const query = `
    UPDATE assignments
    SET attachments = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  
  const result = await db.query(query, [JSON.stringify(updatedAttachments), assignmentId]);
  return result.rows[0];
}

// Delete an assignment
async function deleteAssignment(assignmentId) {
  const query = `DELETE FROM assignments WHERE id = $1 RETURNING *;`;
  const result = await db.query(query, [assignmentId]);
  return result.rows[0];
}

// Get assignments by teacher
async function getAssignmentsByTeacher(teacherId) {
  const query = `
    SELECT a.*, 
      c.name as course_name
    FROM assignments a
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE a.teacher_id = $1
    ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC;
  `;
  const result = await db.query(query, [teacherId]);
  return result.rows;
}

// Get upcoming assignments (due within next N days)
async function getUpcomingAssignments(days = 7) {
  const query = `
    SELECT a.*, 
      u.name as teacher_name,
      u.email as teacher_email,
      c.name as course_name
    FROM assignments a
    LEFT JOIN users u ON a.teacher_id = u.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE a.due_date IS NOT NULL 
      AND a.due_date >= CURRENT_TIMESTAMP 
      AND a.due_date <= CURRENT_TIMESTAMP + INTERVAL '${days} days'
    ORDER BY a.due_date ASC;
  `;
  const result = await db.query(query);
  return result.rows;
}

module.exports = {
  createAssignment,
  getAssignmentsByCourse,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getAssignmentsByTeacher,
  getUpcomingAssignments,
  addAttachments,
  removeAttachment
};

