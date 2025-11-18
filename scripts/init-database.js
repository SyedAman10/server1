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
    
    // Check if users table exists and has the correct structure
    const checkUsersTable = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    
    if (checkUsersTable.rows.length > 0) {
      console.log('⚠️  Users table already exists. Checking structure...');
      const columns = checkUsersTable.rows.map(row => row.column_name);
      
      // Add missing columns if needed
      if (!columns.includes('password')) {
        console.log('➕ Adding password column to users table...');
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT 'changeme';`);
      }
      
      if (!columns.includes('role')) {
        console.log('➕ Adding role column to users table...');
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'student';`);
        await pool.query(`ALTER TABLE users ADD CONSTRAINT check_role CHECK (role IN ('student', 'teacher', 'super_admin'));`);
      }
      
      console.log('✅ Users table structure verified');
    } else {
      // Create users table with roles
      await pool.query(`
        CREATE TABLE users (
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
    }
    
    // Create index on email for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('✅ Users email index created');
    
    // Check if courses table exists
    const checkCoursesTable = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses';
    `);
    
    if (checkCoursesTable.rows.length > 0) {
      console.log('⚠️  Courses table already exists. Checking structure...');
      const columns = checkCoursesTable.rows.map(row => row.column_name);
      
      // Add teacher_id if it doesn't exist
      if (!columns.includes('teacher_id')) {
        console.log('➕ Adding teacher_id column to courses table...');
        await pool.query(`ALTER TABLE courses ADD COLUMN teacher_id INTEGER;`);
        await pool.query(`ALTER TABLE courses ADD CONSTRAINT fk_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;`);
      }
      
      console.log('✅ Courses table structure verified');
    } else {
      // Create courses table
      await pool.query(`
        CREATE TABLE courses (
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
    }
    
    // Create index on teacher_id only if the column exists
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

