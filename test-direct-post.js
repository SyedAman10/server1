const axios = require('axios');

async function testDirectPost() {
  try {
    console.log('Testing direct POST request to backend...');
    
    const response = await axios({
      method: 'POST',
      url: 'http://class.xytek.ai/api/classroom/create-test',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Header': 'direct-test'
      },
      data: {
        name: 'Direct Test Course',
        section: 'TEST001'
      }
    });
    
    console.log('Direct POST successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('Direct POST failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function testDirectPostToMain() {
  try {
    console.log('\nTesting direct POST to main classroom endpoint...');
    
    const response = await axios({
      method: 'POST',
      url: 'http://class.xytek.ai/api/classroom',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN_HERE', // Replace with actual token
        'X-Test-Header': 'direct-test-main'
      },
      data: {
        name: 'Direct Test Course 2',
        section: 'TEST002'
      }
    });
    
    console.log('Direct POST to main endpoint successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('Direct POST to main endpoint failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run tests
testDirectPost();
testDirectPostToMain();
