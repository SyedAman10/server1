/**
 * Test script for AI-powered correction detection
 * 
 * This script demonstrates how the system detects and handles user corrections
 * when they change their mind about emails and class names.
 * 
 * Usage: node test-correction-detection.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TEST_TOKEN = process.env.TEST_TOKEN; // Set this in your .env file

if (!TEST_TOKEN) {
  console.error('❌ Error: TEST_TOKEN not found in environment variables');
  console.log('Please set TEST_TOKEN in your .env file with a valid JWT token');
  process.exit(1);
}

/**
 * Helper function to send a message to the AI agent
 */
async function sendMessage(message, conversationId) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/ai-agent/message`,
      {
        message,
        conversationId
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Sleep helper for better output readability
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test Case 1: Correcting both email and class name
 */
async function testEmailAndClassCorrection() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 1: Correcting Both Email and Class Name');
  console.log('='.repeat(80) + '\n');
  
  const conversationId = `test-correction-${Date.now()}`;
  
  // Step 1: Send initial request with wrong info
  console.log('📤 User: "invite student john@gmail.com to class teaching 1"');
  let response = await sendMessage(
    'invite student john@gmail.com to class teaching 1',
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
  }
  
  await sleep(2000);
  
  // Step 2: User corrects both email and class name
  console.log('\n📤 User: "oh sorry invite rimalabbas2000@gmail.com and the class would be ai support2"');
  response = await sendMessage(
    'oh sorry invite rimalabbas2000@gmail.com and the class would be ai support2',
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
    
    if (response.intent) {
      console.log('\n🔍 Intent Detected:', response.intent.intent);
      console.log('📊 Confidence:', response.intent.confidence);
      console.log('🎯 Is Correction:', response.intent.isCorrection || false);
      console.log('📋 Parameters:', JSON.stringify(response.intent.parameters, null, 2));
      
      if (response.intent.correctionExplanation) {
        console.log('💡 Explanation:', response.intent.correctionExplanation);
      }
    }
  }
}

/**
 * Test Case 2: Correcting only the course name
 */
async function testCourseNameCorrection() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 2: Correcting Only Course Name');
  console.log('='.repeat(80) + '\n');
  
  const conversationId = `test-course-${Date.now()}`;
  
  // Step 1: Send initial request
  console.log('📤 User: "add student mike@test.com to physics class"');
  let response = await sendMessage(
    'add student mike@test.com to physics class',
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
  }
  
  await sleep(2000);
  
  // Step 2: User corrects the course name
  console.log('\n📤 User: "actually it\'s chemistry class"');
  response = await sendMessage(
    "actually it's chemistry class",
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
    
    if (response.intent) {
      console.log('\n🔍 Intent Detected:', response.intent.intent);
      console.log('📊 Confidence:', response.intent.confidence);
      console.log('🎯 Is Correction:', response.intent.isCorrection || false);
      console.log('📋 Parameters:', JSON.stringify(response.intent.parameters, null, 2));
    }
  }
}

/**
 * Test Case 3: Correcting only the email
 */
async function testEmailCorrection() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 3: Correcting Only Email');
  console.log('='.repeat(80) + '\n');
  
  const conversationId = `test-email-${Date.now()}`;
  
  // Step 1: Send initial request
  console.log('📤 User: "invite sarah@example.com to math 101"');
  let response = await sendMessage(
    'invite sarah@example.com to math 101',
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
  }
  
  await sleep(2000);
  
  // Step 2: User corrects the email
  console.log('\n📤 User: "sorry i meant john@example.com"');
  response = await sendMessage(
    'sorry i meant john@example.com',
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
    
    if (response.intent) {
      console.log('\n🔍 Intent Detected:', response.intent.intent);
      console.log('📊 Confidence:', response.intent.confidence);
      console.log('🎯 Is Correction:', response.intent.isCorrection || false);
      console.log('📋 Parameters:', JSON.stringify(response.intent.parameters, null, 2));
    }
  }
}

/**
 * Test Case 4: Multiple corrections in sequence
 */
async function testMultipleCorrections() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE 4: Multiple Corrections in Sequence');
  console.log('='.repeat(80) + '\n');
  
  const conversationId = `test-multiple-${Date.now()}`;
  
  // Step 1: Send initial request
  console.log('📤 User: "invite bob@test.com to english class"');
  let response = await sendMessage(
    'invite bob@test.com to english class',
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
  }
  
  await sleep(2000);
  
  // Step 2: First correction - change email
  console.log('\n📤 User: "oops i meant alice@test.com"');
  response = await sendMessage(
    'oops i meant alice@test.com',
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
  }
  
  await sleep(2000);
  
  // Step 3: Second correction - change course
  console.log('\n📤 User: "no wait make it spanish class"');
  response = await sendMessage(
    'no wait make it spanish class',
    conversationId
  );
  
  if (response) {
    console.log('🤖 System:', response.message || JSON.stringify(response, null, 2));
    
    if (response.intent) {
      console.log('\n🔍 Intent Detected:', response.intent.intent);
      console.log('📊 Confidence:', response.intent.confidence);
      console.log('🎯 Is Correction:', response.intent.isCorrection || false);
      console.log('📋 Final Parameters:', JSON.stringify(response.intent.parameters, null, 2));
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n🚀 Starting AI Correction Detection Tests');
  console.log('📍 Base URL:', BASE_URL);
  console.log('🔑 Token:', TEST_TOKEN ? '✅ Set' : '❌ Not Set');
  
  try {
    await testEmailAndClassCorrection();
    await sleep(3000);
    
    await testCourseNameCorrection();
    await sleep(3000);
    
    await testEmailCorrection();
    await sleep(3000);
    
    await testMultipleCorrections();
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed!');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();

