const db = require('../utils/db');
const bcrypt = require('bcrypt');

// Create a new user with password (for signup)
async function createUser({ email, password, name, role = 'student', picture = null }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const query = `
    INSERT INTO users (email, password, name, role, picture)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, email, name, role, picture, created_at;
  `;
  const values = [email, hashedPassword, name, role, picture];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Upsert user (for OAuth)
async function upsertUser({ email, name, picture, role, access_token, refresh_token }) {
  const query = `
    INSERT INTO users (email, password, name, picture, role, access_token, refresh_token)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (email)
    DO UPDATE SET
      name = EXCLUDED.name,
      picture = EXCLUDED.picture,
      role = EXCLUDED.role,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  // For OAuth users, we set a random password that they won't use
  const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
  const values = [email, randomPassword, name, picture, role, access_token, refresh_token];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get user by email
async function getUserByEmail(email) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

// Get user by email and role (for multi-role accounts)
async function getUserByEmailAndRole(email, role) {
  const result = await db.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, role]);
  return result.rows[0];
}

// Get all accounts with same email (for login role selection)
async function getUsersByEmail(email) {
  const result = await db.query('SELECT id, email, name, role, picture FROM users WHERE email = $1', [email]);
  return result.rows;
}

// Get user by ID
async function getUserById(id) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// Verify user password
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// Update user
async function updateUser(id, updates) {
  const allowedUpdates = ['name', 'picture', 'role'];
  const setClause = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedUpdates.includes(key)) {
      setClause.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClause.length === 0) {
    throw new Error('No valid fields to update');
  }

  setClause.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const query = `
    UPDATE users
    SET ${setClause.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, name, role, picture, created_at, updated_at;
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

module.exports = { 
  createUser, 
  upsertUser, 
  getUserByEmail,
  getUserByEmailAndRole,
  getUsersByEmail,
  getUserById,
  verifyPassword,
  updateUser
};
