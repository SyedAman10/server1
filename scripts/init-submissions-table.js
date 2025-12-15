require('dotenv').config();
const db = require('../utils/db');

/**
 * Initialize assignment_submissions table
 */

async function initSubmissionsTable() {
  try {
    console.log('🔄 Creating assignment_submissions table...');

    // Create assignment_submissions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_text TEXT,
        attachments JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned', 'late')),
        grade INTEGER,
        feedback TEXT,
        submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Assignment submissions table created');

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id 
      ON assignment_submissions(assignment_id);
    `);
    console.log('✅ Index on submissions.assignment_id created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_student_id 
      ON assignment_submissions(student_id);
    `);
    console.log('✅ Index on submissions.student_id created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_status 
      ON assignment_submissions(status);
    `);
    console.log('✅ Index on submissions.status created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at 
      ON assignment_submissions(submitted_at DESC);
    `);
    console.log('✅ Index on submissions.submitted_at created');

    // Create unique constraint to prevent duplicate submissions
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_student_assignment 
      ON assignment_submissions(student_id, assignment_id);
    `);
    console.log('✅ Unique constraint on student/assignment created');

    console.log('');
    console.log('✅ Assignment submissions table created successfully!');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Restart your server: pm2 restart index');
    console.log('   2. Students can now submit assignments through AI!');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating submissions table:', error);
    process.exit(1);
  }
}

// Run the initialization
initSubmissionsTable();

