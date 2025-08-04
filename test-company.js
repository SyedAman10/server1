require('dotenv').config();
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:5000';
const TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFtYW5AZXJwdGVjaG5pY2Fscy5jb20iLCJuYW1lIjoiQW1hbiBOYXF2aSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NLX1ZwNVk0U0RUYXZ3R2tFN05vSERzTEljLWh3cEdacTNsWHhaUmNBWl96aVFNZlE9czk2LWMiLCJyb2xlIjoidGVhY2hlciIsInN1YiI6IjEwODg1MzA0Mjk4NDc2Mjc2NjMxMyIsImlhdCI6MTc0NzE1ODAxMywiZXhwIjoxNzQ3NzYyODEzfQ.JK1w2hsTXT8lryYm3lKYJeN0yi8oWBAe_Iw1iq-BLLw";

// Test data
const companyData = {
  company_name: "ERP Technicals",
  company_email: "info@erptechnicals.com",
  company_phone: "1234567890",
  teacher_name: "Aman Naqvi",
  teacher_email: "aman@erptechnicals.com",
  teacher_phone: "0987654321"
};

async function testCompanyEndpoints() {
  console.log('\n🔍 Testing Company Information Endpoints');
  console.log('----------------------------------------');

  if (!TEST_TOKEN) {
    console.error('❌ Error: TEST_TOKEN not set');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Add/Update Company Information
    console.log('\n1️⃣ Testing POST /api/company');
    console.log('Request data:', companyData);
    
    const updateResponse = await axios.post(
      `${API_URL}/api/company`,
      companyData,
      { headers }
    );

    console.log('✅ Response:', updateResponse.data);

    // Test 2: Get Company Information
    console.log('\n2️⃣ Testing GET /api/company/get');
    
    const getResponse = await axios.get(
      `${API_URL}/api/company`,
      { headers }
    );

    console.log('✅ Response:', getResponse.data);

    // Verify the data
    const savedData = getResponse.data.data;
    console.log('\n🔍 Verifying saved data...');
    
    const fields = [
      'company_name',
      'company_email',
      'company_phone',
      'teacher_name',
      'teacher_email',
      'teacher_phone'
    ];

    fields.forEach(field => {
      if (savedData[field] === companyData[field]) {
        console.log(`✅ ${field}: Matches`);
      } else {
        console.log(`❌ ${field}: Does not match`);
        console.log(`   Expected: ${companyData[field]}`);
        console.log(`   Got: ${savedData[field]}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the tests
testCompanyEndpoints().catch(console.error); 