const { detectIntentFallback } = require('./services/ai/intentDetection.js');

// Test the message that was failing
const testMessage = 'invite student aman@erptechnicals.com on physics 352';
console.log('Testing message:', testMessage);

try {
  const result = detectIntentFallback(testMessage);
  console.log('\nIntent detection result:');
  console.log(JSON.stringify(result, null, 2));
  
  if (result.parameters.courseName) {
    console.log('\n✅ SUCCESS: Course name extracted:', result.parameters.courseName);
  } else {
    console.log('\n❌ FAILED: No course name extracted');
  }
} catch (error) {
  console.error('Error testing intent detection:', error);
}
