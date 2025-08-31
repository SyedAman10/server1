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

// Handle Mobile Callback (for OAuth redirect) - Redirects directly to deep link
const handleMobileCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('🔍 Mobile callback received:', { 
      code: code ? `${code.substring(0, 10)}...` : 'undefined', 
      state,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
      timestamp: new Date().toISOString()
    });
    
    if (!code) {
      console.log('❌ No code received');
      // Redirect directly to error deep link
      const errorDeepLink = `xytekclassroom://auth?error=${encodeURIComponent('No authorization code received')}`;
      console.log('🔄 Redirecting directly to error deep link:', errorDeepLink);
      return res.redirect(errorDeepLink);
    }

    // Validate the authorization code
    if (code.length < 10) {
      console.log('❌ Invalid code received');
      const errorDeepLink = `xytekclassroom://auth?error=${encodeURIComponent('Invalid authorization code')}`;
      console.log('🔄 Redirecting directly to error deep link:', errorDeepLink);
      return res.redirect(errorDeepLink);
    }

    if (!state || !VALID_ROLES.includes(state)) {
      console.log('❌ Invalid role in state:', state);
      const errorDeepLink = `xytekclassroom://auth?error=${encodeURIComponent('Invalid role in state parameter')}`;
      console.log('🔄 Redirecting directly to error deep link:', errorDeepLink);
      return res.redirect(errorDeepLink);
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

    // Send HTML page that handles deep linking more robustly
    console.log('🚀 Sending HTML page with robust deep linking...');
    
    const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Opening Mobile App</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { 
            max-width: 400px; 
            background: rgba(255,255,255,0.1); 
            padding: 30px; 
            border-radius: 15px; 
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .spinner { 
            border: 3px solid rgba(255,255,255,0.3); 
            border-top: 3px solid white; 
            border-radius: 50%; 
            width: 40px; 
            height: 40px; 
            animation: spin 1s linear infinite; 
            margin: 20px auto; 
        }
        @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        }
        .status {
            margin: 20px 0;
            padding: 15px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            font-size: 14px;
        }
        .fallback {
            margin-top: 20px;
            padding: 15px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            display: none;
        }
        .fallback a { 
            color: white; 
            text-decoration: none; 
            font-weight: bold; 
            display: inline-block;
            padding: 10px 20px;
            background: rgba(255,255,255,0.2);
            border-radius: 5px;
            margin: 5px;
        }
        .deep-link-info {
            margin-top: 20px;
            padding: 15px;
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            font-size: 12px;
            text-align: left;
            word-break: break-all;
            display: none;
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
        .debug-info {
            margin-top: 20px;
            padding: 15px;
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            font-size: 11px;
            text-align: left;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>📱 Opening Mobile App</h2>
        <p>Redirecting to your mobile app...</p>
        <div class="spinner"></div>
        
        <div class="status" id="status">
            Processing authentication...
        </div>
        
        <div class="fallback" id="fallback">
            <p><strong>If the app doesn't open automatically:</strong></p>
            <a href="${deepLinkUrl}" id="deepLinkBtn">🔗 Click to Open App</a>
            <br><br>
            <a href="#" id="copyLinkBtn">📋 Copy Deep Link</a>
            <br><br>
            <a href="#" id="showDebugBtn">🐛 Show Debug Info</a>
        </div>
        
        <div class="deep-link-info" id="deepLinkInfo">
            <strong>Deep Link:</strong><br>
            <span id="linkText">${deepLinkUrl}</span>
            <button class="copy-button" onclick="copyDeepLink()">Copy</button>
        </div>
        
        <div class="debug-info" id="debugInfo">
            <strong>Debug Information:</strong><br>
            <div id="debugContent"></div>
        </div>
    </div>
    
    <script>
        console.log('📱 OAuth callback page loaded');
        console.log('🔗 Deep link URL:', '${deepLinkUrl}');
        
        let appOpened = false;
        let redirectAttempted = false;
        let redirectCount = 0;
        const maxRedirects = 3;
        
        // Update status
        function updateStatus(message, type = 'info') {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.className = \`status \${type}\`;
        }
        
        // Show fallback
        function showFallback() {
            document.getElementById('fallback').style.display = 'block';
        }
        
        // Show deep link info
        function showDeepLinkInfo() {
            document.getElementById('deepLinkInfo').style.display = 'block';
        }
        
        // Show debug info
        function showDebugInfo() {
            const debugDiv = document.getElementById('debugInfo');
            const debugContent = document.getElementById('debugContent');
            
            debugContent.innerHTML = \`
                <strong>User Agent:</strong> \${navigator.userAgent}<br>
                <strong>Platform:</strong> \${navigator.platform}<br>
                <strong>Language:</strong> \${navigator.language}<br>
                <strong>Cookie Enabled:</strong> \${navigator.cookieEnabled}<br>
                <strong>Online:</strong> \${navigator.onLine}<br>
                <strong>Deep Link:</strong> \${deepLinkUrl}<br>
                <strong>Redirect Count:</strong> \${redirectCount}<br>
                <strong>App Opened:</strong> \${appOpened}<br>
                <strong>Redirect Attempted:</strong> \${redirectAttempted}
            \`;
            
            debugDiv.style.display = 'block';
        }
        
        // Copy deep link
        function copyDeepLink() {
            const linkText = document.getElementById('linkText').textContent;
            navigator.clipboard.writeText(linkText).then(() => {
                const btn = document.querySelector('.copy-button');
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            }).catch(err => {
                console.log('Copy failed, using fallback');
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
        
        // Attempt to open app
        function attemptAppOpen() {
            if (redirectCount >= maxRedirects) {
                updateStatus('❌ Maximum redirect attempts reached. Please use the manual link below.', 'error');
                showFallback();
                return;
            }
            
            redirectCount++;
            console.log(\`🚀 Attempt \${redirectCount} to open mobile app...\`);
            updateStatus(\`🔄 Attempting to open app... (Attempt \${redirectCount}/\${maxRedirects})\`);
            
            // Try different methods to open the app
            try {
                // Method 1: Direct location change
                window.location.href = "${deepLinkUrl}";
                
                // Method 2: Try with a small delay
                setTimeout(() => {
                    if (!appOpened) {
                        console.log('🔄 Trying alternative redirect method...');
                        window.location.replace("${deepLinkUrl}");
                    }
                }, 1000);
                
                // Method 3: Try with iframe (for some mobile browsers)
                setTimeout(() => {
                    if (!appOpened) {
                        console.log('🔄 Trying iframe method...');
                        const iframe = document.createElement('iframe');
                        iframe.style.display = 'none';
                        iframe.src = "${deepLinkUrl}";
                        document.body.appendChild(iframe);
                        setTimeout(() => {
                            if (iframe.parentNode) {
                                iframe.parentNode.removeChild(iframe);
                            }
                        }, 2000);
                    }
                }, 2000);
                
            } catch (error) {
                console.error('❌ Error during redirect:', error);
                updateStatus(\`❌ Redirect error: \${error.message}\`, 'error');
            }
        }
        
        // Event listeners for app detection
        document.addEventListener('visibilitychange', function() {
            console.log('👁️ Visibility changed:', document.hidden ? 'hidden' : 'visible');
            if (document.hidden && !appOpened) {
                appOpened = true;
                console.log('✅ App may have opened - page became hidden');
                updateStatus('✅ App opened successfully!', 'success');
            }
        });
        
        window.addEventListener('blur', function() {
            console.log('🔀 Page lost focus - user switched to another app');
            if (!appOpened) {
                appOpened = true;
                console.log('✅ App may have opened - page lost focus');
                updateStatus('✅ App opened successfully!', 'success');
            }
        });
        
        window.addEventListener('focus', function() {
            console.log('🎯 Page gained focus - user returned');
            if (appOpened) {
                console.log('🔄 User returned to page after app opened');
            }
        });
        
        // Button event listeners
        document.getElementById('deepLinkBtn').addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔗 Manual deep link button clicked');
            attemptAppOpen();
        });
        
        document.getElementById('copyLinkBtn').addEventListener('click', function(e) {
            e.preventDefault();
            console.log('📋 Copy link button clicked');
            copyDeepLink();
        });
        
        document.getElementById('showDebugBtn').addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🐛 Show debug button clicked');
            showDebugInfo();
        });
        
        // Start the process
        updateStatus('✅ Authentication successful! Opening mobile app...', 'success');
        showDeepLinkInfo();
        
        // Attempt to open app immediately
        attemptAppOpen();
        
        // Show fallback after 3 seconds
        setTimeout(function() {
            if (!appOpened) {
                console.log('⏰ Showing fallback options');
                showFallback();
            }
        }, 3000);
        
        // Final fallback after 8 seconds
        setTimeout(function() {
            if (!appOpened) {
                console.log('⏰ Final fallback - showing all options');
                updateStatus('⚠️ App may not have opened. Please use the manual options below.', 'error');
                showFallback();
            }
        }, 8000);
        
        console.log('📱 Deep link redirect setup complete');
    </script>
</body>
</html>`;

    // Send HTML response that handles deep linking robustly
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlResponse);

  } catch (error) {
    console.error('❌ Mobile callback error:', error);
    
    // Generate error deep link
    const errorDeepLink = `xytekclassroom://auth?error=${encodeURIComponent(error.message)}`;
    
    console.log('🚀 Redirecting to error deep link:', errorDeepLink);
    
    // Send HTML page that redirects to error deep link
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Error</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            margin: 0;
        }
        .container { 
            max-width: 400px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.1); 
            padding: 30px; 
            border-radius: 15px; 
            backdrop-filter: blur(10px);
        }
        .fallback {
            margin-top: 20px;
            padding: 15px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
        }
        .fallback a { 
            color: white; 
            text-decoration: none; 
            font-weight: bold; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>❌ Authentication Error</h2>
        <p>Something went wrong during authentication.</p>
        <p>Error: ${error.message}</p>
        
        <div class="fallback">
            <p>Redirecting to app with error...</p>
            <a href="${errorDeepLink}">Click here to return to app</a>
        </div>
    </div>
    
    <script>
        console.log('❌ Error page loaded');
        console.log('🚨 Error:', '${error.message}');
        
        // Redirect to error deep link after a short delay
        setTimeout(() => {
            console.log('🚀 Redirecting to error deep link...');
            window.location.href = "${errorDeepLink}";
        }, 2000);
    </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(errorHtml);
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
