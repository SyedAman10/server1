const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

// Create a cookie jar to store cookies between requests
const cookieJar = new CookieJar();
const client = wrapper(axios.create({ jar: cookieJar }));

const BASE_URL = 'http://localhost:5000';

async function testAuthAndClassroom() {
  try {
    // Step 1: Start Google OAuth flow
    console.log('Starting Google OAuth flow...');
    const authResponse = await client.get(`${BASE_URL}/api/auth/google`);
    console.log('Auth URL:', authResponse.request.res.responseUrl);
    
    // Note: You'll need to manually complete the OAuth flow in your browser
    // After completing OAuth, you'll be redirected to /auth-success
    // The JWT cookie will be set automatically

    // Step 2: Test classroom endpoints (after you've completed OAuth)
    console.log('\nTesting classroom endpoints...');
    
    // List classrooms
    console.log('\nFetching classrooms:');
    const listResponse = await client.get(`${BASE_URL}/api/classroom/`);
    console.log('Classrooms:', listResponse.data);

    // Create a classroom
    console.log('\nCreating a classroom:');
    const createResponse = await client.post(`${BASE_URL}/api/classroom/create`, {
      name: "Test Classroom",
      section: "Test Section",
      descriptionHeading: "Test Description Heading",
      description: "This is a test classroom",
      room: "Test Room",
      ownerId: "me",
      courseState: "PROVISIONED"
    });
    console.log('Created classroom:', createResponse.data);

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testAuthAndClassroom(); 