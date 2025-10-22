const { pool } = require('../config/database');

// Create company table if it doesn't exist
const createCompanyTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      teacher_id VARCHAR(255) NOT NULL, -- Changed from BIGINT to VARCHAR to store Google user ID
      company_name VARCHAR(255) NOT NULL,
      company_email VARCHAR(255) NOT NULL,
      company_phone VARCHAR(20) NOT NULL,
      teacher_name VARCHAR(255) NOT NULL,
      teacher_email VARCHAR(255) NOT NULL,
      teacher_phone VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(teacher_id) -- Add unique constraint instead of foreign key
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

// Migrate existing table structure if needed
const migrateCompanyTable = async () => {
  try {
    // Check if teacher_id column is BIGINT (old structure)
    const checkQuery = `
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'teacher_id';
    `;
    
    const result = await pool.query(checkQuery);
    
    if (result.rows.length > 0 && result.rows[0].data_type === 'bigint') {
      console.log('DEBUG: Migrating company table structure...');
      
      // Drop the foreign key constraint first
      await pool.query('ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_teacher_id_fkey;');
      
      // Change column type from BIGINT to VARCHAR
      await pool.query('ALTER TABLE companies ALTER COLUMN teacher_id TYPE VARCHAR(255);');
      
      // Add unique constraint
      await pool.query('ALTER TABLE companies ADD CONSTRAINT companies_teacher_id_unique UNIQUE (teacher_id);');
      
      console.log('DEBUG: Company table migration completed');
    }
  } catch (error) {
    console.error('Error migrating company table:', error);
  }
};

// Run migration
migrateCompanyTable();

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
    console.log('DEBUG: Upserting company info with values:', values);
    const result = await pool.query(query, values);
    console.log('DEBUG: Upsert result:', result.rows[0]);
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
    console.log('DEBUG: Getting company info for teacherId:', teacherId);
    const result = await pool.query(query, [teacherId]);
    console.log('DEBUG: Query result rows:', result.rows);
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