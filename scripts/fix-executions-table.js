const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function fixExecutionsTable() {
  try {
    console.log('🔧 Fixing automation_executions table...');
    
    // Check if created_at column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'automation_executions' AND column_name = 'created_at'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('   Adding created_at column...');
      await pool.query(`
        ALTER TABLE automation_executions 
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('   ✅ created_at column added');
    } else {
      console.log('   ✅ created_at column already exists');
    }
    
    // Check if updated_at column exists
    const checkUpdated = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'automation_executions' AND column_name = 'updated_at'
    `);
    
    if (checkUpdated.rows.length === 0) {
      console.log('   Adding updated_at column...');
      await pool.query(`
        ALTER TABLE automation_executions 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('   ✅ updated_at column added');
    } else {
      console.log('   ✅ updated_at column already exists');
    }
    
    console.log('\n✅ Table fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixExecutionsTable();

