const { pool } = require('../config/database');

// Create company table if it doesn't exist
const createCompanyTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      teacher_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      company_name VARCHAR(255) NOT NULL,
      company_email VARCHAR(255) NOT NULL,
      company_phone VARCHAR(20) NOT NULL,
      teacher_name VARCHAR(255) NOT NULL,
      teacher_email VARCHAR(255) NOT NULL,
      teacher_phone VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await pool.query(query);
    console.log('Company table created or already exists');
  } catch (error) {
    console.error('Error creating company table:', error);
    throw error;
  }
};

// Initialize the table
createCompanyTable();

// Add or update company information
const upsertCompanyInfo = async (companyData) => {
  const {
    teacher_id,
    company_name,
    company_email,
    company_phone,
    teacher_name,
    teacher_email,
    teacher_phone
  } = companyData;

  const query = `
    INSERT INTO companies (
      teacher_id,
      company_name,
      company_email,
      company_phone,
      teacher_name,
      teacher_email,
      teacher_phone
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (teacher_id) 
    DO UPDATE SET
      company_name = $2,
      company_email = $3,
      company_phone = $4,
      teacher_name = $5,
      teacher_email = $6,
      teacher_phone = $7,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [
    teacher_id,
    company_name,
    company_email,
    company_phone,
    teacher_name,
    teacher_email,
    teacher_phone
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting company info:', error);
    throw error;
  }
};

// Get company information by teacher ID
const getCompanyInfo = async (teacherId) => {
  const query = `
    SELECT * FROM companies 
    WHERE teacher_id = $1;
  `;

  try {
    const result = await pool.query(query, [teacherId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting company info:', error);
    throw error;
  }
};

module.exports = {
  upsertCompanyInfo,
  getCompanyInfo
}; 