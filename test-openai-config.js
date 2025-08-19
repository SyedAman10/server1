// Test script to debug OpenAI API key configuration
require('dotenv').config();

console.log('🔍 OpenAI Configuration Debug Script\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not Set');

if (process.env.OPENAI_API_KEY) {
  const key = process.env.OPENAI_API_KEY;
  console.log('  - Key Length:', key.length);
  console.log('  - Key Prefix:', key.substring(0, 7) + '...');
  console.log('  - Key Suffix:', '...' + key.substring(key.length - 4));
  console.log('  - Starts with "sk-":', key.startsWith('sk-') ? '✅ Yes' : '❌ No');
  console.log('  - Contains spaces:', key.includes(' ') ? '❌ Yes (problematic)' : '✅ No');
  console.log('  - Contains newlines:', key.includes('\n') ? '❌ Yes (problematic)' : '✅ No');
  
  // Check for common issues
  if (key.length < 20) {
    console.log('  - ⚠️  Warning: Key seems too short');
  }
  
  if (!key.startsWith('sk-')) {
    console.log('  - ❌ Error: Key should start with "sk-"');
  }
  
  if (key.includes(' ') || key.includes('\n')) {
    console.log('  - ❌ Error: Key contains whitespace or newlines');
  }
} else {
  console.log('  - ❌ OPENAI_API_KEY is not set in environment');
  console.log('  - 💡 Make sure to set it in your .env file or environment');
}

// Test API key if available
if (process.env.OPENAI_API_KEY) {
  console.log('\n🧪 Testing OpenAI API Key...');
  
  const { OpenAI } = require('openai');
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Test with a simple API call
    openai.models.list()
      .then(response => {
        console.log('  ✅ API key is valid and working');
        console.log('  - Available models:', response.data.length);
        console.log('  - First model:', response.data[0]?.id || 'N/A');
      })
      .catch(error => {
        console.log('  ❌ API key test failed:');
        console.log('    - Error:', error.message);
        console.log('    - Code:', error.code || 'N/A');
        console.log('    - Status:', error.status || 'N/A');
        
        if (error.code === 'invalid_api_key') {
          console.log('    - 💡 This means your API key is invalid or expired');
          console.log('    - 🔑 Check your OpenAI dashboard for the correct key');
        } else if (error.code === 'insufficient_quota') {
          console.log('    - 💡 Your OpenAI account has insufficient quota');
          console.log('    - 💳 Check your billing and usage limits');
        } else if (error.code === 'rate_limit_exceeded') {
          console.log('    - 💡 Rate limit exceeded, try again later');
        }
      });
  } catch (error) {
    console.log('  ❌ Error creating OpenAI client:', error.message);
  }
}

console.log('\n📝 Common Issues and Solutions:');
console.log('  1. ❌ API key not set: Set OPENAI_API_KEY in .env file');
console.log('  2. ❌ Invalid key format: Key should start with "sk-"');
console.log('  3. ❌ Expired key: Generate new key in OpenAI dashboard');
console.log('  4. ❌ Wrong environment: Check NODE_ENV setting');
console.log('  5. ❌ Quota exceeded: Check OpenAI billing');
console.log('  6. ❌ Rate limited: Wait and try again');

console.log('\n🔧 To fix:');
console.log('  1. Go to https://platform.openai.com/account/api-keys');
console.log('  2. Create a new API key');
console.log('  3. Copy the key (starts with "sk-")');
console.log('  4. Set it in your .env file: OPENAI_API_KEY=sk-your-key-here');
console.log('  5. Restart your server');

console.log('\n🧪 Test the health endpoint:');
console.log('  curl http://localhost:3000/api/audio/health');

