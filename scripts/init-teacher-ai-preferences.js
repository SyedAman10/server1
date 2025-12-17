require('dotenv').config();
const db = require('../utils/db');

async function initTeacherAIPreferences() {
  console.log('\n🤖 Creating teacher AI preferences table...\n');
  
  try {
    // Table for global teacher preferences
    await db.query(`
      CREATE TABLE IF NOT EXISTS teacher_ai_preferences (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        
        -- Global AI Grading Settings
        ai_grading_enabled BOOLEAN DEFAULT false,
        default_grading_mode VARCHAR(20) DEFAULT 'manual', -- 'manual' or 'auto'
        default_ai_instructions TEXT,
        
        -- Apply to new assignments automatically?
        auto_apply_to_new_assignments BOOLEAN DEFAULT false,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(teacher_id)
      );
    `);
    console.log('✅ teacher_ai_preferences table created');

    // Index for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_teacher_ai_preferences_teacher 
      ON teacher_ai_preferences(teacher_id);
    `);
    console.log('✅ Index on teacher_ai_preferences.teacher_id created');

    // Add a column to ai_grading_settings to track if it's using defaults
    await db.query(`
      ALTER TABLE ai_grading_settings 
      ADD COLUMN IF NOT EXISTS uses_teacher_defaults BOOLEAN DEFAULT true;
    `);
    console.log('✅ Added uses_teacher_defaults column to ai_grading_settings');

    console.log('\n✅ Teacher AI preferences table created successfully!\n');

  } catch (error) {
    console.error('❌ Error creating teacher AI preferences table:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

initTeacherAIPreferences();

