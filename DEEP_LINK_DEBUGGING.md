# Deep Link Debugging Guide (JSON-Based Approach)

## Problem
The deep link is not redirecting to the mobile app when clicked, and we need comprehensive logging to debug this issue.

## What We've Added

### 1. Enhanced Logging in Mobile Callback
- **Backend Logs**: Detailed logging of OAuth callback processing
- **JSON Response**: Returns deep link URL instead of HTML page
- **Frontend Handling**: Frontend automatically redirects using the deep link URL

### 2. New Endpoints
- **`/api/auth/log-deep-link`**: Captures all deep link interactions
- **`/api/auth/test-deep-link`**: Test deep link functionality without OAuth

### 3. JSON Response Format
The mobile callback now returns JSON instead of HTML:

```json
{
  "success": true,
  "deepLinkUrl": "xytekclassroom://auth?token=...&role=teacher&email=...",
  "user": {
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://...",
    "role": "teacher"
  },
  "message": "OAuth completed successfully. Use deepLinkUrl to redirect to mobile app.",
  "redirectInstructions": {
    "method": "window.location.href",
    "example": "window.location.href = \"xytekclassroom://auth?token=...\"",
    "note": "Frontend should automatically redirect using the deepLinkUrl"
  }
}
```

## How to Debug

### Step 1: Test Deep Link Functionality
Visit: `https://class.xytek.ai/api/auth/test-deep-link`

This will show you:
- Test deep link URL
- Copy button for the URL
- Test buttons to trigger deep links
- Real-time status updates

### Step 2: Check Backend Logs
Look for these log entries in your server console:

```
🔍 Mobile callback received: { code: "4/0AfJohX...", state: "teacher", userAgent: "...", referer: "...", timestamp: "..." }
🔄 Exchanging authorization code for tokens...
✅ Tokens received from Google
👤 User info received: { email: "...", name: "..." }
✅ Mobile OAuth completed successfully: { email: "...", role: "teacher", tokenLength: 1234, tokenPreview: "eyJhbGciOiJIUzI1NiIs..." }
🔗 Generated deep link URL: { scheme: "xytekclassroom", path: "/auth", tokenLength: 1234, role: "teacher", email: "...", fullUrl: "xytekclassroom://auth?..." }
📤 Sending JSON response with deep link URL
```

### Step 3: Check Frontend Response
The frontend should receive a JSON response with the `deepLinkUrl` field and automatically redirect:

```javascript
// Frontend automatically redirects using the deep link URL
window.location.href = response.deepLinkUrl;
```

### Step 4: Monitor Deep Link Interactions
When users interact with the page, logs are sent to `/api/auth/log-deep-link`:

```
📊 Deep Link Interaction Log: {
  type: "manual-click",
  deepLinkUrl: "xytekclassroom://auth?...",
  userRole: "teacher",
  userEmail: "user@example.com",
  timestamp: "2024-01-01T12:00:00.000Z",
  userAgent: "Mozilla/5.0...",
  ip: "192.168.1.1",
  headers: { ... }
}
```

## Frontend Implementation

### Basic Frontend Handler
```javascript
// Function to handle OAuth callback response
function handleOAuthCallback(response) {
    if (response.success) {
        // Success case - redirect to mobile app
        const deepLinkUrl = response.deepLinkUrl;
        console.log('✅ OAuth successful, redirecting to app:', deepLinkUrl);
        
        // Automatically redirect to mobile app
        window.location.href = deepLinkUrl;
    } else {
        // Error case - redirect to error deep link
        const errorDeepLink = response.deepLinkUrl;
        console.log('❌ OAuth failed, redirecting to error deep link:', errorDeepLink);
        
        // Automatically redirect to error deep link
        window.location.href = errorDeepLink;
    }
}

// Example usage in your OAuth callback page
fetch('/api/auth/google/mobile-callback?' + new URLSearchParams(window.location.search))
    .then(response => response.json())
    .then(data => handleOAuthCallback(data))
    .catch(error => console.error('Error:', error));
```

