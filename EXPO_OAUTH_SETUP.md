# 🚀 Expo OAuth Dynamic Return URL Setup

## 🔧 **Environment Variables**

Add these to your `.env` file:

```bash
# Backend URL
BACKEND_URL=https://class.xytek.ai

# Frontend URL (for web)
FRONTEND_URL=https://xytek-classroom-assistant.vercel.app

# Mobile OAuth Callback URL
MOBILE_CALLBACK_URL=https://class.xytek.ai/api/auth/google/mobile-callback

# Default Expo Return URL (fallback)
EXPO_RETURN_URL=exp://127.0.0.1:8081/--/auth/callback
```

## 📱 **Frontend Implementation**

### **1. Get OAuth URL with Return URL**

```javascript
const getOAuthUrl = async (role, returnUrl) => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/auth/google?role=${role}&platform=mobile&returnUrl=${encodeURIComponent(returnUrl)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error getting OAuth URL:', error);
    throw error;
  }
};
```

### **2. Use Dynamic Return URL**

```javascript
import { Linking } from 'react-native';

const handleOAuth = async (role) => {
  try {
    // Get your current Expo development URL
    const expoUrl = await Linking.getInitialURL() || 'exp://127.0.0.1:8081/--/auth/callback';
    
    // Get OAuth URL with your return URL
    const oauthUrl = await getOAuthUrl(role, expoUrl);
    
    // Open OAuth in browser
    await Linking.openURL(oauthUrl);
  } catch (error) {
    console.error('OAuth error:', error);
  }
};
```

### **3. Handle OAuth Callback**

```javascript
import { useEffect } from 'react';
import { Linking } from 'react-native';

const handleOAuthCallback = () => {
  useEffect(() => {
    const handleUrl = (url) => {
      if (url) {
        const { code, role, error } = parseUrl(url);
        
        if (code && role) {
          // Exchange code for token
          exchangeCodeForToken(code, role);
        } else if (error) {
          console.error('OAuth error:', error);
        }
      }
    };

    // Handle initial URL
    Linking.getInitialURL().then(handleUrl);
    
    // Handle URL changes
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription?.remove();
  }, []);
};

const parseUrl = (url) => {
  const params = new URLSearchParams(url.split('?')[1]);
  return {
    code: params.get('code'),
    role: params.get('role'),
    error: params.get('error')
  };
};
```

## 🌐 **Backend API Usage**

### **Get OAuth URL**
```bash
GET /api/auth/google?role=teacher&platform=mobile&returnUrl=exp://192.168.1.100:8081/--/auth/callback
```

### **OAuth Callback**
```bash
GET /api/auth/google/mobile-callback?code=AUTH_CODE&state=teacher|exp%3A//192.168.1.100%3A8081/--/auth/callback
```

## 🔄 **How It Works**

1. **Frontend** sends `returnUrl` parameter with OAuth request
2. **Backend** encodes return URL in OAuth state parameter
3. **Google** redirects back to your callback with encoded state
4. **Backend** parses state to extract role and return URL
5. **Backend** redirects to your Expo app with auth code

## 🎯 **Benefits**

- ✅ **No hardcoded URLs** - works with any IP address
- ✅ **Development friendly** - adapts to different environments
- ✅ **Production ready** - works with production URLs
- ✅ **Flexible** - supports multiple return URL sources
- ✅ **Secure** - return URL is validated and encoded

## 🧪 **Testing**

1. Start your Expo development server
2. Note your current IP address (e.g., `192.168.1.100:8081`)
3. Call OAuth with that return URL
4. Complete OAuth flow
5. Should redirect back to your Expo app

## 🚨 **Troubleshooting**

- **Check environment variables** are set correctly
- **Verify return URL format** matches Expo URL scheme
- **Check network** - ensure callback endpoint is accessible
- **Review logs** - backend shows detailed OAuth flow information
