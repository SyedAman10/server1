const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function removeEmailUniqueConstraint() {
  try {
    console.log('🚀 Starting to modify users table...');
    
    const client = await pool.connect();
    
    // 1. Drop the unique constraint on email
    console.log('🗑️  Dropping UNIQUE constraint on email...');
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
    `);
    console.log('✅ Email unique constraint removed');
    
    // 2. Add composite unique constraint on (email, role)
    console.log('➕ Adding UNIQUE constraint on (email, role)...');
    await client.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_email_role_key UNIQUE (email, role);
    `);
    console.log('✅ Composite unique constraint (email, role) added');
    
    // 3. Create index for faster lookups
    console.log('📇 Creating index on (email, role)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email_role ON users(email, role);
    `);
    console.log('✅ Index created');
    
    client.release();
    console.log('🎉 Users table updated successfully!');
    console.log('');
    console.log('✅ Now users can have multiple accounts with the same email but different roles.');
    
  } catch (error) {
    console.error('❌ Error modifying users table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

removeEmailUniqueConstraint();

