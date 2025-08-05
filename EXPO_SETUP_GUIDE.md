# 📱 Expo Mobile Authentication Setup Guide

This guide shows how to implement Google OAuth authentication in your Expo mobile app using your existing Node.js backend.

## 🏗️ **Architecture Overview**

```
Expo App → Google OAuth → Your Backend → Expo App
```

1. **Expo App** requests OAuth URL from your backend
2. **Google OAuth** handles authentication
3. **Your Backend** exchanges code for tokens
4. **Expo App** receives user data and JWT token

## 📋 **Prerequisites**

- Node.js backend running at `https://class.xytek.ai`
- Google OAuth app configured
- Expo CLI installed

## 🚀 **Step 1: Create Expo Project**

```bash
# Create new Expo project
npx create-expo-app ai-classroom-mobile
cd ai-classroom-mobile

# Install required dependencies
npm install expo-web-browser expo-auth-session expo-crypto expo-secure-store expo-constants
```

## 🔧 **Step 2: Configure App**

### Update `app.json`:
```json
{
  "expo": {
    "name": "AI Classroom Assistant",
    "slug": "ai-classroom-mobile",
    "scheme": "aiclassroom",
    "plugins": ["expo-web-browser"]
  }
}
```

### Update `package.json`:
```json
{
  "dependencies": {
    "expo": "~49.0.0",
    "expo-web-browser": "~12.3.2",
    "expo-auth-session": "~5.0.2",
    "expo-secure-store": "~12.3.1"
  }
}
```

## 🔑 **Step 3: Google OAuth Configuration**

### 1. Google Cloud Console Setup:
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Navigate to **APIs & Services** > **Credentials**
- Edit your OAuth 2.0 Client ID
- Add these **Authorized redirect URIs**:
  ```
  https://class.xytek.ai/api/auth/google/callback
  https://class.xytek.ai/api/auth/google/mobile-callback
  aiclassroom://auth/callback
  ```

### 2. Update Backend Environment Variables:
```bash
# On your backend server (https://class.xytek.ai)
NODE_ENV=production
FRONTEND_URL=https://js-two-beta.vercel.app
BACKEND_URL=https://class.xytek.ai
```

## 📱 **Step 4: Implement Authentication**

### Install WebView dependency:
```bash
npm install react-native-webview
```

### Create `screens/AuthScreen.js`:
```javascript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { WebView } from 'react-native-webview';

const BACKEND_URL = 'https://class.xytek.ai';

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [oauthUrl, setOauthUrl] = useState('');

  const handleMobileAuth = async (role) => {
    setLoading(true);
    
    try {
      // Step 1: Get OAuth URL from backend (specify mobile platform)
      const response = await fetch(`${BACKEND_URL}/api/auth/google?role=${role}&platform=mobile`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get OAuth URL');
      }

      // Step 2: Show WebView with OAuth URL
      setOauthUrl(data.url);
      setShowWebView(true);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle WebView message (authorization code)
  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'success' && data.code) {
        setShowWebView(false);
        
        // Step 3: Exchange code for token
        await exchangeCodeForToken(data.code, data.state);
      } else if (data.type === 'error') {
        setShowWebView(false);
        Alert.alert('Authentication Error', data.error);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const exchangeCodeForToken = async (code, role) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google/mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, role })
      });

      const data = await response.json();

      if (data.success) {
        // Store tokens securely
        await SecureStore.setItemAsync('authToken', data.token);
        await SecureStore.setItemAsync('userData', JSON.stringify(data.user));
        
        Alert.alert('Success', `Welcome ${data.user.name}!`);
        // Navigate to main app
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // If WebView is shown, render it
  if (showWebView) {
    return (
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: oauthUrl }}
          onMessage={handleWebViewMessage}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setShowWebView(false)}
        >
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Classroom Assistant</Text>
      
      <TouchableOpacity
        style={[styles.button, styles.teacherButton]}
        onPress={() => handleMobileAuth('teacher')}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Signing in...' : 'Sign in as Teacher'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.studentButton]}
        onPress={() => handleMobileAuth('student')}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Signing in...' : 'Sign in as Student'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.adminButton]}
        onPress={() => handleMobileAuth('super_admin')}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Signing in...' : 'Sign in as Admin'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#ff4444',
    padding: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 8,
    width: 250,
    alignItems: 'center',
  },
  teacherButton: { backgroundColor: '#4285f4' },
  studentButton: { backgroundColor: '#34a853' },
  adminButton: { backgroundColor: '#ea4335' },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## 🔧 **Step 5: Backend API Endpoints**

Your backend already has these endpoints:

### GET `/api/auth/google?role={role}`
- Returns OAuth URL for the specified role
- Used by mobile app to get authentication URL

### POST `/api/auth/google/mobile`
- Accepts `{ code, role }` in request body
- Returns `{ success: true, token, user }`
- Used by mobile app to exchange authorization code

## 🧪 **Step 6: Testing**

### 1. Start Expo Development Server:
```bash
npx expo start
```

### 2. Test on Device/Simulator:
- Scan QR code with Expo Go app
- Or press 'i' for iOS simulator, 'a' for Android

### 3. Test Authentication Flow:
1. Tap "Sign in as Teacher"
2. Complete Google OAuth in browser
3. Return to app with user data

## 🔒 **Step 7: Security Considerations**

### Token Storage:
```javascript
// Store tokens securely
await SecureStore.setItemAsync('authToken', token);
await SecureStore.setItemAsync('userData', JSON.stringify(userData));

// Retrieve tokens
const token = await SecureStore.getItemAsync('authToken');
const userData = JSON.parse(await SecureStore.getItemAsync('userData'));
```

### API Calls with Token:
```javascript
const makeAuthenticatedRequest = async (endpoint) => {
  const token = await SecureStore.getItemAsync('authToken');
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
};
```

## 🚀 **Step 8: Production Deployment**

### 1. Build for Production:
```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

### 2. Update Google OAuth:
- Add production app bundle ID to Google OAuth
- Update redirect URIs for production

### 3. Environment Variables:
- Ensure backend has correct production URLs
- Test OAuth flow in production environment

## 🔍 **Debugging**

### Common Issues:

1. **"Invalid redirect URI"**:
   - Check Google OAuth configuration
   - Verify redirect URI matches exactly

2. **"Authentication failed"**:
   - Check backend logs
   - Verify environment variables
   - Test backend endpoints directly

3. **"Network error"**:
   - Check backend URL
   - Verify CORS configuration
   - Test network connectivity

### Debug Logs:
```javascript
console.log('🔗 OAuth URL:', oauthUrl);
console.log('🔍 Auth Result:', result);
console.log('✅ Authorization code:', code);
console.log('🎯 User data:', userData);
```

## 📚 **Additional Resources**

- [Expo AuthSession Documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Expo WebBrowser Documentation](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)

## 🎯 **Next Steps**

1. Implement user profile management
2. Add role-based navigation
3. Implement token refresh logic
4. Add offline support
5. Implement push notifications

Your mobile app is now ready to authenticate users using your existing backend! 🚀 