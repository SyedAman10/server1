# Deep Link Debugging Guide

## Problem
The deep link is not redirecting to the mobile app when clicked, and we need comprehensive logging to debug this issue.

## What We've Added

### 1. Enhanced Logging in Mobile Callback
- **Backend Logs**: Detailed logging of OAuth callback processing
- **Frontend Logs**: Console logs for all deep link interactions
- **Interaction Tracking**: Logs when users click deep links or interact with the page

### 2. New Endpoints
- **`/api/auth/log-deep-link`**: Captures all deep link interactions
- **`/api/auth/test-deep-link`**: Test deep link functionality without OAuth

### 3. Debug Information Display
- Shows deep link URL with copy functionality
- Displays user information and token details
- Provides fallback mechanisms

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
📄 Sending HTML response with deep link redirect
```

### Step 3: Check Frontend Console Logs
When the deep link page loads, you should see:

```
🔗 Deep link page loaded
📱 Deep link URL: xytekclassroom://auth?token=...&role=teacher&email=...
👤 User role: teacher
📧 User email: user@example.com
🚀 Attempting automatic deep link redirect...
📱 Deep link page setup complete
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

### Issue 3: Page Shows But No Redirect
**Symptoms**: Page loads but doesn't redirect automatically
**Causes**:
- JavaScript errors
- Browser security restrictions
- Network issues

**Debug Steps**:
1. Check browser console for errors
2. Verify JavaScript execution
3. Test in different browsers

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
- HTML response creation

### 2. Frontend Console Logs
Collect these logs from the browser:
- Page load events
- Deep link attempts
- User interactions
- Error messages

### 3. Network Requests
Monitor these API calls:
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
- [ ] Verify OAuth callback generates correct deep link
- [ ] Check frontend console for JavaScript errors
- [ ] Monitor network requests for logging endpoint
- [ ] Test deep link in different browsers
- [ ] Verify app URL scheme configuration
- [ ] Check app deep link handling code
- [ ] Test with real device (not just simulator)

## Next Steps

1. **Test the deep link endpoint** to isolate the issue
2. **Collect all logs** from backend and frontend
3. **Share logs with frontend developer** for analysis
4. **Test on real devices** to verify functionality
5. **Check app configuration** for URL scheme setup

## Support Information

If you need help:
1. Share the backend server logs
2. Share the frontend console logs
3. Describe the exact behavior you're seeing
4. Mention which device/browser you're testing with
5. Include any error messages

This comprehensive logging system will help identify exactly where the deep link process is failing.
