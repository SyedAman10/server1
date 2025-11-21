require('dotenv').config();
const db = require('../utils/db');

async function addRecipientListsTable() {
  console.log('🔧 Creating recipient_lists table...\n');

  try {
    // Create recipient_lists table
    await db.query(`
      CREATE TABLE IF NOT EXISTS recipient_lists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        recipients JSONB NOT NULL,
        total_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ recipient_lists table created');

    // Create index for faster queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_recipient_lists_user_id 
      ON recipient_lists(user_id);
    `);

    console.log('✅ Indexes created');
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

addRecipientListsTable();

