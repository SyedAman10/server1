const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { upsertUser } = require('../models/user.model');

// Dynamic URLs based on environment
const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'https://class.xytek.ai';
  }
  return process.env.BACKEND_URL || 'http://localhost:3000';
};

const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || ' https://xytek-classroom-assistant.vercel.app';
  }
  // For development, if frontend is on Vercel but backend is local
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  return 'http://localhost:3000';
};

const getCallbackUrl = () => {
  const backendUrl = getBackendUrl();
  const callbackUrl = `${backendUrl}/api/auth/google/callback`;
  console.log('🔧 OAuth Configuration Debug:', {
    NODE_ENV: process.env.NODE_ENV,
    BACKEND_URL: process.env.BACKEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    backendUrl: backendUrl,
    callbackUrl: callbackUrl
  });
  return callbackUrl;
};

// Create separate OAuth clients for web and mobile
const createOAuthClient = (callbackUrl) => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl
  );
};

// Web OAuth client (uses backend callback URL)
const webOAuthClient = createOAuthClient(getCallbackUrl());

// Mobile OAuth client (uses a custom redirect URI that works with web clients)
const mobileOAuthClient = createOAuthClient('https://class.xytek.ai/api/auth/google/mobile-callback');

// Valid roles constant
const VALID_ROLES = ['student', 'teacher', 'super_admin'];

// Common function to handle user authentication and token generation
const handleUserAuth = async (userInfo, tokens, role) => {
  const user = await upsertUser({
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    role: role,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  // Create JWT payload
  const jwtPayload = {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    role: user.role,
    sub: userInfo.id,
    iat: Math.floor(Date.now() / 1000),
  };

  // Generate JWT token
  const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256'
  });

  // Console log the generated JWT token
  console.log('🔐 JWT Token Generated:', token);
  console.log('👤 User Info:', {
    email: userInfo.email,
    name: userInfo.name,
    role: user.role
  });

  return {
    token,
    userData: {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      role: user.role
    }
  };
};

// Function to determine redirect path based on role
const getRedirectPath = (role) => {
  switch (role) {
    case 'teacher':
      return '/wizard';
    case 'student':
      return '/dashboard';
    case 'super_admin':
      return '/dashboard'; // You can change this to whatever path you want for super admins
    default:
      return '/dashboard';
  }
};

// Handle Web Authentication
const handleWebAuth = async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('Auth callback received:', { code, state });
    
    if (!state || !VALID_ROLES.includes(state)) {
      console.error('Invalid role in state:', state);
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be either "teacher", "student", or "super_admin"'
      });
    }

    const { tokens } = await webOAuthClient.getToken(code);
    webOAuthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: webOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    const user = await handleUserAuth(userInfo, tokens, state);

    console.log('✅ Web Auth Successful:', {
      email: user.userData.email,
      role: user.userData.role,
      redirectPath: getRedirectPath(user.userData.role)
    });

    const frontendUrl = getFrontendUrl();
    
    // Determine redirect path based on role
    const redirectPath = getRedirectPath(user.userData.role);
    
    const redirectUrl = new URL(frontendUrl + redirectPath);
    redirectUrl.searchParams.set('token', user.token);
    redirectUrl.searchParams.set('role', user.userData.role);
    redirectUrl.searchParams.set('name', user.userData.name);
    redirectUrl.searchParams.set('email', user.userData.email);
    redirectUrl.searchParams.set('picture', user.userData.picture);

    console.log('🔄 Redirect Debug:', {
      frontendUrl: frontendUrl,
      redirectPath: redirectPath,
      fullRedirectUrl: redirectUrl.toString()
    });

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Web auth error:', error);
    const frontendUrl = getFrontendUrl();
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('error', 'Authentication failed');
    res.redirect(redirectUrl.toString());
  } 
};

