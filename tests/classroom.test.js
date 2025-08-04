const axios = require('axios');
require('dotenv').config();

// Configuration
const BASE_URL = process.env.API_URL || 'https://1cca-39-51-58-152.ngrok-free.app/api';
let authToken = process.env.TEST_AUTH_TOKEN; // Get token from environment variable

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m"
};
let testCourseId = ''; // Will store the ID of the created course
let userRole = ''; // Will store the selected role

// Test data
const testCourse = {
  name: "Test Course 2024",
  section: "Section A",
  descriptionHeading: "Test Course Description",
  description: "This is a test course created for API testing",
  room: "Room 101"
};

const updatedCourse = {
  name: "Updated Test Course 2024",
  section: "Section B",
  descriptionHeading: "Updated Test Course Description",
  description: "This is an updated test course for API testing",
  room: "Room 102"
};

// Helper function to make authenticated requests
const makeRequest = async (method, url, data = null) => {
  if (!authToken) {
    throw new Error('No auth token provided. Please set TEST_AUTH_TOKEN environment variable.');
  }

  try {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    if (data) config.data = data;
    return await axios(config);
  } catch (error) {
    console.error(`Error in ${method} ${url}:`, error.response?.data || error.message);
    throw error;
  }
};

// Get JWT token
const getAuthToken = async () => {
  try {
    // First, let the user select their role
    console.log('\nPlease select your role:');
    console.log('1. Teacher');
    console.log('2. Student');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const role = await new Promise((resolve) => {
      readline.question('Enter your choice (1 or 2): ', (choice) => {
        readline.close();
        resolve(choice === '1' ? 'teacher' : 'student');
      });
    });

    userRole = role;
    console.log(`\nSelected role: ${role}`);

    console.log('\nGetting Google OAuth URL...');
    const response = await axios.get(`${BASE_URL}/auth/google?role=${role}`);
    const authUrl = response.data.url;
    
    console.log('\nOpening browser for Google authentication...');
    console.log('Please complete the following steps:');
    console.log('1. Sign in with your Google account');
    console.log('2. Grant the requested permissions');
    console.log('3. After authentication, you will see a JSON response with your token');
    console.log('4. Copy the entire token from the response');
    
    // Open the auth URL in the default browser
    await open(authUrl);
    
    // Wait for user to complete authentication
    console.log('\nWaiting for authentication to complete...');
    console.log('After authentication, you will see a JSON response in your browser.');
    console.log('Copy the token from the response and paste it here:');
    
    const tokenReadline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      tokenReadline.question('Enter your JWT token: ', (token) => {
        tokenReadline.close();
        resolve(token);
      });
    });
  } catch (error) {
    console.error('Error getting auth token:', error.message);
    throw error;
  }
};

// Logging utility
const log = {
  info: (msg) => console.log(colors.blue + msg + colors.reset),
  success: (msg) => console.log(colors.green + '✓ ' + msg + colors.reset),
  error: (msg) => console.log(colors.red + '✗ ' + msg + colors.reset),
  title: (msg) => console.log('\n' + colors.bright + msg + colors.reset)
};

async function validateTestPrerequisites() {
  if (!authToken) {
    log.error('TEST_AUTH_TOKEN environment variable is not set');
    log.info('\nTo run the tests:');
    log.info('1. Run the auth test script to get a token:');
    log.info('   node test-auth.js');
    log.info('2. Set the TEST_AUTH_TOKEN environment variable:');
    log.info('   $env:TEST_AUTH_TOKEN="your-token-here"');
    log.info('3. Run this test script again\n');
    process.exit(1);
  }
}

// Test functions
const testListCourses = async () => {
  console.log('\n1. Testing List Courses...');
  const response = await makeRequest('get', '/classroom');
  console.log('Courses found:', response.data.length);
  return response.data;
};

