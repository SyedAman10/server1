const ngrok = require('ngrok');
const { spawn } = require('child_process');
const path = require('path');

async function startServer() {
  // Start the server
  const server = spawn('node', ['index.js'], {
    stdio: 'inherit',
    shell: true
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Start ngrok
    const url = await ngrok.connect({
      addr: 5000,
      proto: 'http'
    });

    console.log('\n🚀 Server is running!');
    console.log('📡 Local URL: http://localhost:5000');
    console.log('🌐 Public URL:', url);
    console.log('\n⚠️  Update your Google OAuth redirect URI to:', `${url}/api/auth/google/callback`);
    console.log('⚠️  Update your .env file with:');
    console.log(`BASE_URL=${url}`);

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await ngrok.kill();
      server.kill();
      process.exit();
    });

  } catch (error) {
    console.error('Error starting ngrok:', error);
    server.kill();
    process.exit(1);
  }
}

startServer(); 