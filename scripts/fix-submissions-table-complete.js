require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixSubmissionsTable() {
  try {
    console.log('🔧 Fixing assignment_submissions table...\n');
    
    // Add submission_text column
    const checkSubmissionText = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assignment_submissions' AND column_name = 'submission_text';
    `);
    
    if (checkSubmissionText.rows.length === 0) {
      await pool.query(`
        ALTER TABLE assignment_submissions 
        ADD COLUMN submission_text TEXT;
      `);
      console.log('✅ Added submission_text column');
    } else {
      console.log('ℹ️  submission_text column exists');
    }
    
    // Add attachments column
    const checkAttachments = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assignment_submissions' AND column_name = 'attachments';
    `);
    
    if (checkAttachments.rows.length === 0) {
      await pool.query(`
        ALTER TABLE assignment_submissions 
        ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
      `);
      console.log('✅ Added attachments column');
    } else {
      console.log('ℹ️  attachments column exists');
    }
    
    // Add status column
    const checkStatus = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assignment_submissions' AND column_name = 'status';
    `);
    
    if (checkStatus.rows.length === 0) {
      await pool.query(`
        ALTER TABLE assignment_submissions 
        ADD COLUMN status VARCHAR(50) DEFAULT 'submitted';
      `);
      console.log('✅ Added status column');
    } else {
      console.log('ℹ️  status column exists');
    }
    
    // Add grade column
    const checkGrade = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assignment_submissions' AND column_name = 'grade';
    `);
    
    if (checkGrade.rows.length === 0) {
      await pool.query(`
        ALTER TABLE assignment_submissions 
        ADD COLUMN grade INTEGER;
      `);
      console.log('✅ Added grade column');
    } else {
      console.log('ℹ️  grade column exists');
    }
    
    // Add feedback column
    const checkFeedback = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assignment_submissions' AND column_name = 'feedback';
    `);
    
    if (checkFeedback.rows.length === 0) {
      await pool.query(`
        ALTER TABLE assignment_submissions 
        ADD COLUMN feedback TEXT;
      `);
      console.log('✅ Added feedback column');
    } else {
      console.log('ℹ️  feedback column exists');
    }
    
    console.log('\n✅ All migrations complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixSubmissionsTable();

