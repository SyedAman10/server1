# Deep Link Debugging Guide (Redirect-Based Approach)

## Problem
The deep link is not redirecting to the mobile app when clicked, and we need comprehensive logging to debug this issue.

## What We've Added

### 1. Enhanced Logging in Mobile Callback
- **Backend Logs**: Detailed logging of OAuth callback processing
- **Redirect to Frontend**: Backend redirects to frontend page instead of returning JSON
- **Frontend Handling**: Frontend page automatically redirects to mobile app using deep link

### 2. New Endpoints
- **`/api/auth/log-deep-link`**: Captures all deep link interactions
- **`/api/auth/test-deep-link`**: Test deep link functionality without OAuth

### 3. Redirect Flow
The mobile callback now redirects to a frontend page instead of returning JSON:

1. **OAuth Callback**: Google redirects to `/api/auth/google/mobile-callback`
2. **Backend Processing**: Backend processes OAuth and generates deep link
3. **Frontend Redirect**: Backend redirects to frontend page with parameters
4. **Auto-Redirect**: Frontend automatically redirects to mobile app

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
🔄 Redirecting to frontend with success: https://yourfrontend.com/oauth-callback?success=true&deepLinkUrl=...
```

### Step 3: Check Frontend Redirect
The frontend should receive a redirect with URL parameters and automatically redirect:

```
✅ OAuth successful, preparing to redirect to mobile app
🚀 Attempting to redirect to mobile app...
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

### OAuth Callback Page
The frontend needs an OAuth callback page (e.g., `/oauth-callback`) that:

1. **Receives URL parameters** from the backend redirect
2. **Processes the deep link** automatically
3. **Redirects to mobile app** using `window.location.href`

### Example Frontend Handler
```javascript
// Get URL parameters from backend redirect
const urlParams = new URLSearchParams(window.location.search);
const success = urlParams.get('success');
const deepLinkUrl = urlParams.get('deepLinkUrl');
const role = urlParams.get('role');
const email = urlParams.get('email');

if (success === 'true' && deepLinkUrl) {
    // Success case - automatically redirect to mobile app
    console.log('✅ OAuth successful, redirecting to app');
    setTimeout(() => {
        window.location.href = deepLinkUrl;
    }, 2000);
} else if (error) {
    // Error case - redirect to error deep link
    const errorDeepLink = `xytekclassroom://auth?error=${encodeURIComponent(message)}`;
    setTimeout(() => {
        window.location.href = errorDeepLink;
    }, 3000);
}
```

### Complete Frontend Example
See `oauth-callback.html` for a complete working example.

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

### Issue 3: Frontend Page Not Receiving Parameters
**Symptoms**: Frontend page loads but no deep link parameters
**Causes**:
- Backend redirect failed
- Incorrect frontend URL
- Network issues

**Debug Steps**:
1. Check backend server logs for redirect
2. Verify frontend URL in backend configuration
3. Check network tab for redirect chain

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
- Frontend redirect URLs

### 2. Frontend Console Logs
Collect these logs from the browser:
- URL parameters received
- Deep link redirect attempts
- User interactions
- Error messages

### 3. Network Requests
Monitor these API calls:
- `/api/auth/google/mobile-callback` GET request
- Frontend redirect chain
- `/api/auth/log-deep-link` POST requests
- Any failed requests

### 4. User Agent Information
Collect:
- Browser type and version
- Device information
- Operating system
- Screen resolution

## Debugging Checklist

- [ ] Test deep link endpoint works (`/api/auth/test-deep-link`)
- [ ] Verify OAuth callback redirects to frontend
- [ ] Check frontend receives URL parameters
- [ ] Verify automatic redirect to deep link works
- [ ] Monitor network requests for redirect chain
- [ ] Test deep link in different browsers
- [ ] Verify app URL scheme configuration
- [ ] Check app deep link handling code
- [ ] Test with real device (not just simulator)

## Next Steps

1. **Test the deep link endpoint** to isolate the issue
2. **Verify OAuth callback redirects** to frontend page
3. **Implement frontend OAuth callback page** to handle redirects
4. **Test automatic redirect** to mobile app
5. **Collect all logs** from backend and frontend
6. **Share logs with frontend developer** for analysis

## Support Information

If you need help:
1. Share the backend server logs
2. Share the frontend console logs
3. Share the redirect URL chain
4. Describe the exact behavior you're seeing
5. Mention which device/browser you're testing with
6. Include any error messages

This redirect-based approach ensures that:
1. ✅ No JSON responses are displayed in browser
2. ✅ Backend redirects to frontend page
3. ✅ Frontend handles the deep link automatically
4. ✅ Works in production environments
5. ✅ Provides smooth user experience
6. ✅ Follows OAuth redirect best practices
