# Mobile OAuth Setup Guide

## Problem
Currently, when mobile authentication completes, it redirects to a web page that displays the JWT token instead of sending it directly to the frontend. This creates a poor user experience and security concerns.

## Solution: Deep Links with Custom URL Scheme

### 1. Mobile App Configuration

#### For React Native (Expo):
```javascript
// app.json or app.config.js
{
  "expo": {
    "scheme": "xytekclassroom",
    "ios": {
      "bundleIdentifier": "com.yourcompany.xytekclassroom"
    },
    "android": {
      "package": "com.yourcompany.xytekclassroom"
    }
  }
}
```

#### For Native iOS:
```xml
<!-- Info.plist -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.yourcompany.xytekclassroom</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>xytekclassroom</string>
    </array>
  </dict>
</array>
```

#### For Native Android:
```xml
<!-- AndroidManifest.xml -->
<activity android:name=".MainActivity">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="xytekclassroom" />
  </intent-filter>
</activity>
```

### 2. Handle Deep Links in Mobile App

#### React Native (Expo):
```javascript
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';

// In your App.js or main component
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
  if (url) {
    const route = url.replace('xytekclassroom://', '');
    const parts = route.split('?')[1];
    const params = new URLSearchParams(parts);
    
    const token = params.get('token');
    const role = params.get('role');
    const email = params.get('email');
    const name = params.get('name');
    const picture = params.get('picture');
    
    if (token) {
      // Store the JWT token
      AsyncStorage.setItem('authToken', token);
      AsyncStorage.setItem('userRole', role);
      AsyncStorage.setItem('userEmail', email);
      AsyncStorage.setItem('userName', name);
      AsyncStorage.setItem('userPicture', picture);
      
      // Navigate to appropriate screen
      navigation.navigate('Dashboard');
    } else if (params.get('error')) {
      // Handle error
      const error = params.get('error');
      Alert.alert('Authentication Error', error);
    }
  }
};
```

#### Native iOS (Swift):
```swift
// AppDelegate.swift
func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    if url.scheme == "xytekclassroom" {
        handleDeepLink(url: url)
        return true
    }
    return false
}

func handleDeepLink(url: URL) {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
          let queryItems = components.queryItems else { return }
    
    var token: String?
    var role: String?
    var email: String?
    var name: String?
    var picture: String?
    
    for item in queryItems {
        switch item.name {
        case "token": token = item.value
        case "role": role = item.value
        case "email": email = item.value
        case "name": name = item.value
        case "picture": picture = item.value
        default: break
        }
    }
    
    if let token = token {
        // Store the JWT token
        UserDefaults.standard.set(token, forKey: "authToken")
        UserDefaults.standard.set(role, forKey: "userRole")
        UserDefaults.standard.set(email, forKey: "userEmail")
        UserDefaults.standard.set(name, forKey: "userName")
        UserDefaults.standard.set(picture, forKey: "userPicture")
        
        // Post notification to update UI
        NotificationCenter.default.post(name: .userAuthenticated, object: nil)
    }
}
```

#### Native Android (Kotlin):
```kotlin
// MainActivity.kt
override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    handleIntent(intent)
}

override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleIntent(intent)
}

private fun handleIntent(intent: Intent?) {
    val data = intent?.data
    if (data?.scheme == "xytekclassroom") {
        val token = data.getQueryParameter("token")
        val role = data.getQueryParameter("role")
        val email = data.getQueryParameter("email")
        val name = data.getQueryParameter("name")
        val picture = data.getQueryParameter("picture")
        
        if (token != null) {
            // Store the JWT token
            val sharedPref = getSharedPreferences("auth", Context.MODE_PRIVATE)
            with(sharedPref.edit()) {
                putString("authToken", token)
                putString("userRole", role)
                putString("userEmail", email)
                putString("userName", name)
                putString("userPicture", picture)
                apply()
            }
            
            // Navigate to appropriate screen
            startActivity(Intent(this, DashboardActivity::class.java))
            finish()
        }
    }
}
```

### 3. OAuth Flow Implementation

#### Step 1: Start OAuth
```javascript
// In your mobile app
const startOAuth = async (role) => {
  try {
    // Get OAuth URL from your backend
    const response = await fetch('https://class.xytek.ai/api/auth/google?role=' + role + '&platform=mobile');
    const data = await response.json();
    
    // Open OAuth URL in browser
    await Linking.openURL(data.url);
  } catch (error) {
    console.error('Error starting OAuth:', error);
  }
};
```

#### Step 2: User completes OAuth in browser
- Google redirects to your callback URL: `https://class.xytek.ai/api/auth/google/mobile-callback`
- Your backend processes the OAuth callback
- Backend generates JWT and creates HTML page with deep link
- HTML page automatically redirects to `xytekclassroom://auth?token=...`
- Mobile app opens and receives the JWT token

### 4. Alternative: Universal Links (iOS) / App Links (Android)

For production apps, consider using Universal Links (iOS) or App Links (Android) instead of custom URL schemes:

#### Universal Links (iOS):
```json
// apple-app-site-association file on your domain
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.yourcompany.xytekclassroom",
        "paths": ["/auth/*"]
      }
    ]
  }
}
```

#### App Links (Android):
```xml
<!-- AndroidManifest.xml -->
<activity android:name=".MainActivity">
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" 
          android:host="class.xytek.ai" 
          android:pathPrefix="/auth" />
  </intent-filter>
</activity>
```

### 5. Testing

#### Test Deep Links:
```bash
# iOS Simulator
xcrun simctl openurl booted "xytekclassroom://auth?token=test&role=teacher"

# Android Emulator
adb shell am start -W -a android.intent.action.VIEW -d "xytekclassroom://auth?token=test&role=teacher" com.yourcompany.xytekclassroom
```

#### Test OAuth Flow:
1. Start OAuth from mobile app
2. Complete authentication in browser
3. Verify app opens with JWT token
4. Check token is stored correctly

### 6. Security Considerations

1. **JWT Expiration**: Set appropriate expiration times
2. **HTTPS Only**: Always use HTTPS in production
3. **Token Storage**: Use secure storage (Keychain for iOS, EncryptedSharedPreferences for Android)
4. **Validation**: Validate JWT on backend for each request
5. **Refresh Tokens**: Implement refresh token mechanism

### 7. Production Checklist

- [ ] Custom URL scheme configured
- [ ] Deep link handling implemented
- [ ] JWT token storage implemented
- [ ] Error handling implemented
- [ ] HTTPS configured
- [ ] App store metadata updated
- [ ] Testing completed on real devices
- [ ] Fallback mechanisms implemented

This solution ensures that:
1. ✅ JWT tokens are sent directly to the mobile app
2. ✅ No web pages display sensitive tokens
3. ✅ Works in production environments
4. ✅ Provides smooth user experience
5. ✅ Handles errors gracefully
6. ✅ Follows OAuth best practices
