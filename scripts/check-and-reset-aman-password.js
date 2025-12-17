require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../utils/db');

async function checkAndResetPassword() {
  const userEmail = 'aman@erptechnicals.com';
  const newPassword = 'Aman@123456'; // Set your desired password here
  
  console.log('\n🔐 Checking User Information\n');
  console.log('='.repeat(60));

  try {
    // Find the user by email
    const userResult = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ User not found: ${userEmail}\n`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    
    console.log(`\n📊 User Found:\n`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${user.created_at}`);
    console.log('\n⚠️  Note: Passwords are hashed and cannot be retrieved.');
    console.log('   The current password cannot be shown for security reasons.\n');

    // Ask if user wants to reset password
    console.log('🔄 Resetting password to a new value...\n');

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the password
    await db.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, user.id]
    );

    console.log('='.repeat(60));
    console.log('\n✅ PASSWORD RESET SUCCESSFULLY!\n');
    console.log('📋 New Credentials:\n');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\n='.repeat(60));
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('   Share this password with the student.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkAndResetPassword();

