const db = require('../utils/db');

// Create an assignment
async function createAssignment({ courseId, teacherId, title, description, dueDate, maxPoints }) {
  const query = `
    INSERT INTO assignments (course_id, teacher_id, title, description, due_date, max_points)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [courseId, teacherId, title, description, dueDate, maxPoints || 100];
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
async function updateAssignment(assignmentId, { title, description, dueDate, maxPoints }) {
  const query = `
    UPDATE assignments
    SET title = COALESCE($1, title),
        description = COALESCE($2, description),
        due_date = COALESCE($3, due_date),
        max_points = COALESCE($4, max_points),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *;
  `;
  const result = await db.query(query, [title, description, dueDate, maxPoints, assignmentId]);
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
  getUpcomingAssignments
};

