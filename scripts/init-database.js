const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDatabase() {
  try {
    console.log('🚀 Starting database initialization...');
    
    // Create users table with roles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        picture VARCHAR(500),
        role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'super_admin')),
        access_token TEXT,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created successfully');
    
    // Create index on email for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('✅ Users email index created');
    
    // Create courses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        section VARCHAR(100),
        room VARCHAR(100),
        teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Courses table created successfully');
    
    // Create index on teacher_id
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id);
    `);
    console.log('✅ Courses teacher_id index created');
    
    // Create course_enrollments table for student-course relationships
    await pool.query(`
      CREATE TABLE IF NOT EXISTS course_enrollments (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(course_id, student_id)
      );
    `);
    console.log('✅ Course enrollments table created successfully');
    
    // Create indexes for course_enrollments
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON course_enrollments(course_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON course_enrollments(student_id);
    `);
    console.log('✅ Course enrollments indexes created');
    
    // Create assignments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date TIMESTAMP,
        max_points INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Assignments table created successfully');
    
    // Create index on course_id for assignments
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
    `);
    console.log('✅ Assignments course_id index created');
    
    // Create assignment_submissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        grade INTEGER,
        feedback TEXT,
        UNIQUE(assignment_id, student_id)
      );
    `);
    console.log('✅ Assignment submissions table created successfully');
    
    // Create indexes for assignment_submissions
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON assignment_submissions(assignment_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON assignment_submissions(student_id);
    `);
    console.log('✅ Assignment submissions indexes created');
    
    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the initialization
initDatabase();

