const db = require('../utils/db');

// Create or update AI configuration
async function upsertAiConfig({ userId, provider, apiKey, modelName, temperature, maxTokens, isDefault }) {
  const query = `
    INSERT INTO ai_configurations (user_id, provider, api_key, model_name, temperature, max_tokens, is_default)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id, provider)
    DO UPDATE SET
      api_key = EXCLUDED.api_key,
      model_name = EXCLUDED.model_name,
      temperature = EXCLUDED.temperature,
      max_tokens = EXCLUDED.max_tokens,
      is_default = EXCLUDED.is_default,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const values = [userId, provider, apiKey, modelName, temperature, maxTokens, isDefault];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get AI config by user and provider
async function getAiConfig(userId, provider) {
  const query = `SELECT * FROM ai_configurations WHERE user_id = $1 AND provider = $2;`;
  const result = await db.query(query, [userId, provider]);
  return result.rows[0];
}

// Get default AI config for user
async function getDefaultAiConfig(userId) {
  const query = `
    SELECT * FROM ai_configurations 
    WHERE user_id = $1 AND is_default = true 
    LIMIT 1;
  `;
  const result = await db.query(query, [userId]);
  
  // If no default, return the first one
  if (result.rows.length === 0) {
    const fallbackQuery = `SELECT * FROM ai_configurations WHERE user_id = $1 LIMIT 1;`;
    const fallbackResult = await db.query(fallbackQuery, [userId]);
    return fallbackResult.rows[0];
  }
  
  return result.rows[0];
}

// Get all AI configs for user
async function getAllAiConfigs(userId) {
  const query = `SELECT * FROM ai_configurations WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC;`;
  const result = await db.query(query, [userId]);
  return result.rows;
}

// Delete AI config
async function deleteAiConfig(userId, provider) {
  const query = `DELETE FROM ai_configurations WHERE user_id = $1 AND provider = $2 RETURNING *;`;
  const result = await db.query(query, [userId, provider]);
  return result.rows[0];
}

module.exports = {
  upsertAiConfig,
  getAiConfig,
  getDefaultAiConfig,
  getAllAiConfigs,
  deleteAiConfig
};