// Handle Mobile Authentication (Direct API call - no redirect)
const handleMobileAuth = async (req, res) => {
  try {
    const { code, role } = req.body;
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be either "teacher", "student", or "super_admin"'
      });
    }
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'NoCode',
        message: 'Authorization code is required'
      });
    }
    
    const { tokens } = await mobileOAuthClient.getToken(code);
    mobileOAuthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: mobileOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    const user = await handleUserAuth(userInfo, tokens, role);

    console.log('✅ Mobile Auth Successful:', {
      email: user.userData.email,
      role: user.userData.role,
      tokenLength: user.token.length
    });

    res.json({
      success: true,
      token: user.token,
      user: user.userData
    });
  } catch (error) {
    console.error('Mobile auth error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
};

// Handle Mobile Callback (for OAuth redirect) - Sends HTML directly
const handleMobileCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('🔍 Mobile callback received:', {
      code: req.query.code,
      state: req.query.state,
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'],
      timestamp: new Date().toISOString()
    });

    if (!code) {
      console.log('❌ No code received');
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #e53e3e;">❌ No Authorization Code</h1>
            <p>No authorization code received. Please try again.</p>
        </body>
        </html>
      `);
      return;
    }

    // Validate the authorization code
    if (code.length < 10) {
      console.log('❌ Invalid code received');
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #e53e3e;">❌ Invalid Authorization Code</h1>
            <p>Invalid authorization code received. Please try again.</p>
        </body>
        </html>
      `);
      return;
    }

    if (!state || !VALID_ROLES.includes(state)) {
      console.log('❌ Invalid role in state:', state);
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #e53e3e;">❌ Invalid Role</h1>
            <p>Invalid role in state parameter: ${state}. Please try again.</p>
        </body>
        </html>
      `);
      return;
    }

    console.log('🔄 Exchanging authorization code for tokens...');
    
    // Exchange the authorization code for tokens
    const { tokens } = await mobileOAuthClient.getToken(code);
    mobileOAuthClient.setCredentials(tokens);

    console.log('✅ Tokens received from Google');

    // Get user information from Google
    const oauth2 = google.oauth2({ auth: mobileOAuthClient, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    console.log('👤 User info received:', { email: userInfo.email, name: userInfo.name });

    // Handle user authentication and generate JWT
    const user = await handleUserAuth(userInfo, tokens, state);

    console.log('✅ Mobile OAuth completed successfully:', {
      email: user.userData.email,
      role: user.userData.role,
      tokenLength: user.token.length,
      tokenPreview: `${user.token.substring(0, 20)}...`
    });

    // Generate the deep link URL
    const deepLinkUrl = `xytekclassroom://auth?token=${encodeURIComponent(user.token)}&role=${encodeURIComponent(user.userData.role)}&email=${encodeURIComponent(user.userData.email)}&name=${encodeURIComponent(user.userData.name)}&picture=${encodeURIComponent(user.userData.picture)}`;
    
    console.log('🔗 Generated deep link URL:', {
      scheme: 'xytekclassroom',
      path: '/auth',
      tokenLength: user.token.length,
      role: user.userData.role,
      email: user.userData.email,
      fullUrl: deepLinkUrl
    });

    // ✅ CRITICAL: Send HTML content, NOT redirect
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Authentication Complete</title>
          <style>
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                  margin: 0; 
                  padding: 20px; 
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .container { 
                  background: white; 
                  padding: 40px; 
                  border-radius: 20px; 
                  box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
                  max-width: 500px; 
                  text-align: center;
                  animation: slideUp 0.5s ease-out;
              }
              @keyframes slideUp {
                  from { transform: translateY(30px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
              }
              .success-icon { 
                  font-size: 64px; 
                  margin-bottom: 20px;
                  animation: bounce 2s infinite;
              }
              @keyframes bounce {
                  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                  40% { transform: translateY(-10px); }
                  60% { transform: translateY(-5px); }
              }
              h1 { 
                  color: #2d3748; 
                  margin-bottom: 10px;
                  font-size: 28px;
              }
              .subtitle {
                  color: #718096;
                  margin-bottom: 30px;
                  font-size: 16px;
              }
              .user-info {
                  background: #f7fafc;
                  padding: 20px;
                  border-radius: 12px;
                  margin: 25px 0;
                  text-align: left;
                  border-left: 4px solid #4299e1;
              }
              .user-info p {
                  margin: 8px 0;
                  color: #4a5568;
              }
              .user-info strong {
                  color: #2d3748;
              }
              .button { 
                  background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
                  color: white; 
                  padding: 18px 36px; 
                  text-decoration: none; 
                  border-radius: 12px; 
                  display: inline-block; 
                  font-weight: 600; 
                  font-size: 16px;
                  transition: all 0.3s ease;
                  box-shadow: 0 4px 15px rgba(66, 153, 225, 0.3);
              }
              .button:hover { 
                  transform: translateY(-2px);
                  box-shadow: 0 8px 25px rgba(66, 153, 225, 0.4);
              }
              .instructions {
                  background: #edf2f7;
                  padding: 20px;
                  border-radius: 12px;
                  margin: 25px 0;
                  text-align: left;
              }
              .instructions h3 {
                  color: #2d3748;
                  margin-top: 0;
                  font-size: 18px;
              }
              .instructions ol {
                  color: #4a5568;
                  padding-left: 20px;
              }
              .instructions li {
                  margin: 8px 0;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="success-icon">🎉</div>
              <h1>Authentication Complete!</h1>
              <p class="subtitle">Welcome to xytekclassroom</p>
              
              <div class="user-info">
                  <p><strong>👤 Name:</strong> ${user.userData.name}</p>
                  <p><strong>📧 Email:</strong> ${user.userData.email}</p>
                  <p><strong>🎯 Role:</strong> ${user.userData.role}</p>
              </div>
              
              <a href="${deepLinkUrl}" class="button">
                  🚀 Open xytekclassroom App
              </a>
              
              <div class="instructions">
                  <h3>📱 What happens next?</h3>
                  <ol>
                      <li>Tap the button above to open the app</li>
                      <li>The app will automatically authenticate you</li>
                      <li>You'll be logged in and ready to use</li>
                  </ol>
              </div>
              
              <p style="color: #718096; font-size: 14px; margin-top: 30px;">
                  If the app doesn't open automatically, tap the button above.
              </p>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Error in mobile callback:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Authentication Failed</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #e53e3e;">❌ Authentication Failed</h1>
          <p>Something went wrong during authentication. Please try again.</p>
      </body>
      </html>
    `);
  }
};

// Get Google OAuth URL
const getAuthUrl = (req, res) => {
  const { role, platform } = req.query;
  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role. Must be either "teacher", "student", or "super_admin"'
    });
  }

  let url;
  
  if (platform === 'mobile') {
    // For mobile, manually construct the OAuth URL with the mobile callback
    const mobileOAuthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://class.xytek.ai/api/auth/google/mobile-callback'
    );
    
    url = mobileOAuthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/classroom.courses',
        'https://www.googleapis.com/auth/classroom.coursework.students',
        'https://www.googleapis.com/auth/classroom.announcements',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/meetings',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/forms.body',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/classroom.rosters',
        'https://www.googleapis.com/auth/classroom.announcements',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ],
      prompt: 'consent',
      state: role
    });
  } else {
    // For web, use the web OAuth client
    url = webOAuthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/classroom.courses',
        'https://www.googleapis.com/auth/classroom.coursework.students',
        'https://www.googleapis.com/auth/classroom.announcements',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/meetings',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/forms.body',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/classroom.rosters',
        'https://www.googleapis.com/auth/classroom.announcements',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ],
      prompt: 'consent',
      state: role
    });
  }
  
  console.log('🔗 Generated OAuth URL:', {
    platform: platform || 'web',
    role: role,
    url: url
  });
  
  res.json({ url });
};

// Log deep link interactions for debugging
const logDeepLinkInteraction = async (req, res) => {
  try {
    const logData = req.body;
    
    console.log('📊 Deep Link Interaction Log:', {
      type: logData.type,
      deepLinkUrl: logData.deepLinkUrl,
      userRole: logData.userRole,
      userEmail: logData.userEmail,
      timestamp: logData.timestamp,
      userAgent: logData.userAgent,
      ip: req.ip,
      headers: {
        'user-agent': req.headers['user-agent'],
        'referer': req.headers.referer,
        'origin': req.headers.origin
      }
    });
    
    // Store log in database or file for analysis
    // You can implement persistent logging here
    
    res.json({
      success: true,
      message: 'Deep link interaction logged',
      logId: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Deep link logging error:', error);
    res.status(500).json({
      success: false,
      error: 'LoggingFailed',
      message: error.message
    });
  }
};

// Test endpoint for deep link functionality
const testDeepLink = (req, res) => {
  try {
    const { role = 'teacher', email = 'test@example.com', name = 'Test User' } = req.query;
    
    // Generate a test JWT token
    const testToken = jwt.sign({
      email: email,
      name: name,
      role: role,
      sub: 'test-user-id',
      iat: Math.floor(Date.now() / 1000),
    }, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '1h',
      algorithm: 'HS256'
    });

    const deepLinkUrl = `xytekclassroom://auth?token=${encodeURIComponent(testToken)}&role=${encodeURIComponent(role)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=https://example.com/avatar.jpg`;
    
    console.log('🧪 Test deep link generated:', {
      role,
      email,
      name,
      tokenLength: testToken.length,
      deepLinkUrl
    });
    
    const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deep Link Test</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
        }
        .container { 
            max-width: 500px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.1); 
            padding: 30px; 
            border-radius: 15px; 
            backdrop-filter: blur(10px);
        }
        .test-button {
            background: rgba(255,255,255,0.2);
            border: 2px solid white;
            color: white;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            cursor: pointer;
            margin: 10px;
            transition: all 0.3s ease;
        }
        .test-button:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        .debug-info {
            margin-top: 20px;
            padding: 15px;
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            font-size: 12px;
            text-align: left;
        }
        .copy-button {
            background: rgba(255,255,255,0.2);
            border: 1px solid white;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            cursor: pointer;
            margin-left: 10px;
            font-size: 10px;
        }
        .status {
            margin-top: 20px;
            padding: 15px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>🧪 Deep Link Test</h2>
        <p>Test the deep link functionality for mobile OAuth</p>
        
        <button class="test-button" onclick="testDeepLink()">
            Test Deep Link
        </button>
        
        <button class="test-button" onclick="testErrorDeepLink()">
            Test Error Deep Link
        </button>
        
        <div id="status" class="status">
            <p id="statusText"></p>
        </div>
        
        <div class="debug-info">
            <strong>Test Parameters:</strong><br>
            Role: ${role}<br>
            Email: ${email}<br>
            Name: ${name}<br>
            Token Length: ${testToken.length} characters<br>
            <br>
            <strong>Deep Link URL:</strong><br>
            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; word-break: break-all;">
                <span id="linkText">${deepLinkUrl}</span>
                <button class="copy-button" onclick="copyLink()">Copy</button>
            </div>
            <br>
            <small>Make sure your mobile app has the URL scheme 'xytekclassroom://' configured.</small>
        </div>
    </div>
    
    <script>
        console.log('🧪 Deep link test page loaded');
        console.log('🔗 Test deep link URL:', '${deepLinkUrl}');
        
        function testDeepLink() {
            const deepLinkUrl = '${deepLinkUrl}';
            
            document.getElementById('statusText').innerHTML = \`
                <strong>Testing Deep Link:</strong><br>
                <code>\${deepLinkUrl}</code><br><br>
                <strong>Status:</strong> Attempting to open app...
            \`;
            document.getElementById('status').style.display = 'block';
            
            try {
                // Try to open the deep link
                console.log('🔗 Attempting to open deep link:', deepLinkUrl);
                window.location.href = deepLinkUrl;
                
                // Check if app opened after a delay
                setTimeout(() => {
                    document.getElementById('statusText').innerHTML += '<br><br><strong>Result:</strong> Deep link attempted. Check if your mobile app opened.';
                }, 2000);
            } catch (error) {
                console.error('❌ Deep link failed:', error);
                document.getElementById('statusText').innerHTML += '<br><br><strong>Error:</strong> ' + error.message;
            }
        }
        
        function testErrorDeepLink() {
            const errorMessage = 'Authentication failed - Invalid credentials';
            const deepLinkUrl = \`xytekclassroom://auth?error=\${encodeURIComponent(errorMessage)}\`;
            
            document.getElementById('statusText').innerHTML = \`
                <strong>Testing Error Deep Link:</strong><br>
                <code>\${deepLinkUrl}</code><br><br>
                <strong>Status:</strong> Attempting to open app with error...
            \`;
            document.getElementById('status').style.display = 'block';
            
            try {
                console.log('🔗 Attempting to open error deep link:', deepLinkUrl);
                window.location.href = deepLinkUrl;
                
                setTimeout(() => {
                    document.getElementById('statusText').innerHTML += '<br><br><strong>Result:</strong> Error deep link attempted. Check if your mobile app opened with error handling.';
                }, 2000);
            } catch (error) {
                console.error('❌ Error deep link failed:', error);
                document.getElementById('statusText').innerHTML += '<br><br><strong>Error:</strong> ' + error.message;
            }
        }
        
        function copyLink() {
            const linkText = document.getElementById('linkText').textContent;
            navigator.clipboard.writeText(linkText).then(() => {
                const btn = document.querySelector('.copy-button');
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = linkText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                const btn = document.querySelector('.copy-button');
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            });
        }
        
        // Detect if page becomes hidden (user switched to app)
        document.addEventListener('visibilitychange', function() {
            console.log('👁️ Visibility changed:', document.hidden ? 'hidden' : 'visible');
            if (document.hidden) {
                console.log('✅ Page became hidden - app may have opened!');
                document.getElementById('statusText').innerHTML += '<br><br><strong>✅ Success:</strong> Page became hidden - app may have opened!';
            }
        });
        
        // Detect if page loses focus (user switched to another app)
        window.addEventListener('blur', function() {
            console.log('🔀 Page lost focus - user switched to another app!');
            document.getElementById('statusText').innerHTML += '<br><br><strong>✅ Success:</strong> Page lost focus - user switched to another app!';
        });
        
        // Listen for page focus (user returned to this page)
        window.addEventListener('focus', function() {
            console.log('🎯 Page gained focus - user returned');
        });
        
        console.log('📱 Deep link test setup complete');
    </script>
</body>
</html>`;

    console.log('🧪 Sending test deep link HTML response');
    
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlResponse);
    
  } catch (error) {
    console.error('❌ Test deep link error:', error);
    res.status(500).json({
      success: false,
      error: 'TestFailed',
      message: error.message
    });
  }
};

module.exports = {
  getAuthUrl,
  handleWebAuth,
  handleMobileAuth,
  handleMobileCallback,
  logDeepLinkInteraction,
  testDeepLink
};
