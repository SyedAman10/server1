require('dotenv').config();
const db = require('../utils/db');

async function initAIGradingTables() {
  console.log('\n🤖 Creating AI Grading tables...\n');
  
  try {
    // Table 1: AI Grading Settings (per assignment)
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_grading_settings (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
        teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        enabled BOOLEAN DEFAULT false,
        mode VARCHAR(20) DEFAULT 'manual', -- 'manual' or 'auto'
        grading_criteria TEXT, -- Extracted criteria from assignment
        criteria_file_url TEXT, -- URL of the file containing criteria
        rubric JSONB, -- Structured grading rubric
        max_points INTEGER,
        ai_instructions TEXT, -- Custom instructions for AI grader
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assignment_id)
      );
    `);
    console.log('✅ ai_grading_settings table created');

    // Table 2: AI Grades (stores AI-generated grades)
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_grades (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES assignment_submissions(id) ON DELETE CASCADE,
        assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        proposed_grade DECIMAL(5,2),
        proposed_feedback TEXT,
        ai_analysis JSONB, -- Detailed AI analysis
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'auto_applied'
        approval_token VARCHAR(255) UNIQUE, -- Token for approve/reject links
        approved_at TIMESTAMP,
        approved_by INTEGER REFERENCES users(id),
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(submission_id)
      );
    `);
    console.log('✅ ai_grades table created');

    // Indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_grading_settings_assignment 
      ON ai_grading_settings(assignment_id);
    `);
    console.log('✅ Index on ai_grading_settings.assignment_id created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_grading_settings_teacher 
      ON ai_grading_settings(teacher_id);
    `);
    console.log('✅ Index on ai_grading_settings.teacher_id created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_grades_submission 
      ON ai_grades(submission_id);
    `);
    console.log('✅ Index on ai_grades.submission_id created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_grades_status 
      ON ai_grades(status);
    `);
    console.log('✅ Index on ai_grades.status created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_grades_token 
      ON ai_grades(approval_token);
    `);
    console.log('✅ Index on ai_grades.approval_token created');

    console.log('\n✅ All AI grading tables and indexes created successfully!\n');

  } catch (error) {
    console.error('❌ Error creating AI grading tables:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

initAIGradingTables();

