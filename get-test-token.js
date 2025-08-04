require('dotenv').config();
const axios = require('axios');
const open = require('open').default;

// Configuration
const API_URL = 'http://localhost:5000';
const CALLBACK_URL = 'https://fb19-39-51-58-152.ngrok-free.app/api/auth/google/callback';

async function getTestToken() {
  console.log('\n🔍 Getting Test Token for Teacher Account');
  console.log('----------------------------------------');

  try {
    // Get auth URL
    console.log('1️⃣ Getting auth URL...');
    const authUrlResponse = await axios.get(`${API_URL}/api/auth/google?role=teacher`);
    const authUrl = authUrlResponse.data.url;
    console.log('✅ Auth URL generated');

    // Open auth URL in browser
    console.log('\n2️⃣ Opening auth URL in browser...');
    await open(authUrl);
    console.log('✅ Browser opened');
    console.log('\n⚠️  Please complete the authentication in your browser');
    console.log('⚠️  After authentication, you will be redirected to the frontend');
    console.log('⚠️  Copy the token from the URL parameters');
    console.log('\nExample URL parameters:');
    console.log('token=xxx&role=teacher&name=John&email=john@example.com');
    console.log('\n3️⃣ Add the token to your .env file:');
    console.log('TEST_TOKEN=your_token_here');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the script
getTestToken().catch(console.error); 