const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function addAiConfigTable() {
  try {
    console.log('🚀 Starting to add AI configuration table...');
    
    const client = await pool.connect();
    
    // Create ai_configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_configurations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'gemini', 'anthropic')),
        api_key TEXT NOT NULL,
        model_name VARCHAR(100) DEFAULT 'gpt-4',
        temperature DECIMAL(3,2) DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 500,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, provider)
      );
    `);
    console.log('✅ AI configurations table created');
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_configs_user_id ON ai_configurations(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_configs_provider ON ai_configurations(provider);
    `);
    console.log('✅ AI configurations indexes created');
    
    client.release();
    console.log('🎉 AI configuration table added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding AI configuration table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addAiConfigTable();

