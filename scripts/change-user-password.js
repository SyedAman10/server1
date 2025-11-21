require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../utils/db');

async function changePassword() {
  const userId = 1;
  const newPassword = 'Teacher@2025'; // New password
  
  console.log('\n🔐 Changing User Password\n');
  console.log('=' .repeat(60));

  try {
    // Get user info
    const userResult = await db.query(`
      SELECT id, name, email, role 
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      console.log(`❌ User ID ${userId} not found!`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    
    console.log(`\n📊 User Information:\n`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await db.query(`
      UPDATE users 
      SET password = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [hashedPassword, userId]);

    console.log('\n✅ Password changed successfully!\n');
    console.log('=' .repeat(60));
    console.log('\n🔑 NEW CREDENTIALS:\n');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\n' + '=' .repeat(60));
    console.log('\n⚠️  Save these credentials securely!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

changePassword();