### Complete Frontend Example
See `mobile-oauth-handler.html` for a complete working example.

## Common Issues and Solutions

### Issue 1: Deep Link Not Opening App
**Symptoms**: Clicking the link does nothing
**Causes**:
- App not installed
- URL scheme not configured in app
- Incorrect URL scheme format

**Debug Steps**:
1. Check if app is installed on device
2. Verify URL scheme in app configuration
3. Test with a simple deep link first

### Issue 2: App Opens But No Data Received
**Symptoms**: App opens but JWT token is missing
**Causes**:
- Deep link parsing error in app
- Incorrect parameter names
- URL encoding issues

**Debug Steps**:
1. Check app's deep link handling code
2. Verify parameter names match exactly
3. Test URL decoding

### Issue 3: JSON Response Not Received
**Symptoms**: Frontend doesn't get the deep link URL
**Causes**:
- Backend error in OAuth processing
- Network issues
- Incorrect endpoint URL

**Debug Steps**:
1. Check backend server logs
2. Verify the callback endpoint is working
3. Test the endpoint directly

## Testing Commands

### Test Deep Link in Browser Console
```javascript
// Test the deep link manually
window.location.href = "xytekclassroom://auth?token=test&role=teacher&email=test@example.com";

// Check if page becomes hidden (app opened)
document.addEventListener('visibilitychange', () => {
    console.log('Visibility:', document.hidden ? 'hidden' : 'visible');
});

// Check if page loses focus (app opened)
window.addEventListener('blur', () => {
    console.log('Page lost focus - app may have opened');
});
```

### Test Deep Link from Terminal
```bash
# iOS Simulator
xcrun simctl openurl booted "xytekclassroom://auth?token=test&role=teacher"

# Android Emulator
adb shell am start -W -a android.intent.action.VIEW -d "xytekclassroom://auth?token=test&role=teacher" com.yourcompany.xytekclassroom
```

## Log Collection for Frontend Developer

### 1. Backend Server Logs
Collect these logs when testing:
- OAuth callback processing
- Deep link generation
- JSON response creation

### 2. Frontend Console Logs
Collect these logs from the browser:
- API response data
- Deep link redirect attempts
- User interactions
- Error messages

### 3. Network Requests
Monitor these API calls:
- `/api/auth/google/mobile-callback` GET request
- `/api/auth/log-deep-link` POST requests
- Any failed fetch requests
- Network errors

### 4. User Agent Information
Collect:
- Browser type and version
- Device information
- Operating system
- Screen resolution

## Debugging Checklist

- [ ] Test deep link endpoint works (`/api/auth/test-deep-link`)
- [ ] Verify OAuth callback returns JSON with deepLinkUrl
- [ ] Check frontend receives and processes JSON response
- [ ] Verify automatic redirect to deep link works
- [ ] Monitor network requests for callback endpoint
- [ ] Test deep link in different browsers
- [ ] Verify app URL scheme configuration
- [ ] Check app deep link handling code
- [ ] Test with real device (not just simulator)

## Next Steps

1. **Test the deep link endpoint** to isolate the issue
2. **Verify OAuth callback returns JSON** with deepLinkUrl
3. **Implement frontend handler** to process JSON response
4. **Test automatic redirect** to mobile app
5. **Collect all logs** from backend and frontend
6. **Share logs with frontend developer** for analysis

## Support Information

If you need help:
1. Share the backend server logs
2. Share the frontend console logs
3. Share the JSON response from the callback
4. Describe the exact behavior you're seeing
5. Mention which device/browser you're testing with
6. Include any error messages

This JSON-based approach ensures that:
1. ✅ No HTML pages are displayed
2. ✅ Backend returns clean JSON data
3. ✅ Frontend handles the redirect automatically
4. ✅ Works in production environments
5. ✅ Provides smooth user experience
6. ✅ Follows modern API design patterns
