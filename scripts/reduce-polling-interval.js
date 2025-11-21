const { Pool } = require('pg');
require('dotenv').config();

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚡ REDUCING POLLING INTERVAL FOR FASTER EMAIL RESPONSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

console.log('📝 To reduce response time from 7-8 minutes to 15-30 seconds:');
console.log('');
console.log('Edit: /home/ubuntu/server1/index.js');
console.log('');
console.log('Find this line (around line 180):');
console.log('  emailPollingService.startEmailPolling(60);  // 60 seconds');
console.log('');
console.log('Change it to:');
console.log('  emailPollingService.startEmailPolling(15);  // 15 seconds');
console.log('');
console.log('Then restart:');
console.log('  pm2 restart index');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('⏰ POLLING INTERVAL OPTIONS:');
console.log('');
console.log('  15 seconds  = Very fast, but more API calls to Gmail');
console.log('  30 seconds  = Fast, balanced API usage');
console.log('  60 seconds  = Default, slower but fewer API calls (current)');
console.log('');
console.log('💡 Recommended: Start with 15 seconds for testing, then increase');
console.log('   to 30 seconds for production to save on API quota.');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

