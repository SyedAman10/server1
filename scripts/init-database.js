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
      
      // Add created_at if it doesn't exist
      if (!columns.includes('created_at')) {
        console.log('➕ Adding created_at column to courses table...');
        await pool.query(`ALTER TABLE courses ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
      }
      
      // Add updated_at if it doesn't exist
      if (!columns.includes('updated_at')) {
        console.log('➕ Adding updated_at column to courses table...');
        await pool.query(`ALTER TABLE courses ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
      }
      
      // If owner_id exists but teacher_id doesn't have values, sync them with type casting
      if (columns.includes('owner_id') && columns.includes('teacher_id')) {
        console.log('🔄 Syncing owner_id and teacher_id columns...');
        // Only sync if owner_id is numeric (can be cast to integer)
        await pool.query(`
          UPDATE courses 
          SET teacher_id = CAST(owner_id AS INTEGER) 
          WHERE teacher_id IS NULL 
          AND owner_id ~ '^[0-9]+$';
        `);
        await pool.query(`
          UPDATE courses 
          SET owner_id = CAST(teacher_id AS VARCHAR) 
          WHERE owner_id IS NULL;
        `);
        console.log('✅ Synced teacher_id and owner_id columns');
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
    
    // Check the data type of courses.id to match foreign keys
    const courseIdType = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'id';
    `);
    
    let courseIdDataType = 'INTEGER';
    if (courseIdType.rows.length > 0 && courseIdType.rows[0].data_type === 'character varying') {
      courseIdDataType = 'VARCHAR(255)';
      console.log('⚠️  Detected courses.id as VARCHAR, adapting foreign keys...');
    } else {
      console.log('✅ Detected courses.id as INTEGER');
    }
    
    // Check if course_enrollments table exists
    const checkEnrollmentsTable = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'course_enrollments';
    `);
    
    if (checkEnrollmentsTable.rows.length === 0) {
      // Create course_enrollments table with appropriate data type
      await pool.query(`
        CREATE TABLE course_enrollments (
          id SERIAL PRIMARY KEY,
          course_id ${courseIdDataType} REFERENCES courses(id) ON DELETE CASCADE,
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
    } else {
      console.log('✅ Course enrollments table already exists');
    }
    
    // Check if assignments table exists
    const checkAssignmentsTable = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assignments';
    `);
    
    if (checkAssignmentsTable.rows.length === 0) {
      // Create assignments table with appropriate data type
      await pool.query(`
        CREATE TABLE assignments (
          id SERIAL PRIMARY KEY,
          course_id ${courseIdDataType} REFERENCES courses(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          due_date TIMESTAMP,
          max_points INTEGER DEFAULT 100,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Assignments table created successfully');
    } else {
      console.log('✅ Assignments table already exists');
    }
    
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
    
    // Create invitations table with appropriate course_id type
    const checkInvitationsTable = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invitations';
    `);
    
    if (checkInvitationsTable.rows.length === 0) {
      await pool.query(`
        CREATE TABLE invitations (
          id SERIAL PRIMARY KEY,
          course_id ${courseIdDataType} REFERENCES courses(id) ON DELETE CASCADE,
          inviter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          invitee_email VARCHAR(255) NOT NULL,
          invitee_role VARCHAR(50) NOT NULL CHECK (invitee_role IN ('student', 'teacher')),
          token VARCHAR(255) UNIQUE NOT NULL,
          status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
          accepted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          accepted_at TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Invitations table created successfully');
      
      // Create indexes for invitations
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
        CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(invitee_email);
        CREATE INDEX IF NOT EXISTS idx_invitations_course_id ON invitations(course_id);
        CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
      `);
      console.log('✅ Invitations indexes created');
    } else {
      console.log('✅ Invitations table already exists');
    }
    
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

