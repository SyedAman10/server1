require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function cleanupAnnouncementsTable() {
  try {
    console.log('🧹 Cleaning up announcements table...');
    
    // Get current columns
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'announcements';
    `);
    
    const columns = columnsResult.rows.map(r => r.column_name);
    console.log('Current columns:', columns);
    
    // Old Google Classroom columns to remove
    const oldColumns = [
      'announcement_id',
      'text',
      'state',
      'alternate_link',
      'creation_time',
      'update_time',
      'scheduled_time',
      'assignee_mode',
      'creator_user_id',
      'individual_students_options_id'
    ];
    
    // Drop old columns
    for (const oldCol of oldColumns) {
      if (columns.includes(oldCol)) {
        console.log(`🗑️  Dropping old column: ${oldCol}`);
        await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS ${oldCol};`);
      }
    }
    
    console.log('✅ Announcements table cleaned up!');
    
    // Show final columns
    const finalResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'announcements'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Final columns:');
    finalResult.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanupAnnouncementsTable();

