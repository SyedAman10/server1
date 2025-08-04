require('dotenv').config();
const axios = require('axios');
const open = require('open').default;

// Hardcoded callback URL for testing
const CALLBACK_URL = 'https://1cca-39-51-58-152.ngrok-free.app/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function testAuth() {
  console.log('\n🔍 Testing Environment Configuration:');
  console.log('----------------------------------------');
  console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Not Set');
  console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Not Set');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not Set');
  console.log('CALLBACK_URL:', CALLBACK_URL);
  console.log('FRONTEND_URL:', FRONTEND_URL);
  console.log('----------------------------------------\n');

  try {
    // Test server health
    console.log('🔍 Testing Server Health...');
    const healthResponse = await axios.get('http://localhost:5000/');
    console.log('✅ Server is running:', healthResponse.data);

    // Test auth URL generation
    console.log('\n🔍 Testing Auth URL Generation...');
    const authUrlResponse = await axios.get('http://localhost:5000/api/auth/google?role=student');
    const authUrl = authUrlResponse.data.url;
    console.log('✅ Auth URL generated successfully');
    console.log('Auth URL:', authUrl);

    // Check if the callback URL and state are correct
    const url = new URL(authUrl);
    const callbackUrl = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    
    console.log('\n🔍 Checking URL parameters...');
    console.log('Expected callback URL:', CALLBACK_URL);
    console.log('Actual callback URL:', callbackUrl);
    console.log('State parameter:', state);
    
    if (callbackUrl !== CALLBACK_URL) {
      console.warn('⚠️  Warning: Callback URL does not match the expected URL!');
    }
    
    if (state !== 'student') {
      console.warn('⚠️  Warning: State parameter does not match expected role!');
    }

    // Open the auth URL in browser
    console.log('\n🔍 Opening auth URL in browser...');
    await open(authUrl);
    console.log('✅ Browser opened with auth URL');
    console.log('\n⚠️  Please complete the authentication in your browser');
    console.log('⚠️  After authentication, you will be redirected to:', FRONTEND_URL);
    console.log('⚠️  The redirect will include your token and user data as URL parameters');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    process.exit(1);
  }
}

// Run the test
testAuth().catch(console.error); 