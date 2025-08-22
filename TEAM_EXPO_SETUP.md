# 👥 Team Expo Setup Guide

## 🎯 **Problem Solved**
No more hardcoded localhost URLs! Your Expo return URL now automatically detects the correct IP and port for each team member.

## 🚀 **How It Works**

### **Automatic Detection (Default)**
The system automatically detects:
- ✅ Your local network IP address
- ✅ Available Expo ports
- ✅ Production vs development environment

### **Team Member Overrides (Optional)**
You can set your preferred settings in `config/expo.js`:

```javascript
teamOverrides: {
  'your.email@company.com': {
    preferredLocalIP: '192.168.1.100',  // Your local IP
    preferredPort: 8081,                 // Your preferred Expo port
  },
}
```

## 📱 **Setup Steps**

### **Step 1: Find Your Local IP**
```bash
# On Windows
ipconfig

# On Mac/Linux
ifconfig
# or
ip addr show
```

Look for your local network IP (usually starts with `192.168.x.x` or `10.0.x.x`)

### **Step 2: Find Your Expo Port**
When you start Expo, it shows the port:
```bash
npx expo start
# Output: exp://192.168.1.100:8081
```

### **Step 3: Update Configuration**
Edit `config/expo.js` and add your preferences:

```javascript
teamOverrides: {
  'john.doe@company.com': {
    preferredLocalIP: '192.168.1.100',
    preferredPort: 8081,
  },
  'jane.smith@company.com': {
    preferredLocalIP: '10.0.0.50',
    preferredPort: 19000,
  },
}
```

## 🔧 **Configuration Options**

### **Development Settings**
```javascript
development: {
  ports: [8081, 8082, 19000, 19001, 19002],  // Add your preferred ports
  preferredLocalIP: null,                      // Leave null for auto-detection
  customScheme: null,                          // Custom URL scheme if needed
}
```

### **Production Settings**
```javascript
production: {
  appScheme: 'aiclassroom://auth/callback',    // Your production app scheme
  fallbackUrl: 'https://class.xytek.ai/auth/callback',
}
```

## 🧪 **Testing Your Setup**

### **Test OAuth Flow**
1. Start your Expo app
2. Initiate Google OAuth login
3. Check the logs for your custom return URL
4. Verify the redirect works correctly

### **Check Logs**
Look for these log messages:
```
👥 Using team member override: exp://192.168.1.100:8081/--/auth/callback
🎯 Final Expo return URL: exp://192.168.1.100:8081/--/auth/callback
```

## 🌐 **Network Requirements**

### **Local Development**
- ✅ Same network (WiFi/LAN)
- ✅ Firewall allows Expo ports
- ✅ No VPN conflicts

### **Production**
- ✅ App scheme configured
- ✅ Deep linking set up
- ✅ App store deployment ready

## 🔍 **Troubleshooting**

### **Issue: Still using localhost**
**Solution**: Check if your IP is being detected correctly:
```bash
# Test network connectivity
ping 192.168.1.100
```

### **Issue: Port not working**
**Solution**: Try different ports in the configuration:
```javascript
ports: [8081, 8082, 19000, 19001, 19002]
```

### **Issue: Team override not working**
**Solution**: Verify your email matches exactly in the configuration

## 📋 **Quick Setup Checklist**

- [ ] Find your local IP address
- [ ] Find your Expo port
- [ ] Update `config/expo.js` with your preferences
- [ ] Test OAuth flow
- [ ] Verify logs show your custom URL
- [ ] Share configuration with team

## 🎉 **Benefits**

- ✅ **No more hardcoded URLs**
- ✅ **Works for all team members**
- ✅ **Automatic production detection**
- ✅ **Easy team customization**
- ✅ **Future-proof setup**

Your Expo return URL now works for everyone! 🚀
