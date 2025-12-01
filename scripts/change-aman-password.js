require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../utils/db');

async function changeUserPassword() {
  const userEmail = 'aman@erptechnicals.com';
  
  // Generate a secure random password
  const newPassword = 'Aman@' + Math.random().toString(36).slice(2, 10) + Math.floor(Math.random() * 9000 + 1000);
  
  console.log('\n🔐 Changing Password for User\n');
  console.log('=' .repeat(60));

  try {
    // Find the user by email
    const userResult = await db.query(
      'SELECT id, name, email, role FROM users WHERE email = $1',
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

    // Hash the new password
    console.log('\n🔒 Generating secure password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await db.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, user.id]
    );

    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ PASSWORD CHANGED SUCCESSFULLY!\n');
    console.log('📋 New Credentials:\n');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\n' + '=' .repeat(60));
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('   The password cannot be recovered later.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

changeUserPassword();

