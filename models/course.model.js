const db = require('../utils/db');

// Check if courses.id is VARCHAR or INTEGER (cache the result)
let courseIdType = null;

async function getCourseIdType() {
  if (courseIdType) return courseIdType;
  
  try {
    const result = await db.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'id';
    `);
    
    courseIdType = (result.rows[0]?.data_type === 'character varying') ? 'VARCHAR' : 'INTEGER';
    return courseIdType;
  } catch (error) {
    console.error('Error checking course ID type:', error);
    return 'INTEGER'; // Default to INTEGER
  }
}

// Generate a random course ID (for VARCHAR type)
function generateCourseId() {
  // Generate a random ID similar to Google Classroom format
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Create a new course
async function createCourse({ name, description = null, section = null, room = null, teacherId }) {
  const idType = await getCourseIdType();
  
  let query, values;
  
  if (idType === 'VARCHAR') {
    // If id is VARCHAR, we need to generate an ID
    const courseId = generateCourseId();
    query = `
      INSERT INTO courses (id, name, description, section, room, teacher_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    values = [courseId, name, description, section, room, teacherId];
  } else {
    // If id is INTEGER (SERIAL), let it auto-increment
    query = `
      INSERT INTO courses (name, description, section, room, teacher_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    values = [name, description, section, room, teacherId];
  }
  
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get all courses for a teacher
async function getCoursesByTeacher(teacherId) {
  const query = `
    SELECT c.*, 
      COUNT(DISTINCT ce.student_id) as student_count,
      u.name as teacher_name,
      u.email as teacher_email
    FROM courses c
    LEFT JOIN course_enrollments ce ON c.id = ce.course_id
    LEFT JOIN users u ON c.teacher_id = u.id
    WHERE c.teacher_id = $1
    GROUP BY c.id, u.name, u.email
    ORDER BY c.created_at DESC;
  `;
  const result = await db.query(query, [teacherId]);
  return result.rows;
}

// Get all courses for a student (enrolled courses)
async function getCoursesByStudent(studentId) {
  const query = `
    SELECT c.*, 
      u.name as teacher_name,
      u.email as teacher_email,
      ce.enrolled_at
    FROM courses c
    INNER JOIN course_enrollments ce ON c.id = ce.course_id
    LEFT JOIN users u ON c.teacher_id = u.id
    WHERE ce.student_id = $1
    ORDER BY c.created_at DESC;
  `;
  const result = await db.query(query, [studentId]);
  return result.rows;
}

// Get all courses (for super_admin)
async function getAllCourses() {
  const query = `
    SELECT c.*, 
      COUNT(DISTINCT ce.student_id) as student_count,
      u.name as teacher_name,
      u.email as teacher_email
    FROM courses c
    LEFT JOIN course_enrollments ce ON c.id = ce.course_id
    LEFT JOIN users u ON c.teacher_id = u.id
    GROUP BY c.id, u.name, u.email
    ORDER BY c.created_at DESC;
  `;
  const result = await db.query(query);
  return result.rows;
}

// Get a single course by ID
async function getCourseById(courseId) {
  const query = `
    SELECT c.*, 
      COUNT(DISTINCT ce.student_id) as student_count,
      u.name as teacher_name,
      u.email as teacher_email
    FROM courses c
    LEFT JOIN course_enrollments ce ON c.id = ce.course_id
    LEFT JOIN users u ON c.teacher_id = u.id
    WHERE c.id = $1
    GROUP BY c.id, u.name, u.email;
  `;
  const result = await db.query(query, [courseId]);
  return result.rows[0];
}

// Get course by name and teacher
async function getCourseByNameAndTeacher(name, teacherId) {
  const query = `
    SELECT * FROM courses 
    WHERE LOWER(name) = LOWER($1) AND teacher_id = $2
    LIMIT 1;
  `;
  const result = await db.query(query, [name, teacherId]);
  return result.rows[0];
}

// Update a course
async function updateCourse(courseId, updates) {
  const allowedUpdates = ['name', 'description', 'section', 'room'];
  const setClause = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedUpdates.includes(key)) {
      setClause.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClause.length === 0) {
    throw new Error('No valid fields to update');
  }

  setClause.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(courseId);

  const query = `
    UPDATE courses
    SET ${setClause.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *;
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

// Delete a course
async function deleteCourse(courseId) {
  const query = `DELETE FROM courses WHERE id = $1 RETURNING *;`;
  const result = await db.query(query, [courseId]);
  return result.rows[0];
}

// Enroll a student in a course
async function enrollStudent(courseId, studentId) {
  const query = `
    INSERT INTO course_enrollments (course_id, student_id)
    VALUES ($1, $2)
    ON CONFLICT (course_id, student_id) DO NOTHING
    RETURNING *;
  `;
  const result = await db.query(query, [courseId, studentId]);
  return result.rows[0];
}

// Unenroll a student from a course
async function unenrollStudent(courseId, studentId) {
  const query = `
    DELETE FROM course_enrollments 
    WHERE course_id = $1 AND student_id = $2
    RETURNING *;
  `;
  const result = await db.query(query, [courseId, studentId]);
  return result.rows[0];
}

// Get all students enrolled in a course
async function getEnrolledStudents(courseId) {
  const query = `
    SELECT u.id, u.email, u.name, u.picture, ce.enrolled_at
    FROM users u
    INNER JOIN course_enrollments ce ON u.id = ce.student_id
    WHERE ce.course_id = $1
    ORDER BY u.name;
  `;
  const result = await db.query(query, [courseId]);
  return result.rows;
}

// Check if a user is enrolled in a course
async function isStudentEnrolled(courseId, studentId) {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM course_enrollments 
      WHERE course_id = $1 AND student_id = $2
    ) as is_enrolled;
  `;
  const result = await db.query(query, [courseId, studentId]);
  return result.rows[0].is_enrolled;
}

module.exports = {
  createCourse,
  getCoursesByTeacher,
  getCoursesByStudent,
  getAllCourses,
  getCourseById,
  getCourseByNameAndTeacher,
  updateCourse,
  deleteCourse,
  enrollStudent,
  unenrollStudent,
  getEnrolledStudents,
  isStudentEnrolled
};

