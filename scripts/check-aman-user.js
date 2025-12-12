require('dotenv').config();
const db = require('../utils/db');

async function checkUser() {
  const email = 'aman@erptechnicals.com';
  
  try {
    console.log('\n🔍 Searching for user:', email);
    
    // Find all users with this email
    const result = await db.query('SELECT id, email, name, role, created_at FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found!');
      process.exit(1);
    }
    
    console.log('\n✅ User(s) found:\n');
    console.log('='.repeat(60));
    
    result.rows.forEach((user, index) => {
      console.log(`\nUser #${index + 1}:`);
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Name:', user.name);
      console.log('  Role:', user.role);
      console.log('  Created:', user.created_at);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📝 Note: Password is hashed in database for security.');
    console.log('   Check reset-aman-password.js for the last set password.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUser();