const testCreateCourse = async () => {
  // Only allow teachers to create courses
  if (userRole !== 'teacher') {
    console.log('\nSkipping Create Course test (student role)');
    return null;
  }

  console.log('\n2. Testing Create Course...');
  const response = await makeRequest('post', '/classroom', testCourse);
  console.log('Course created:', response.data);
  testCourseId = response.data.id;
  return response.data;
};

const testGetCourse = async () => {
  console.log('\n3. Testing Get Course...');
  const response = await makeRequest('get', `/classroom/${testCourseId}`);
  console.log('Course details:', response.data);
  return response.data;
};

const testUpdateCourse = async () => {
  // Only allow teachers to update courses
  if (userRole !== 'teacher') {
    console.log('\nSkipping Update Course test (student role)');
    return null;
  }

  console.log('\n4. Testing Update Course...');
  const updateData = {
    name: "Updated Test Course 2024",
    description: "This course has been updated"
  };
  const response = await makeRequest('patch', `/classroom/${testCourseId}`, updateData);
  console.log('Course updated:', response.data);
  return response.data;
};

const testArchiveCourse = async () => {
  // Only allow teachers to archive courses
  if (userRole !== 'teacher') {
    console.log('\nSkipping Archive Course test (student role)');
    return null;
  }

  console.log('\n5. Testing Archive Course...');
  const response = await makeRequest('patch', `/classroom/${testCourseId}/archive`);
  console.log('Course archived:', response.data);
  return response.data;
};

const testDeleteCourse = async () => {
  // Only allow teachers to delete courses
  if (userRole !== 'teacher') {
    console.log('\nSkipping Delete Course test (student role)');
    return null;
  }

  console.log('\n6. Testing Delete Course...');
  await makeRequest('delete', `/classroom/${testCourseId}`);
  console.log('Course deleted successfully');
};

// Main test function
const runTests = async () => {
  try {
    await validateTestPrerequisites();
    
    log.title('🚀 Starting Classroom API Tests...');

    // Test 1: List Courses
    log.title('Test 1: Listing Courses');
    const listResponse = await makeRequest('GET', `${BASE_URL}/classroom`);
    log.success('Successfully listed courses');
    log.info(`Found ${listResponse.data.length} courses\n`);

    // Test 2: Create Course
    log.title('Test 2: Creating New Course');
    const createResponse = await makeRequest('POST', `${BASE_URL}/classroom/courses`, testCourse);
    testCourseId = createResponse.data.id;
    log.success('Successfully created course');
    log.info(`Course ID: ${testCourseId}\n`);

    // Test 3: Get Course
    log.title('Test 3: Getting Course Details');
    const getResponse = await makeRequest('GET', `${BASE_URL}/classroom/courses/${testCourseId}`);
    log.success('Successfully retrieved course details');
    log.info(`Course Name: ${getResponse.data.name}\n`);

    // Test 4: Update Course
    log.title('Test 4: Updating Course');
    const updateResponse = await makeRequest('PATCH', `${BASE_URL}/classroom/courses/${testCourseId}`, updatedCourse);
    log.success('Successfully updated course');
    log.info(`Updated Name: ${updateResponse.data.name}\n`);

    // Test 5: Archive Course
    log.title('Test 5: Archiving Course');
    const archiveResponse = await makeRequest('POST', `${BASE_URL}/classroom/courses/${testCourseId}/archive`);
    log.success('Successfully archived course');
    log.info(`Course State: ${archiveResponse.data.courseState}\n`);

    // Test 6: Delete Course
    log.title('Test 6: Deleting Course');
    await makeRequest('DELETE', `${BASE_URL}/classroom/courses/${testCourseId}`);
    log.success('Successfully deleted course\n');

    log.success('🎉 All tests completed successfully!\n');
  } catch (error) {
    log.error('\nTest failed:');
    if (error.response?.data?.error) {
      log.error(`API Error: ${error.response.data.error}`);
    } else if (error.response?.status) {
      log.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    } else {
      log.error(error.message);
    }
    process.exit(1);
  }
};

// Run the tests
runTests();