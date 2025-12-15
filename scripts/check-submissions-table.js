require('dotenv').config();
const db = require('../utils/db');

/**
 * Check assignment_submissions table schema
 */

async function checkSubmissionsTable() {
  try {
    console.log('🔍 Checking assignment_submissions table...');
    
    // Check if table exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'assignment_submissions'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Table does not exist!');
      console.log('');
      console.log('Run: node scripts/fix-submissions-table.js');
      process.exit(1);
    }
    
    console.log('✅ Table exists');
    console.log('');
    
    // Get all columns
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'assignment_submissions'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Current columns:');
    console.log('');
    columns.rows.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    console.log('');
    
    // Check for required columns
    const requiredColumns = [
      'id',
      'assignment_id',
      'student_id',
      'submission_text',
      'attachments',
      'status',
      'grade',
      'feedback',
      'submitted_at',
      'updated_at'
    ];
    
    const existingColumns = columns.rows.map(col => col.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('❌ Missing columns:');
      missingColumns.forEach(col => {
        console.log(`  • ${col}`);
      });
      console.log('');
      console.log('🔧 To fix, run: node scripts/fix-submissions-table.js');
    } else {
      console.log('✅ All required columns present!');
    }
    
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking table:', error);
    process.exit(1);
  }
}

// Run the check
checkSubmissionsTable();

