require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateAssignmentsTable() {
  try {
    console.log('🔧 Migrating assignments table...\n');
    
    // Add attachments column
    const checkAttachments = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assignments' AND column_name = 'attachments';
    `);
    
    if (checkAttachments.rows.length === 0) {
      await pool.query(`
        ALTER TABLE assignments 
        ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
      `);
      console.log('✅ Added attachments column');
    } else {
      console.log('ℹ️  attachments column exists');
    }
    
    // Add status column
    const checkStatus = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assignments' AND column_name = 'status';
    `);
    
    if (checkStatus.rows.length === 0) {
      await pool.query(`
        ALTER TABLE assignments 
        ADD COLUMN status VARCHAR(50) DEFAULT 'published';
      `);
      console.log('✅ Added status column');
    } else {
      console.log('ℹ️  status column exists');
    }
    
    console.log('\n✅ All migrations complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

migrateAssignmentsTable();

