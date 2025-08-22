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

// Handle Mobile Authentication
const handleMobileAuth = async (req, res) => {
  try {
    const { code, role } = req.body;
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be either "teacher", "student", or "super_admin"'
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
      error: 'Authentication failed'
    });
  }
};

// Handle Mobile Callback (for OAuth redirect)
const handleMobileCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('Mobile callback received:', { code, state });
    
    // Use environment variable for Expo returnRL, fallback to localhost:8082
    const EXPO_RETURN_URL = process.env.EXPO_RETURN_URL || 'exp://127.0.0.1:8081/--/auth/callback';
    
    console.log('🔗 Using Expo return URL:', EXPO_RETURN_URL);

    if (!code) {
      // Redirect with error
      console.log('❌ No code received, redirecting with error');
      return res.redirect(`${EXPO_RETURN_URL}?error=NoCode&state=${state || 'unknown'}`);
    }

    // Validate the authorization code
    if (code.length < 10) {
      console.log('❌ Invalid code received, redirecting with error');
      return res.redirect(`${EXPO_RETURN_URL}?error=InvalidCode&state=${state || 'unknown'}`);
    }

    // Check if the request wants JSON response (mobile app can set this header)
    const wantsJson = req.headers['accept'] && req.headers['accept'].includes('application/json');
    
    if (wantsJson) {
      // Return JSON response for mobile apps that can't handle redirects
      console.log('📱 Mobile app requested JSON response');
      return res.json({
        success: true,
        code: code,
        state: state,
        redirectUrl: `${EXPO_RETURN_URL}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || 'unknown')}`,
        message: 'Authorization code received successfully'
      });
    }

    // Redirect to Expo return URL with code and state
    console.log('✅ Code received, redirecting to Expo with code and state');
    const redirectUrl = `${EXPO_RETURN_URL}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || 'unknown')}`;
    console.log('🔄 Full redirect URL:', redirectUrl);
    
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Mobile callback error:', error);
    const EXPO_RETURN_URL = process.env.EXPO_RETURN_URL || 'exp://127.0.0.1:8081/--/auth/callback';
    console.log('❌ Error occurred, redirecting to Expo with error');
    
    // Check if the request wants JSON response
    const wantsJson = req.headers['accept'] && req.headers['accept'].includes('application/json');
    
    if (wantsJson) {
      return res.json({
        success: false,
        error: 'AuthFailed',
        message: error.message,
        redirectUrl: `${EXPO_RETURN_URL}?error=AuthFailed&message=${encodeURIComponent(error.message)}`
      });
    }
    
    return res.redirect(`${EXPO_RETURN_URL}?error=AuthFailed&message=${encodeURIComponent(error.message)}`);
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

  // Use different OAuth client based on platform
  const oauthClient = platform === 'mobile' ? mobileOAuthClient : webOAuthClient;

  const url = oauthClient.generateAuthUrl({
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
  
  console.log('🔗 Generated OAuth URL:', {
    platform: platform || 'web',
    role: role,
    url: url
  });
  
  res.json({ url });
};

module.exports = {
  getAuthUrl,
  handleWebAuth,
  handleMobileAuth,
  handleMobileCallback
};
