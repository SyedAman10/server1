const db = require('../utils/db');

async function upsertUser({ email, name, picture, role, access_token, refresh_token }) {
  const query = `
    INSERT INTO users (email, name, picture, role, access_token, refresh_token)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email)
    DO UPDATE SET
      name = EXCLUDED.name,
      picture = EXCLUDED.picture,
      role = EXCLUDED.role,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token
    RETURNING *;
  `;
  const values = [email, name, picture, role, access_token, refresh_token];
  const result = await db.query(query, values);
  return result.rows[0];
}

async function getUserByEmail(email) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

module.exports = { upsertUser, getUserByEmail };
