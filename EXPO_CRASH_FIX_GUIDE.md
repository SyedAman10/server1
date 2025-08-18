# 🚨 Expo App Crash After OAuth Redirect - Fix Guide

## Problem Description
Your Expo app is crashing and showing a blue reloader after the OAuth redirect from Google. The backend is working correctly and redirecting to `exp://localhost:8082/--/auth/callback`, but the app can't handle the deep link properly.

## 🔧 Backend Fixes Applied

### 1. Updated Redirect URL
- ✅ Changed from `exp://192.168.100.75:8081/--/auth/callback` to `exp://localhost:8082/--/auth/callback`
- ✅ Added environment variable support: `EXPO_RETURN_URL`
- ✅ Enhanced error handling and logging

### 2. Improved Mobile Callback
- ✅ Added JSON response option for mobile apps
- ✅ Better error handling with detailed messages
- ✅ State parameter preservation
- ✅ Code validation

## 📱 Expo App Fixes Required

### 1. Deep Link Configuration
Make sure your `app.json` has the correct deep link scheme:

```json
{
  "expo": {
    "scheme": "your-app-scheme",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "your-app-scheme"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### 2. Deep Link Handler
Update your deep link handler to properly handle the OAuth callback:

```javascript
import * as Linking from 'expo-linking';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Handle deep links when app is already running
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Handle deep links when app is opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => subscription?.remove();
  }, []);

  const handleDeepLink = ({ url }) => {
    console.log('🔗 Deep link received:', url);
    
    try {
      const parsed = Linking.parse(url);
      console.log('📱 Parsed deep link:', parsed);
      
      // Handle OAuth callback
      if (parsed.path === '--/auth/callback') {
        const { code, state, error, message } = parsed.queryParams;
        
        if (error) {
          console.error('❌ OAuth error:', error, message);
          // Handle error (show error message, redirect to login, etc.)
          handleOAuthError(error, message);
        } else if (code) {
          console.log('✅ OAuth code received:', code);
          // Handle successful OAuth (exchange code for token, etc.)
          handleOAuthSuccess(code, state);
        }
      }
    } catch (error) {
      console.error('❌ Error parsing deep link:', error);
    }
  };

  const handleOAuthSuccess = async (code, state) => {
    try {
      // Exchange the authorization code for tokens
      const response = await fetch('https://class.xytek.ai/api/auth/google/mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          role: state // state contains the role (student/teacher)
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Mobile auth successful:', data);
        // Store the token and user data
        // Navigate to the appropriate screen
        // handleSuccessfulAuth(data.token, data.user);
      } else {
        console.error('❌ Mobile auth failed:', data.error);
        // Handle authentication failure
      }
    } catch (error) {
      console.error('❌ Error during mobile auth:', error);
    }
  };

  const handleOAuthError = (error, message) => {
    // Handle different error types
    switch (error) {
      case 'NoCode':
        console.error('No authorization code received');
        break;
      case 'InvalidCode':
        console.error('Invalid authorization code');
        break;
      case 'AuthFailed':
        console.error('Authentication failed:', message);
        break;
      default:
        console.error('Unknown OAuth error:', error);
    }
    
    // Show error message to user
    // Navigate back to login screen
  };
}
```

### 3. Alternative: Use JSON Response Instead of Redirect
If deep linking continues to cause issues, modify your mobile app to request JSON responses:

```javascript
const handleOAuthRedirect = async (authUrl) => {
  try {
    // Open the OAuth URL in a web browser
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      'exp://localhost:8082/--/auth/callback'
    );

    if (result.type === 'success') {
      // Extract the authorization code from the URL
      const url = result.url;
      const code = extractCodeFromUrl(url);
      
      if (code) {
        // Exchange the code for tokens directly
        await handleOAuthSuccess(code, 'student'); // or get role from state
      }
    }
  } catch (error) {
    console.error('OAuth redirect error:', error);
  }
};

const extractCodeFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('code');
  } catch (error) {
    console.error('Error extracting code from URL:', error);
    return null;
  }
};
```

## 🧪 Testing the Fix

### 1. Test Deep Link Handling
```bash
# Test the deep link manually
npx uri-scheme open "exp://localhost:8082/--/auth/callback?code=test_code&state=student" --android
```

### 2. Test OAuth Flow
1. Start your Expo app
2. Initiate OAuth login
3. Complete Google authentication
4. Check if the app handles the redirect without crashing

### 3. Check Logs
Monitor both backend and frontend logs for any errors or issues.

## 🔍 Common Issues and Solutions

### Issue 1: App Crashes on Deep Link
**Solution**: Ensure deep link handler is properly set up and handles errors gracefully.

### Issue 2: Deep Link Not Received
**Solution**: Check `app.json` configuration and ensure the scheme matches.

### Issue 3: OAuth Code Not Processed
**Solution**: Verify the deep link parsing logic and OAuth code exchange.

### Issue 4: State Parameter Missing
**Solution**: The backend now preserves and returns the state parameter.

## 📋 Checklist

- [ ] Backend redirect URL updated to `localhost:8082`
- [ ] Deep link scheme configured in `app.json`
- [ ] Deep link handler implemented in the app
- [ ] OAuth success/error handling implemented
- [ ] Error boundaries added to prevent crashes
- [ ] Deep link testing completed
- [ ] OAuth flow testing completed

## 🚀 Next Steps

1. **Update your Expo app** with the deep link handler code above
2. **Test the OAuth flow** to ensure no more crashes
3. **Monitor logs** for any remaining issues
4. **Consider using JSON responses** if deep linking continues to cause problems

## 📞 Support

If you continue to experience issues:
1. Check the backend logs for any errors
2. Verify the deep link configuration
3. Test with a simple deep link first
4. Consider using the JSON response approach as a fallback

The backend is now properly configured and should work seamlessly with your Expo app once the deep link handling is implemented correctly.

