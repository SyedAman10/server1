require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../utils/db');

async function changePassword() {
  const email = 'aman@erptechnicals.com';
  const newPassword = 'Aman2025!Tech';  // Simple, memorable password
  
  try {
    console.log('\n🔐 Changing password for:', email);
    
    // Find user
    const user = await db.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    
    if (user.rows.length === 0) {
      console.log('❌ User not found!');
      process.exit(1);
    }
    
    console.log('✅ User found:', user.rows[0].name);
    
    // Hash password
    const hashed = await bcrypt.hash(newPassword, 10);
    
    // Update
    await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashed, email]);
    
    console.log('\n✅ PASSWORD CHANGED!\n');
    console.log('=' .repeat(50));
    console.log('Email:', email);
    console.log('Password:', newPassword);
    console.log('=' .repeat(50));
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

changePassword();

