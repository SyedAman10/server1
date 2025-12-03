require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function addAssignmentAttachments() {
  try {
    console.log('🔧 Adding attachments column to assignments table...');
    
    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assignments' AND column_name = 'attachments';
    `);
    
    if (checkColumn.rows.length === 0) {
      // Add attachments column as JSONB to store array of attachment objects
      await pool.query(`
        ALTER TABLE assignments 
        ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
      `);
      console.log('✅ Added attachments column to assignments table');
    } else {
      console.log('ℹ️  Attachments column already exists');
    }
    
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addAssignmentAttachments();

