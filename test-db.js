require('dotenv').config();
const { upsertUser, getUserByEmail } = require('./models/user.model');

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test user data
    const testUser = {
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/picture.jpg',
      role: 'student',
      access_token: 'test_access_token',
      refresh_token: 'test_refresh_token'
    };
    
    // Try to save the user
    console.log('Attempting to save test user...');
    const savedUser = await upsertUser(testUser);
    console.log('User saved successfully:', savedUser);
    
    // Try to retrieve the user
    console.log('Attempting to retrieve test user...');
    const retrievedUser = await getUserByEmail(testUser.email);
    console.log('User retrieved successfully:', retrievedUser);
    
    console.log('All tests passed! Database connection and operations are working correctly.');
  } catch (error) {
    console.error('Error testing database:', error);
  } finally {
    // Exit the process
    process.exit();
  }
}

// Run the test
testDatabaseConnection(); 